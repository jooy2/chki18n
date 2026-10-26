/// Reading a directory of translation files into the shape the analyzer
/// compares. This is the only part of the library that walks the file system
/// looking for translations.
library;

import 'dart:convert';
import 'dart:io';

import 'package:chki18n/src/constants.dart';
import 'package:chki18n/src/core/exclude.dart';
import 'package:chki18n/src/core/interpolation.dart';
import 'package:chki18n/src/core/issue.dart';
import 'package:chki18n/src/core/locale.dart';
import 'package:chki18n/src/loader/json_duplicates.dart';
import 'package:chki18n/src/loader/paths.dart';
import 'package:chki18n/src/loader/walk.dart';
import 'package:chki18n/src/types.dart';

/// What one walk of a translation directory found.
class Chki18nScanResult {
  /// Creates the result of one scan.
  const Chki18nScanResult({
    required this.fileFormat,
    required this.groups,
    required this.files,
    required this.skipped,
    required this.detectedInterpolation,
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

  /// Interpolation delimiters the files appear to be written with, or `null`
  /// when nothing in them looks like one. A guess to offer a user setting a
  /// project up; the run itself uses `interpolationPrefix` either way.
  final Chki18nDelimiters? detectedInterpolation;

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
    required this.interpolation,
  }) : read = true;

  /// A file the scan found and did not read, because its path names no locale.
  const _ScannedFile.unread({
    required this.path,
    required this.relativePath,
    required this.segments,
  }) : read = false,
       json = null,
       duplicateKeys = const [],
       interpolation = null;

  /// Whether the file was read at all.
  final bool read;

  final String path;
  final String relativePath;

  /// Path segments relative to the scan root, file name last.
  final List<String> segments;
  final Object? json;

  /// Keys written twice in the text, which parsing has since collapsed.
  final List<Chki18nJsonDuplicateKey> duplicateKeys;

  /// Delimiters this file's own text looks like it is written with.
  final Chki18nDelimiters? interpolation;
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

/// Whether a file's own name is a locale, as the `single` layout names them.
bool _isNamedForLocale(List<String> segments) => isLocaleCode(stemOf(segments.last));

/// Whether a file sits in a folder named for a locale, as `folder` puts them.
bool _isInLocaleFolder(List<String> segments) =>
    segments.length > 1 && isLocaleCode(segments[segments.length - 2]);

/// Whether a file has to be read in a layout.
///
/// Every layout but `nested` names its locales in the path, so a file whose path
/// names none can hold no locale's translations, and reading it would only parse
/// a fixture or a data file of the application the scan was pointed at.
bool _mayHoldLocale(List<String> segments, Chki18nFileFormat format) => switch (format) {
  Chki18nFileFormat.single => _isNamedForLocale(segments),
  Chki18nFileFormat.folder => _isInLocaleFolder(segments),
  Chki18nFileFormat.nested => true,
  Chki18nFileFormat.auto => _isNamedForLocale(segments) || _isInLocaleFolder(segments),
};

/// The layout the files' paths say they are in, or `null` when no path names
/// a locale.
///
/// The path shape alone is ambiguous (`a/ko.json` and `ko/common.json` both
/// have two segments), so the decision is made by which segment is a real
/// locale code: a locale named file means `single`, a locale named folder means
/// `folder`. Only a file that could be read decides.
Chki18nFileFormat? _fileFormatOfPaths(Iterable<_ScannedFile> files) {
  for (final file in files) {
    if (_isNamedForLocale(file.segments)) {
      return Chki18nFileFormat.single;
    }

    if (_isInLocaleFolder(file.segments)) {
      return Chki18nFileFormat.folder;
    }
  }

  return null;
}

/// A place in the walk: a file found there, or a directory it could not list.
class _Slot {
  _Slot.file(Chki18nWalkedFile this.file) : issue = null;

  _Slot.issue(Chki18nIssue this.issue) : file = null;

  final Chki18nWalkedFile? file;
  final Chki18nIssue? issue;

  /// What reading [file] gave: a [_ScannedFile], or the [Chki18nIssue] it ran into.
  Object? read;
}

/// Every supported file below [root] and every directory that could not be
/// listed, in walk order.
Future<List<_Slot>> _walkTranslationTree(String root, Chki18nResolvedOptions options) async {
  final slots = <_Slot>[];
  final isExcludedFile = createFileExcluder(options.excludeFiles);

  final walk = walkFiles(
    root,
    isExcludedDirectory: createPathExcluder(options.exclude),
    isWanted: (file) {
      final name = file.segments.last;

      return supportedExtensions.contains(extensionOf(name)) && !isExcludedFile(name);
    },
    onUnreadable: (directory) {
      slots.add(
        _Slot.issue(
          createIssue(
            Chki18nCheckCode.invalidFile,
            file: directory,
            message:
                "Failed to read the directory '$directory'. It may not exist or read access "
                'may be denied.',
          ),
        ),
      );
    },
  );

  await for (final file in walk) {
    slots.add(_Slot.file(file));
  }

  return slots;
}

/// One file read and parsed, or the [Chki18nIssue] it ran into.
Future<Object> _readTranslationFile(Chki18nWalkedFile file, Chki18nResolvedOptions options) async {
  final relativePath = file.segments.join('/');
  final readError = "Failed to read file '$relativePath': ";
  String content;

  try {
    content = await File(file.path).readAsString();
  } catch (_) {
    return createIssue(
      Chki18nCheckCode.invalidFile,
      file: file.path,
      message: '${readError}May be read access denied or invalid file format.',
    );
  }

  if (content.trim().isEmpty) {
    return createIssue(
      Chki18nCheckCode.invalidFile,
      file: file.path,
      message: '${readError}File content is empty.',
    );
  }

  Object? json;

  try {
    json = jsonDecode(content);
  } on FormatException {
    return createIssue(
      Chki18nCheckCode.invalidFile,
      file: file.path,
      message:
          '${readError}Content is not json format or parse failed due to an invalid '
          'character.',
    );
  }

  return _ScannedFile(
    path: file.path,
    relativePath: relativePath,
    segments: file.segments,
    json: json,
    // Read off the text, because the decoder has already discarded it.
    duplicateKeys:
        options.enabledChecks.contains(Chki18nCheckCode.duplicateKey)
            ? findDuplicateJsonKeys(content)
            : const [],
    interpolation: detectInterpolationDelimiters(content),
  );
}

/// Reads the files of [slots] that [isWanted] asks for, each into its own slot.
Future<void> _readSlots(
  List<_Slot> slots,
  bool Function(Chki18nWalkedFile file) isWanted,
  Chki18nResolvedOptions options,
) async {
  for (final slot in slots) {
    final file = slot.file;

    if (file != null && slot.read == null && isWanted(file)) {
      slot.read = await _readTranslationFile(file, options);
    }
  }
}

Iterable<_ScannedFile> _scannedOf(List<_Slot> slots) =>
    slots.map((slot) => slot.read).whereType<_ScannedFile>();

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

    // Left unread because its path names no locale, so it belongs to none.
    if (!file.read) {
      skipped.add(file.relativePath);
      continue;
    }

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

/// The delimiters the whole tree looks like it is written with.
///
/// The files are read as one text rather than voted on: a project writing
/// `{{name}}` anywhere is a project whose delimiters are `{{` and `}}`, however
/// many of its other files happen to hold no placeholder at all. Files that
/// belong to no locale are left out — they are not this project's translations.
Chki18nDelimiters? _detectedInterpolationOf(List<_ScannedFile> files, List<String> skipped) {
  final ignored = skipped.toSet();
  final seen = <String>{};

  for (final file in files) {
    if (file.interpolation != null && !ignored.contains(file.relativePath)) {
      seen.add(file.interpolation!.prefix);
    }
  }

  for (final candidate in interpolationDelimiters) {
    if (seen.contains(candidate.prefix)) {
      return candidate;
    }
  }

  return null;
}

/// Reads a directory of translation files into the shape the analyzer compares.
Future<Chki18nScanResult> scanTranslationDirectory(
  String path,
  Chki18nResolvedOptions options,
) async {
  final issues = <Chki18nIssue>[];
  final slots = await _walkTranslationTree(path, options);

  await _readSlots(slots, (file) => _mayHoldLocale(file.segments, options.format), options);

  var fileFormat =
      options.format == Chki18nFileFormat.auto
          ? _fileFormatOfPaths(_scannedOf(slots))
          : options.format;

  if (fileFormat == null) {
    // No path names a locale, so only the files' content can tell whether
    // their top level keys do, as the `nested` layout writes them.
    await _readSlots(slots, (_) => true, options);

    fileFormat =
        _scannedOf(slots).any((file) => _nestedLocaleKeys(file.json).isNotEmpty)
            ? Chki18nFileFormat.nested
            : Chki18nFileFormat.single;
  }

  // The issues go out in walk order.
  final entries = <_ScannedFile>[];

  for (final slot in slots) {
    final file = slot.file;
    final read = slot.read;

    if (slot.issue != null) {
      issues.add(slot.issue!);
    } else if (file != null && read == null) {
      entries.add(
        _ScannedFile.unread(
          path: file.path,
          relativePath: file.segments.join('/'),
          segments: file.segments,
        ),
      );
    } else if (read is _ScannedFile) {
      entries.add(read);
    } else if (read is Chki18nIssue) {
      issues.add(read);
    }
  }

  final built = _buildGroups(entries, fileFormat, issues);

  if (built.files.isEmpty) {
    issues.add(
      createIssue(
        Chki18nCheckCode.invalidFile,
        file: path,
        message:
            entries.isNotEmpty
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
    detectedInterpolation: _detectedInterpolationOf(
      entries.where((entry) => entry.read).toList(),
      built.skipped,
    ),
    issues: issues,
  );
}
