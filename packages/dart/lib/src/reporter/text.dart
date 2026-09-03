/// The wording and the column arithmetic every reporter shares.
library;

import 'package:chki18n/src/constants.dart';
import 'package:chki18n/src/core/width.dart';
import 'package:chki18n/src/reporter/paint.dart';
import 'package:chki18n/src/types.dart';

final RegExp _whitespaceRun = RegExp(r'\s+');

/// `1 key` / `2 keys`, so a count never has to be read as `2 key(s)`.
String plural(int count, String noun) => '$count $noun${count == 1 ? '' : 's'}';

/// A translation value can hold newlines and runs of spaces, both of which
/// would break a column apart.
///
/// Only the report collapses them; nothing is changed for the checks
/// themselves, which is where whitespace still matters.
String oneLine(String value) => value.replaceAll(_whitespaceRun, ' ');

/// A value as the report shows it, or `(none)` when there was none.
String quote(String? value) => value == null ? '(none)' : '"${oneLine(value)}"';

/// Pads to a column count, so a column of Korean lines up with one of English.
String padTo(String text, int width) {
  final room = width - displayWidth(text);

  return room > 0 ? '$text${' ' * room}' : text;
}

/// The widest of a set of strings, in columns.
int widestOf(Iterable<String> values) {
  var widest = 0;

  for (final value in values) {
    final width = displayWidth(value);

    if (width > widest) {
      widest = width;
    }
  }

  return widest;
}

/// Cuts to a column count and marks the cut.
String truncate(String text, int max) {
  if (displayWidth(text) <= max) {
    return text;
  }

  final room = max - 3 > 1 ? max - 3 : 1;
  final kept = StringBuffer();
  var width = 0;

  for (final rune in text.runes) {
    final char = String.fromCharCode(rune);
    final next = width + charWidth(char);

    if (next > room) {
      break;
    }

    width = next;
    kept.write(char);
  }

  return '$kept...';
}

/// Breaks a sentence on its spaces so it fits a column count.
///
/// Prose is wrapped rather than cut: a description that stops mid-word tells
/// the reader less than one that runs onto a second line. A word wider than the
/// column is left to overflow, since breaking it would only make it unreadable.
List<String> wrap(String text, int width) {
  if (width < 8) {
    return [text];
  }

  final lines = <String>[];
  var line = '';

  for (final word in text.split(' ')) {
    if (line.isEmpty) {
      line = word;
    } else if (displayWidth(line) + 1 + displayWidth(word) > width) {
      lines.add(line);
      line = word;
    } else {
      line = '$line $word';
    }
  }

  if (line.isNotEmpty) {
    lines.add(line);
  }

  return lines;
}

/// Cuts the front instead of the back.
///
/// What tells two file paths apart is their last few segments, so those are the
/// ones a heading has to keep.
String truncateStart(String text, int max) {
  if (displayWidth(text) <= max) {
    return text;
  }

  final characters = text.runes.toList();
  final room = max - 3 > 1 ? max - 3 : 1;
  var width = 0;
  var kept = '';

  for (var index = characters.length - 1; index >= 0; index -= 1) {
    final char = String.fromCharCode(characters[index]);
    final next = width + charWidth(char);

    if (next > room) {
      break;
    }

    width = next;
    kept = '$char$kept';
  }

  return '...$kept';
}

/// A tally as the report paints it, and how wide it would be unpainted.
class Chki18nCountsPhrase {
  /// Pairs the painted text with the width the escape codes do not add to.
  const Chki18nCountsPhrase(this.text, this.length);

  /// The phrase, painted.
  final String text;

  /// Columns the phrase occupies once the escape codes are taken out.
  final int length;
}

/// `3 errors - 7 warnings - 1 info`, or `clean` when there is nothing to say.
Chki18nCountsPhrase countsPhrase(Chki18nLevelCount counts, Chki18nPaint paint) {
  final parts = <String>[];
  var length = 0;

  void add(int count, String word, String Function(String text) painter) {
    if (count < 1) {
      return;
    }

    length += (parts.isNotEmpty ? 3 : 0) + word.length;
    parts.add(painter(word));
  }

  add(counts.error, plural(counts.error, 'error'), paint.error);
  add(counts.warn, plural(counts.warn, 'warning'), paint.warn);
  // `info` has no plural that reads well, so the noun is left as it is.
  add(counts.info, '${counts.info} info', paint.info);

  if (parts.isEmpty) {
    return Chki18nCountsPhrase(paint.dim('clean'), 5);
  }

  return Chki18nCountsPhrase(parts.join(paint.dim(' · ')), length);
}

/// The same tally as [countsPhrase], unpainted and as a sentence.
String countsSentence(Chki18nSummary counts) {
  final parts = [
    if (counts.error > 0) plural(counts.error, 'error'),
    if (counts.warn > 0) plural(counts.warn, 'warning'),
    if (counts.info > 0) '${counts.info} info',
  ];

  return parts.isNotEmpty ? 'Found ${parts.join(', ')}.' : 'Found no issues.';
}

/// What the run compared, as one sentence.
String scopeSentence(Chki18nResult result) =>
    'Compared ${plural(result.keyCount, 'key')} across '
    '${plural(result.locales.length, 'locale')} in '
    '${plural(result.groups.length, 'group')}. (${result.elapsedMs}ms)';

/// The target language's own wording, which is what a translation is compared
/// against.
///
/// Keys the target language does not have fall back to their own value, and a
/// check about the key rather than the value shows neither.
String referenceOf(Chki18nIssue issue, String target) {
  if (issue.targetValue != null) {
    return '$target: ${quote(issue.targetValue)}';
  }

  if (issue.value != null) {
    return '${issue.locale}: ${quote(issue.value)}';
  }

  return '';
}

/// What this occurrence adds over the check's own description.
///
/// A check that only repeats the description has nothing to add, so it
/// contributes no line.
String detailOf(Chki18nIssue issue) =>
    issue.message == checkMeta[issue.code]?.description ? '' : issue.message;

/// The key as the report shows it.
///
/// When a project has more than one comparable set of files, the group is part
/// of the key's address and is shown with it.
String keyLabelOf(Chki18nIssue issue, bool showGroup) {
  if (issue.key.isEmpty) {
    // A finding about a whole group or file has no key to address it by, and a
    // bare `@group` would read as one.
    return '';
  }

  return showGroup && issue.group.isNotEmpty ? '${issue.key} @${issue.group}' : issue.key;
}

/// Strips the working directory from a path, leaving an absolute one alone.
String relativeTo(String path, String cwd) {
  if (cwd.isEmpty) {
    return path;
  }

  for (final separator in const ['/', r'\']) {
    final prefix = cwd.endsWith(separator) ? cwd : '$cwd$separator';

    if (path.startsWith(prefix)) {
      return path.substring(prefix.length);
    }
  }

  return path;
}
