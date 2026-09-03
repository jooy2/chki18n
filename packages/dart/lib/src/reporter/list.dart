/// One line per issue and nothing else.
library;

import 'package:chki18n/src/reporter/context.dart';
import 'package:chki18n/src/reporter/paint.dart';
import 'package:chki18n/src/reporter/text.dart';

/// One line per issue and nothing else, so the output survives a `grep`, a
/// diff or an editor that parses each line on its own.
///
/// Sections are dropped, but the chosen grouping still decides the order,
/// keeping related lines together.
String formatList(Chki18nReportContext context) {
  final issues = [for (final section in context.sections) ...section.issues];
  final locales = [for (final issue in issues) issue.locale.isEmpty ? '-' : issue.locale];
  final codes = [for (final issue in issues) issue.code.code];
  final keys = [
    for (final issue in issues)
      keyLabelOf(issue, context.showGroup).isEmpty ? '-' : keyLabelOf(issue, context.showGroup),
  ];
  final details = [
    for (final issue in issues)
      [
        referenceOf(issue, context.result.target),
        detailOf(issue),
      ].where((part) => part.isNotEmpty).join('  '),
  ];

  final localeWidth = widestOf(locales);
  final codeWidth = widestOf(codes);
  final keyWidth = widestOf(keys);
  final paint = context.paint;

  final lines = [
    for (var index = 0; index < issues.length; index += 1)
      [
        padTo(locales[index], localeWidth),
        paintOfLevel(paint, issues[index].level)(padTo(issues[index].level.name, 5)),
        paint.heading(padTo(codes[index], codeWidth)),
        paint.key(padTo(keys[index], keyWidth)),
        paint.value(details[index]),
      ].join('  ').trimRight(),
  ];

  if (!context.options.info) {
    return lines.join('\n');
  }

  final summary = '${countsSentence(context.result.summary)} ${scopeSentence(context.result)}';

  // Nothing to separate from when there are no findings, so no blank line.
  return (lines.isNotEmpty ? [...lines, '', summary] : [summary]).join('\n');
}
