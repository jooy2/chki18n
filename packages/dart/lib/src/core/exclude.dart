/// What a scan does not look at.
///
/// Two questions, kept together because both are answered from a path alone:
/// whether a directory is one the walk should not enter, and whether a file is
/// one it should not read. Neither needs the file system, so the rules are the
/// same wherever they are applied — the directory scanner, the unused-key scan,
/// or a caller colouring a folder picker of its own.
library;

/// Both separators, because a path may be written with either.
final RegExp _separator = RegExp(r'[/\\]');

/// A path as segments, with empty ones and `.` dropped.
List<String> pathSegments(String path) => [
  for (final segment in path.split(_separator))
    if (segment.isNotEmpty && segment != '.') segment,
];

/// Whether [name] matches [pattern], where `*` stands for any run of characters
/// and everything else is literal. Case is ignored, because the file systems
/// these names come from mostly ignore it too.
bool matchesNamePattern(String name, String pattern) {
  final subject = name.toLowerCase();
  final parts = pattern.toLowerCase().split('*');

  if (parts.length == 1) {
    return subject == parts.first;
  }

  final first = parts.first;
  final last = parts.last;

  if (!subject.startsWith(first) || !subject.endsWith(last)) {
    return false;
  }

  var index = first.length;

  for (var position = 1; position < parts.length - 1; position += 1) {
    final part = parts[position];

    if (part.isEmpty) {
      continue;
    }

    final found = subject.indexOf(part, index);

    if (found == -1) {
      return false;
    }

    index = found + part.length;
  }

  // The parts matched in order, but the first and the last may have claimed the
  // same characters: `ab` must not match `a*b*b`.
  return index + last.length <= subject.length;
}

/// A test for the directories a walk should not enter, over the candidate's
/// path relative to the root, its own name last.
///
/// An entry of one segment names a directory at any depth, which is what makes
/// `node_modules` mean every `node_modules` there is. An entry of more names a
/// path from the root, matching that directory and everything under it, which
/// is what lets a project exclude its own `src/legacy` without excluding a
/// `legacy` belonging to something else.
bool Function(List<String>) createPathExcluder(Iterable<String> entries) {
  final names = <String>{};
  final paths = <List<String>>[];

  for (final entry in entries) {
    final segments = pathSegments(entry);

    if (segments.length == 1) {
      names.add(segments.first);
    } else if (segments.length > 1) {
      paths.add(segments);
    }
  }

  return (segments) {
    for (final segment in segments) {
      if (names.contains(segment)) {
        return true;
      }
    }

    for (final path in paths) {
      if (path.length > segments.length) {
        continue;
      }

      var matched = true;

      for (var at = 0; at < path.length; at += 1) {
        if (path[at] != segments[at]) {
          matched = false;
          break;
        }
      }

      if (matched) {
        return true;
      }
    }

    return false;
  };
}

/// A test for the files a walk should not read, over the file's own name.
bool Function(String) createFileExcluder(Iterable<String> patterns) {
  final exact = <String>{};
  final globs = <String>[];

  for (final pattern in patterns) {
    if (pattern.isEmpty) {
      continue;
    }

    if (pattern.contains('*')) {
      globs.add(pattern);
    } else {
      exact.add(pattern.toLowerCase());
    }
  }

  return (name) {
    final subject = name.toLowerCase();

    if (exact.contains(subject)) {
      return true;
    }

    for (final pattern in globs) {
      if (matchesNamePattern(subject, pattern)) {
        return true;
      }
    }

    return false;
  };
}
