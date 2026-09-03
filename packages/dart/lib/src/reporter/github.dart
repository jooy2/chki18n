/// Workflow commands, so GitHub Actions annotates the files themselves.
library;

import 'package:chki18n/src/constants.dart';
import 'package:chki18n/src/reporter/context.dart';
import 'package:chki18n/src/reporter/text.dart';

/// What GitHub calls each of our severities.
const Map<Chki18nLevel, String> _annotation = {
  Chki18nLevel.error: 'error',
  Chki18nLevel.warn: 'warning',
  Chki18nLevel.info: 'notice',
};

/// A workflow command ends at the first newline, and a literal `%` would be
/// read as the start of an escape, so both have to be encoded before they are
/// written.
String _escapeData(String value) =>
    value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');

/// A property value additionally ends at a `,` and its name ends at a `:`.
String _escapeProperty(String value) =>
    _escapeData(value).replaceAll(':', '%3A').replaceAll(',', '%2C');

/// Workflow commands, one per issue, which GitHub Actions turns into
/// annotations on the files themselves — so a reviewer sees each finding on the
/// line of the pull request it belongs to rather than in a log nobody opens.
///
/// There is no line number to give: the checks work on parsed translations, and
/// the commonest finding of all is a key that is not in the file to begin with.
/// An annotation without one attaches to the file, which is the right
/// granularity for a missing or mistranslated key anyway.
String formatGitHub(Chki18nReportContext context) {
  final result = context.result;
  final lines = <String>[];

  for (final section in context.sections) {
    for (final issue in section.issues) {
      final file = issue.file;
      final properties = [
        if (file != null) 'file=${_escapeProperty(relativeTo(file, context.cwd))}',
        'title=${_escapeProperty('chki18n ${issue.code.code}')}',
      ].join(',');
      final reference = referenceOf(issue, result.target);
      final message = [
        [
          issue.locale,
          keyLabelOf(issue, context.showGroup),
        ].where((part) => part.isNotEmpty).join(' '),
        issue.message,
        if (reference.isNotEmpty) '($reference)',
      ].where((part) => part.isNotEmpty).join(' ');

      lines.add('::${_annotation[issue.level]} $properties::${_escapeData(message)}');
    }
  }

  if (!context.options.info) {
    return lines.join('\n');
  }

  // Plain text rather than a command: a run's totals belong in the log, not as
  // one more annotation for a reviewer to dismiss.
  return [...lines, '${countsSentence(result.summary)} ${scopeSentence(result)}'].join('\n');
}
