/// The handful of path operations the loader needs.
///
/// Written out rather than pulled in, because this package has no dependencies
/// and `package:path` would be the only one. What is here is what the scanner
/// actually asks for: a name off the end of a path, two paths joined, and a
/// relative path made absolute so two of them can be compared.
library;

import 'dart:io';

/// Both separators, because a Windows path may be written with either.
final RegExp _separator = RegExp(r'[/\\]');

/// The last segment of a path, which is a file's or a directory's own name.
String basenameOf(String path) {
  final trimmed =
      path.endsWith('/') || path.endsWith(r'\') ? path.substring(0, path.length - 1) : path;
  final cut = trimmed.lastIndexOf(_separator);

  return cut == -1 ? trimmed : trimmed.substring(cut + 1);
}

/// Everything above the last segment, or `.` when there is nothing above it.
String dirnameOf(String path) {
  final cut = path.lastIndexOf(_separator);

  if (cut == -1) {
    return '.';
  }

  return cut == 0 ? path.substring(0, 1) : path.substring(0, cut);
}

/// Joins two path segments with the platform's own separator.
String joinPath(String directory, String name) {
  if (directory.isEmpty) {
    return name;
  }

  final separator = Platform.pathSeparator;

  return directory.endsWith('/') || directory.endsWith(r'\')
      ? '$directory$name'
      : '$directory$separator$name';
}

/// The extension of a file name, lower cased and without its dot.
///
/// Empty when the name carries none, and empty for a dotfile: `.gitignore` is a
/// name that begins with a dot rather than a file of type `gitignore`.
String extensionOf(String name) {
  final cut = name.lastIndexOf('.');

  return cut < 1 ? '' : name.substring(cut + 1).toLowerCase();
}

/// The file name with its extension taken off.
String stemOf(String name) {
  final cut = name.lastIndexOf('.');

  return cut < 1 ? name : name.substring(0, cut);
}

/// A path made absolute and normalised, so two of them compare equal.
///
/// `.` and `..` are resolved here rather than left to the file system, because
/// the unused-key scan compares the paths it walks against the paths it was
/// told to skip, and two spellings of one file would defeat that.
String absolutePath(String path) {
  final isAbsolute = path.startsWith('/') || RegExp(r'^[A-Za-z]:[/\\]').hasMatch(path);
  final full = isAbsolute ? path : joinPath(Directory.current.path, path);
  final separator = Platform.pathSeparator;
  final segments = <String>[];
  final leading =
      full.startsWith('/') ? '/' : RegExp(r'^[A-Za-z]:[/\\]').firstMatch(full)?.group(0) ?? '';

  for (final segment in full.substring(leading.length).split(_separator)) {
    if (segment.isEmpty || segment == '.') {
      continue;
    }

    if (segment == '..') {
      if (segments.isNotEmpty) {
        segments.removeLast();
      }

      continue;
    }

    segments.add(segment);
  }

  final tail = segments.join(leading == '/' ? '/' : separator);

  return leading.isEmpty ? tail : '$leading$tail';
}
