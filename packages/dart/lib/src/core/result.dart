/// Assembling a result around a set of issues.
library;

import 'package:chki18n/src/constants.dart';
import 'package:chki18n/src/core/issue.dart';
import 'package:chki18n/src/types.dart';

/// Assembles a result around a set of issues.
///
/// Every entry point builds its result here, so a caller sees the same shape
/// whether the translations came from disk, from memory or from a session. The
/// counted fields are derived rather than taken as arguments: they follow from
/// the issue list, and a caller that knows only part of it must not be able to
/// state them.
Chki18nResult buildResult(
  List<Chki18nIssue> issues,
  Chki18nResolvedOptions options, {
  List<String> locales = const [],
  List<String> groups = const [],
  int keyCount = 0,
  List<Chki18nSourceFile> files = const [],
  Chki18nFileFormat? fileFormat,
  int elapsedMs = 0,
}) {
  return Chki18nResult(
    locales: locales,
    groups: groups,
    keyCount: keyCount,
    files: files,
    fileFormat: fileFormat,
    elapsedMs: elapsedMs,
    target: options.target,
    success: !hasError(issues),
    issues: issues,
    issuesByCode: groupIssuesByCode(issues),
    summary: summarizeIssues(issues),
  );
}
