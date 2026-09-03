/// Rendering a finished result as text.
library;

import 'dart:convert';

import 'package:chki18n/src/constants.dart';
import 'package:chki18n/src/reporter/context.dart';
import 'package:chki18n/src/reporter/github.dart';
import 'package:chki18n/src/reporter/list.dart';
import 'package:chki18n/src/reporter/markdown.dart';
import 'package:chki18n/src/reporter/pretty.dart';
import 'package:chki18n/src/types.dart';

const JsonEncoder _json = JsonEncoder.withIndent('  ');

/// Renders a finished result as text.
///
/// Which reporter runs is the only thing that changes between a terminal, a
/// file and another tool's input: the checks, the counts and the order are the
/// same in all of them, so a report can be re-rendered without re-running the
/// scan.
String formatResult(
  Chki18nResult result,
  Chki18nResolvedOptions options, [
  Chki18nReportInit init = const Chki18nReportInit(),
]) {
  final reporter = init.reporter ?? options.reporter;

  // The whole result, unfiltered: `no-warn` shapes what a person reads, and a
  // program asking for JSON wants everything that was found.
  if (reporter == Chki18nReporter.json) {
    return _json.convert(result.toJson());
  }

  final context = buildReportContext(result, options, init);

  return switch (reporter) {
    Chki18nReporter.list => formatList(context),
    Chki18nReporter.markdown => formatMarkdown(context),
    Chki18nReporter.github => formatGitHub(context),
    Chki18nReporter.json || Chki18nReporter.pretty => formatPretty(context),
  };
}
