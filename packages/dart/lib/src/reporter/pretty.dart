/// The report as a terminal reads it.
library;

import 'package:chki18n/src/constants.dart';
import 'package:chki18n/src/core/width.dart';
import 'package:chki18n/src/reporter/context.dart';
import 'package:chki18n/src/reporter/group.dart';
import 'package:chki18n/src/reporter/paint.dart';
import 'package:chki18n/src/reporter/text.dart';
import 'package:chki18n/src/types.dart';

const String _indentSection = '  ';

const String _indentItem = '    ';

const String _indentDetail = '      ';

/// Longest a column is allowed to grow before its content is cut short.
const int _maxKeyColumn = 40;

const int _maxLabelColumn = 30;

final RegExp _pathSeparator = RegExp(r'[/\\]');

/// The line a section heading trails off into. A box drawing character, so a
/// rule reads as a rule rather than as a row of hyphens.
const String _rule = '\u2500';

/// A section heading: the label, a rule, and what the section adds up to.
String _ruleLine(String label, Chki18nCountsPhrase? right, Chki18nReportContext context) {
  final paint = context.paint;
  final tailLength = right == null ? 0 : right.length + 1;
  // A long label is cut rather than allowed to push the counts past the edge
  // and wrap the rule onto a second line. A path keeps its tail, which is the
  // part that tells one file from another.
  final roomForLabel = context.width - tailLength - 5;
  final room = roomForLabel < 12 ? 12 : roomForLabel;
  final cut = _pathSeparator.hasMatch(label) ? truncateStart : truncate;
  final head = label.isEmpty ? ' ' : ' ${cut(label, room)} ';
  final space = context.width - displayWidth(head) - tailLength;
  final fill = space < 3 ? 3 : space;

  return '${paint.heading(head)}${paint.dim(_rule * fill)}'
      '${right == null ? '' : ' ${right.text}'}';
}

/// What the run was pointed at, above the findings themselves.
List<String> _headBlock(Chki18nReportContext context) {
  final result = context.result;
  final options = context.options;
  final paint = context.paint;
  final rows = <List<String>>[];
  final path = options.path;

  if (path != null) {
    rows.add(['Path', relativeTo(path, context.cwd)]);
  }

  rows.add(['Target', result.target]);

  if (result.locales.isNotEmpty) {
    rows.add(['Locales', result.locales.join(', ')]);
  }

  rows.add([
    'Layout',
    [
      if (result.fileFormat != null) result.fileFormat!.name,
      plural(result.groups.length, 'group'),
      plural(result.keyCount, 'key'),
    ].join(', '),
  ]);

  final source = options.source;

  if (source != null) {
    rows.add(['Sources', relativeTo(source, context.cwd)]);
  }

  return [for (final row in rows) '$_indentSection${paint.dim(padTo(row[0], 9))}${row[1]}'];
}

/// One line per issue, plus a second one when the issue has more to say.
List<String> _itemLines(
  List<Chki18nIssue> issues,
  Chki18nReportContext context,
  bool showLocale,
  int keyWidth,
) {
  final paint = context.paint;
  final result = context.result;
  final localeWidth = widestOf([for (final issue in issues) showLocale ? issue.locale : '']);
  final lines = <String>[];

  for (final issue in issues) {
    final key = keyLabelOf(issue, context.showGroup);

    if (key.isEmpty) {
      // A bad option or an unreadable file has no key to name; the message is
      // the whole finding.
      lines.addAll([
        for (final line in wrap(issue.message, context.width - _indentItem.length))
          '$_indentItem${paint.value(line)}',
      ]);
      continue;
    }

    final locale = localeWidth > 0 ? '${padTo(showLocale ? issue.locale : '', localeWidth)}  ' : '';
    final room = context.width - _indentItem.length - displayWidth(locale) - keyWidth - 2;
    final rawReference = referenceOf(issue, result.target);
    final reference = rawReference.isEmpty ? '' : truncate(rawReference, room < 16 ? 16 : room);
    final cut = truncate(key, keyWidth);
    // Padded only when something follows it, so a line that ends on the key
    // does not end on the spaces that would have lined the next column up.
    final label = reference.isEmpty ? cut : padTo(cut, keyWidth);

    lines.add(
      '$_indentItem${paint.dim(locale)}${paint.key(label)}'
      '${reference.isEmpty ? '' : '  ${paint.value(reference)}'}',
    );

    final detail = detailOf(issue);

    if (detail.isNotEmpty) {
      lines.addAll([
        for (final line in wrap(detail, context.width - _indentDetail.length))
          '$_indentDetail${paint.dim(line)}',
      ]);
    }
  }

  return lines;
}

/// What a check means, but only where an issue does not already say it in its
/// own words. Repeating both would print the same sentence twice for every
/// finding.
List<String> _descriptionLine(
  List<Chki18nIssue> issues,
  Chki18nReportContext context,
  String indent,
) {
  final description = checkMeta[issues.first.code]?.description;

  if (description == null ||
      description.isEmpty ||
      issues.every((issue) => detailOf(issue).isNotEmpty)) {
    return const [];
  }

  return [
    for (final line in wrap(description, context.width - indent.length))
      '$indent${context.paint.dim(line)}',
  ];
}

/// The column every key in a section lines up to, however it is sub-grouped.
int _keyColumnOf(Chki18nIssueGroup section, Chki18nReportContext context) {
  final widest = widestOf([
    for (final issue in section.issues) keyLabelOf(issue, context.showGroup),
  ]);

  return widest < _maxKeyColumn ? widest : _maxKeyColumn;
}

/// A section that already is one check: its meaning once, then the findings.
List<String> _checkSection(Chki18nIssueGroup section, Chki18nReportContext context) => [
  '',
  ..._descriptionLine(section.issues, context, _indentSection),
  ..._itemLines(section.issues, context, true, _keyColumnOf(section, context)),
];

/// A section holding several checks, each under a heading of its own.
List<String> _mixedSection(Chki18nIssueGroup section, Chki18nReportContext context) {
  final paint = context.paint;
  final keyWidth = _keyColumnOf(section, context);
  final lines = <String>[];

  // Keyed by severity as well as by check: one check can report at two levels
  // once `levels` re-grades it, and a heading that says ERROR must not stand
  // over a line that is only a note.
  for (final part in subGroupIssues(
    section.issues,
    (issue) => '${issue.level.name} ${issue.code.code}',
  )) {
    final first = part.issues.first;

    lines.addAll([
      '',
      '$_indentSection'
          '${paintOfLevel(paint, first.level)(padTo(first.level.name.toUpperCase(), 5))}  '
          '${paint.heading(first.code.code)}${paint.dim(' (${part.issues.length})')}',
      ..._descriptionLine(part.issues, context, '$_indentSection${' ' * 7}'),
      ..._itemLines(part.issues, context, false, keyWidth),
    ]);
  }

  return lines;
}

Map<String, Chki18nLevelCount> _tally(
  List<Chki18nIssue> issues,
  String Function(Chki18nIssue issue) by,
) {
  final counts = <String, Chki18nLevelCount>{};

  for (final issue in issues) {
    (counts[by(issue)] ??= Chki18nLevelCount()).add(issue.level);
  }

  return counts;
}

/// The axis the sections did not use.
///
/// Grouping by locale leaves the reader wondering which checks fired, and
/// grouping by check leaves them wondering which language is behind; this
/// answers whichever question is still open.
List<String> _crossTabRows(Chki18nReportContext context) {
  final result = context.result;
  final paint = context.paint;
  final byLocale = context.options.groupBy == Chki18nGroupBy.code;
  final counts = _tally(context.issues, (issue) => byLocale ? issue.locale : issue.code.code);

  if (byLocale) {
    // A language with nothing wrong is worth saying out loud, so every locale
    // that took part gets a row.
    for (final locale in result.locales) {
      counts.putIfAbsent(locale, Chki18nLevelCount.new);
    }
  }

  final rows =
      counts.entries.map((entry) => (label: entry.key, count: entry.value)).toList()..sort((a, b) {
        final byError = b.count.error - a.count.error;

        if (byError != 0) {
          return byError;
        }

        final byWarn = b.count.warn - a.count.warn;

        if (byWarn != 0) {
          return byWarn;
        }

        final byInfo = b.count.info - a.count.info;

        return byInfo != 0 ? byInfo : a.label.compareTo(b.label);
      });

  if (rows.isEmpty) {
    return const [];
  }

  final widest = widestOf([for (final row in rows) row.label.isEmpty ? generalLabel : row.label]);
  final labelWidth = widest < _maxLabelColumn ? widest : _maxLabelColumn;

  return [
    '',
    '$_indentSection${paint.dim(byLocale ? 'By locale' : 'By check')}',
    for (final row in rows)
      '$_indentItem'
          '${paint.key(padTo(truncate(row.label.isEmpty ? generalLabel : row.label, labelWidth), labelWidth))}'
          '  ${countsPhrase(row.count, paint).text}',
  ];
}

List<String> _summaryBlock(Chki18nReportContext context) {
  final result = context.result;
  final paint = context.paint;
  final lines = <String>[
    '',
    '$_indentSection${paint.dim(scopeSentence(result))}',
    '$_indentSection'
        '${countsPhrase(Chki18nLevelCount(error: result.summary.error, warn: result.summary.warn, info: result.summary.info), paint).text}',
  ];

  if (context.hidden > 0) {
    lines.add(
      '$_indentSection'
      '${paint.dim('${plural(context.hidden, 'issue')} not shown, because of the level options.')}',
    );
  }

  final clean =
      context.options.groupBy == Chki18nGroupBy.locale
          ? [
            for (final locale in result.locales)
              if (!context.sections.any((section) => section.id == locale)) locale,
          ]
          : const <String>[];

  if (clean.isNotEmpty) {
    lines.add('$_indentSection${paint.dim('Clean: ${clean.join(', ')}')}');
  }

  return [...lines, ..._crossTabRows(context)];
}

String _verdictLine(Chki18nReportContext context) {
  final result = context.result;
  final paint = context.paint;

  if (result.success) {
    return ' ${paint.pass(' PASS ')} ${paint.dim('No error level issue was found.')}';
  }

  return ' ${paint.fail(' FAIL ')} '
      '${plural(result.summary.error, 'error')} must be fixed before this passes.';
}

/// The report as a terminal reads it: a heading block, one section per group of
/// issues, and a summary that answers the question the grouping did not.
String formatPretty(Chki18nReportContext context) {
  final options = context.options;
  final paint = context.paint;
  final lines = <String>[];

  if (options.info) {
    lines.addAll(_headBlock(context));
  }

  for (final section in context.sections) {
    lines.addAll(['', _ruleLine(section.label, countsPhrase(section.counts, paint), context)]);
    lines.addAll(
      options.groupBy == Chki18nGroupBy.code
          ? _checkSection(section, context)
          : _mixedSection(section, context),
    );
  }

  if (context.sections.isEmpty) {
    lines.addAll(['', '$_indentSection${paint.dim('Nothing to report.')}']);
  }

  if (options.info) {
    lines.addAll(['', _ruleLine('Summary', null, context), ..._summaryBlock(context)]);
  }

  lines.addAll(['', _verdictLine(context)]);

  return lines.join('\n');
}
