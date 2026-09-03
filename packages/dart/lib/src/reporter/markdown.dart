/// The report as a document: a heading per section and a table of findings.
library;

import 'package:chki18n/src/constants.dart';
import 'package:chki18n/src/reporter/context.dart';
import 'package:chki18n/src/reporter/text.dart';

/// A cell may hold a translated value, and a `|` in one would split the row.
String _cell(String text) => text.replaceAll('|', r'\|');

String _code(String text) => text.isEmpty ? '' : '`${_cell(text)}`';

/// A table with its columns padded in the source, which is how every Markdown
/// file in this project is written and what keeps the raw text readable when
/// whatever renders it does not.
List<String> _table(List<String> header, List<List<String>> rows) {
  final widths = [
    for (var column = 0; column < header.length; column += 1)
      widestOf([header[column], for (final row in rows) row[column]]),
  ];

  String line(List<String> cells) =>
      '| ${[for (var column = 0; column < cells.length; column += 1) padTo(cells[column], widths[column])].join(' | ')} |';

  return [
    line(header),
    '| ${[for (final width in widths) '-' * width].join(' | ')} |',
    for (final row in rows) line(row),
  ];
}

/// The report as a document, for a pull request comment or a report checked in
/// beside the translations.
String formatMarkdown(Chki18nReportContext context) {
  final result = context.result;
  final lines = <String>[
    '# Translation check',
    '',
    '**${countsSentence(result.summary)}** ${scopeSentence(result)} '
        'Compared against `${result.target}`.',
  ];

  final byCode = context.options.groupBy == Chki18nGroupBy.code;

  for (final section in context.sections) {
    lines.addAll(['', '## ${section.label.isEmpty ? 'Issues' : section.label}', '']);
    lines.addAll(
      _table(
        ['Level', byCode ? 'Locale' : 'Check', 'Key', 'Value', 'Note'],
        [
          for (final issue in section.issues)
            [
              issue.level.name,
              _code(byCode ? issue.locale : issue.code.code),
              _code(keyLabelOf(issue, context.showGroup)),
              _cell(referenceOf(issue, result.target)),
              _cell(detailOf(issue)),
            ],
        ],
      ),
    );
  }

  if (context.sections.isEmpty) {
    lines.addAll(['', 'Nothing to report.']);
  }

  if (context.hidden > 0) {
    lines.addAll([
      '',
      '${plural(context.hidden, 'issue')} not shown, because of the level options.',
    ]);
  }

  return lines.join('\n');
}
