/// Everything a formatter reads, worked out once and shared by all of them.
library;

import 'package:chki18n/src/constants.dart';
import 'package:chki18n/src/reporter/group.dart';
import 'package:chki18n/src/reporter/paint.dart';
import 'package:chki18n/src/types.dart';

/// How a report is rendered, beyond what the options already say.
class Chki18nReportInit {
  /// Creates the overrides one rendering needs.
  const Chki18nReportInit({this.reporter, this.color, this.width, this.cwd});

  /// Overrides `options.reporter`. The file output renders its own.
  final Chki18nReporter? reporter;

  /// Overrides `options.color`. A file never gets escape codes.
  final bool? color;

  /// Column to lay the report out to. Defaults to [defaultReportWidth].
  final int? width;

  /// Working directory, so a path can be shown relative to it.
  final String? cwd;
}

/// Sanity bounds only. The caller decides the width; these keep a wrong answer
/// from producing a report with no room for a key or one nothing can display.
const int _minWidth = 40;

const int _maxWidth = 400;

/// Everything a formatter reads, worked out once and shared by all of them.
class Chki18nReportContext {
  /// Creates the shared context. Prefer [buildReportContext].
  Chki18nReportContext({
    required this.result,
    required this.options,
    required this.issues,
    required this.sections,
    required this.hidden,
    required this.counts,
    required this.paint,
    required this.width,
    required this.cwd,
    required this.showGroup,
  });

  /// The result being rendered.
  final Chki18nResult result;

  /// The options the run was made with.
  final Chki18nResolvedOptions options;

  /// The issues the level filter kept, in report order.
  final List<Chki18nIssue> issues;

  /// Those issues split into the sections the report prints.
  final List<Chki18nIssueGroup> sections;

  /// How many issues `no-warn` and `no-info` removed.
  final int hidden;

  /// Levels of the kept issues, which is what the sections add up to.
  final Chki18nLevelCount counts;

  /// The palette the report paints with.
  final Chki18nPaint paint;

  /// Column the report is laid out to.
  final int width;

  /// Working directory, so a path can be shown relative to it.
  final String cwd;

  /// Whether a key needs its group named to be addressed without ambiguity.
  final bool showGroup;
}

/// Works out everything the formatters share, once.
Chki18nReportContext buildReportContext(
  Chki18nResult result,
  Chki18nResolvedOptions options, [
  Chki18nReportInit init = const Chki18nReportInit(),
]) {
  final issues = [
    for (final issue in result.issues)
      if ((issue.level != Chki18nLevel.warn || options.warn) &&
          (issue.level != Chki18nLevel.info || options.info))
        issue,
  ];
  final counts = Chki18nLevelCount();

  for (final issue in issues) {
    counts.add(issue.level);
  }

  final cwd = init.cwd ?? '';
  final asked = init.width == null || init.width == 0 ? defaultReportWidth : init.width!;
  final width = asked < _minWidth ? _minWidth : (asked > _maxWidth ? _maxWidth : asked);

  return Chki18nReportContext(
    result: result,
    options: options,
    issues: issues,
    sections: groupIssues(issues, options.groupBy, cwd),
    hidden: result.issues.length - issues.length,
    counts: counts,
    paint: createPaint(init.color ?? options.color),
    width: width,
    cwd: cwd,
    // A section that already is a group or a file has named it in its heading.
    showGroup:
        result.groups.length > 1 &&
        options.groupBy != Chki18nGroupBy.group &&
        options.groupBy != Chki18nGroupBy.file,
  );
}
