/// Reading a directory of translation files into the shape the analyzer
/// compares. This is the only part of the library that walks the file system
/// looking for translations.
library;

import 'dart:convert';
import 'dart:io';

import 'package:chki18n/src/constants.dart';
import 'package:chki18n/src/core/exclude.dart';
import 'package:chki18n/src/core/issue.dart';
import 'package:chki18n/src/core/locale.dart';
import 'package:chki18n/src/loader/json_duplicates.dart';
import 'package:chki18n/src/loader/paths.dart';
import 'package:chki18n/src/types.dart';

/// What one walk of a translation directory found.
class Chki18nScanResult {
  /// Creates the result of one scan.
  const Chki18nScanResult({
    required this.fileFormat,
    required this.groups,
    required this.files,
    required this.skipped,
    required this.issues,
  });

  /// Layout the files were read as, whether detected or forced.
  final Chki18nFileFormat fileFormat;

  /// Parsed translations, ready to hand to the analyzer.
  final TranslationGroups groups;

  /// The files that became part of a group.
  final List<Chki18nSourceFile> files;

  /// Files that were read but did not belong to any locale.
  final List<String> skipped;

  /// Everything that could not be read, as `INVALID_FILE` issues.
  final List<Chki18nIssue> issues;
}

class _ScannedFile {
  const _ScannedFile({
    required this.path,
    required this.relativePath,
    required this.segments,
    required this.json,
    required this.duplicateKeys,
  });

  final String path;
  final String relativePath;

  /// Path segments relative to the scan root, file name last.
  final List<String> segments;
  final Object? json;

  /// Keys written twice in the text, which parsing has since collapsed.
  final List<Chki18nJsonDuplicateKey> duplicateKeys;

}

/// Top level keys of a file that name a locale, as the `nested` layout does.
List<String> _nestedLocaleKeys(Object? json) {
  if (json is! Map) {
    return const [];
  }

  return [
    for (final key in json.keys)
      if (isLocaleCode('$key')) '$key',
  ];
}

/// Reads every supported file below [root], parsed and in a stable order.
Future<List<_ScannedFile>> _collectFiles(
  String root,
  Chki18nResolvedOptions options,
  List<Chki18nIssue> issues,
) async {
  final files = <_ScannedFile>[];
  final isExcludedDirectory = createPathExcluder(options.exclude);
  final isExcludedFile = createFileExcluder(options.excludeFiles);

  Future<void> walk(String directory, List<String> segments) async {
    List<FileSystemEntity> entries;

    try {
      entries = await Directory(directory).list(followLinks: false).toList();
    } on FileSystemException {
      issues.add(
        createIssue(
          Chki18nCheckCode.invalidFile,
          file: directory,
          message:
              "Failed to read the directory '$directory'. It may not exist or read access "
              'may be denied.',
        ),
      );
      return;
    }

    // Listing order is filesystem dependent; sort so a scan of the same tree
    // always reports its issues in the same order.
    entries.sort((a, b) => basenameOf(a.path).compareTo(basenameOf(b.path)));

    for (final entry in entries) {
      final name = basenameOf(entry.path);

      // Hidden entries are tooling state, never translations.
      if (name.startsWith('.')) {
        continue;
      }

      final path = joinPath(directory, name);

      if (entry is Directory) {
        if (!isExcludedDirectory([...segments, name])) {
          await walk(path, [...segments, name]);
        }

        continue;
      }

      if (!supportedExtensions.contains(extensionOf(name)) || isExcludedFile(name)) {
        continue;
      }

      final relativePath = [...segments, name].join('/');
      final readError = "Failed to read file '$relativePath': ";
      String content;

      try {
        content = await File(path).readAsString();
      } catch (_) {
        issues.add(
          createIssue(
            Chki18nCheckCode.invalidFile,
            file: path,
            message: '${readError}May be read access denied or invalid file format.',
          ),
        );
        continue;
      }

      if (content.trim().isEmpty) {
        issues.add(
          createIssue(
            Chki18nCheckCode.invalidFile,
            file: path,
            message: '${readError}File content is empty.',
          ),
        );
        continue;
      }

      Object? json;

      try {
        json = jsonDecode(content);
      } on FormatException {
        issues.add(
          createIssue(
            Chki18nCheckCode.invalidFile,
            file: path,
            message:
                '${readError}Content is not json format or parse failed due to an invalid '
                'character.',
          ),
        );
        continue;
      }

      files.add(
        _ScannedFile(
          path: path,
          relativePath: relativePath,
          segments: [...segments, name],
          json: json,
          // Read off the text, because the decoder has already discarded it.
          duplicateKeys:
              options.enabledChecks.contains(Chki18nCheckCode.duplicateKey)
                  ? findDuplicateJsonKeys(content)
                  : const [],
        ),
      );
    }
  }

  await walk(root, const []);

  return files;
}

/// Works out how the files are laid out.
///
/// The path shape alone is ambiguous (`a/ko.json` and `ko/common.json` both
/// have two segments), so the decision is made by which segment is a real
/// locale code: a locale named file means `single`, a locale named folder means
/// `folder`. When no path segment is a locale, a file whose top level keys are
/// locales means `nested`.
Chki18nFileFormat _detectFileFormat(List<_ScannedFile> files) {
  for (final file in files) {
    if (isLocaleCode(stemOf(file.segments.last))) {
      return Chki18nFileFormat.single;
    }

    if (file.segments.length > 1 && isLocaleCode(file.segments[file.segments.length - 2])) {
      return Chki18nFileFormat.folder;
    }
  }

  for (final file in files) {
    if (_nestedLocaleKeys(file.json).isNotEmpty) {
      return Chki18nFileFormat.nested;
    }
  }

  return Chki18nFileFormat.single;
}

class _BuiltGroups {
  const _BuiltGroups(this.groups, this.files, this.skipped);

  final TranslationGroups groups;
  final List<Chki18nSourceFile> files;
  final List<String> skipped;
}

/// Sorts the files into comparable groups.
///
/// A group is one set of files that hold the same keys in different languages,
/// so a project with several translation files (`common.json`, `errors.json`)
/// is compared file by file rather than as one flat pile of keys.
_BuiltGroups _buildGroups(
  List<_ScannedFile> files,
  Chki18nFileFormat fileFormat,
  List<Chki18nIssue> issues,
) {
  final groups = <String, Map<String, TranslationMap>>{};
  final sources = <Chki18nSourceFile>[];
  final skipped = <String>[];

  void add(String group, String locale, Object? translations, _ScannedFile file) {
    // A translation file is an object of keys. Anything else — a top level
    // array, a bare string — has no keys to compare and is reported rather than
    // silently read as an empty one.
    if (translations is! Map) {
      issues.add(
        createIssue(
          Chki18nCheckCode.invalidFile,
          locale: locale,
          group: group,
          file: file.path,
          message: "The translations of `$locale` in '${file.relativePath}' are not an object.",
        ),
      );

      return;
    }

    (groups[group] ??= <String, TranslationMap>{})[locale] = <String, Object?>{
      for (final entry in translations.entries) '${entry.key}': entry.value,
    };
    sources.add(
      Chki18nSourceFile(
        path: file.path,
        relativePath: file.relativePath,
        group: group,
        locale: locale,
      ),
    );

    // A `nested` file's paths start with the locale that owns them; every other
    // layout's are already relative to the locale's own root.
    final prefix = fileFormat == Chki18nFileFormat.nested ? '$locale.' : '';

    for (final duplicate in file.duplicateKeys) {
      if (prefix.isNotEmpty && !duplicate.path.startsWith(prefix)) {
        continue;
      }

      issues.add(
        createIssue(
          Chki18nCheckCode.duplicateKey,
          locale: locale,
          group: group,
          key: duplicate.path.substring(prefix.length),
          file: file.path,
          message:
              "The key is written twice in '${file.relativePath}' (line ${duplicate.line}), "
              'so one of its values is lost.',
        ),
      );
    }
  }

  for (final file in files) {
    final segments = file.segments;
    final fileName = segments.last;

    if (fileFormat == Chki18nFileFormat.nested) {
      final locales = _nestedLocaleKeys(file.json);

      if (locales.isEmpty) {
        skipped.add(file.relativePath);
        continue;
      }

      for (final locale in locales) {
        add(file.relativePath, locale, (file.json! as Map)[locale], file);
      }

      continue;
    }

    if (fileFormat == Chki18nFileFormat.folder) {
      final locale = segments.length > 1 ? segments[segments.length - 2] : '';

      if (!isLocaleCode(locale)) {
        skipped.add(file.relativePath);
        continue;
      }

      final directory = segments.sublist(0, segments.length - 2).join('/');

      add(directory.isEmpty ? fileName : '$directory/$fileName', locale, file.json, file);
      continue;
    }

    final locale = stemOf(fileName);

    if (!isLocaleCode(locale)) {
      skipped.add(file.relativePath);
      continue;
    }

    add(segments.sublist(0, segments.length - 1).join('/'), locale, file.json, file);
  }

  return _BuiltGroups(groups, sources, skipped);
}

/// Reads a directory of translation files into the shape the analyzer compares.
Future<Chki18nScanResult> scanTranslationDirectory(
  String path,
  Chki18nResolvedOptions options,
) async {
  final issues = <Chki18nIssue>[];
  final files = await _collectFiles(path, options, issues);
  final fileFormat =
      options.format == Chki18nFileFormat.auto ? _detectFileFormat(files) : options.format;
  final built = _buildGroups(files, fileFormat, issues);

  if (built.files.isEmpty) {
    issues.add(
      createIssue(
        Chki18nCheckCode.invalidFile,
        file: path,
        message:
            files.isNotEmpty
                ? 'No translation file matching the `${fileFormat.name}` format was found in '
                    "'$path'. Check the `format` option."
                : "No translation file was found in '$path'.",
      ),
    );
  }

  return Chki18nScanResult(
    fileFormat: fileFormat,
    groups: built.groups,
    files: built.files,
    skipped: built.skipped,
    issues: issues,
  );
}
