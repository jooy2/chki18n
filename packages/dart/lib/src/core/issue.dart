/// Building a finding, and counting a set of them.
library;

import 'package:chki18n/src/constants.dart';
import 'package:chki18n/src/types.dart';

/// Builds an issue, taking its severity and its default description from
/// [checkMeta] so no call site has to repeat them.
Chki18nIssue createIssue(
  Chki18nCheckCode code, {
  Chki18nLevel? level,
  String? message,
  String locale = '',
  String key = '',
  String group = '',
  String? value,
  String? targetValue,
  String? interpolation,
  String? relatedKey,
  String? file,
}) {
  final meta = checkMeta[code] ?? checkMeta[Chki18nCheckCode.unknown]!;

  return Chki18nIssue(
    code: code,
    level: level ?? meta.level,
    message: message ?? meta.description,
    locale: locale,
    key: key,
    group: group,
    value: value,
    targetValue: targetValue,
    interpolation: interpolation,
    relatedKey: relatedKey,
    file: file,
  );
}

/// Re-grades issues whose check the caller asked to report at another
/// severity.
///
/// Applied to a finished list rather than at every call site, so a check that
/// builds its issues in several places cannot be left half converted. The list
/// is rewritten in place and handed back, which is what lets a caller keep the
/// reference it already has.
List<Chki18nIssue> applyLevelOverrides(
  List<Chki18nIssue> issues,
  Map<Chki18nCheckCode, Chki18nLevel>? levels,
) {
  if (levels == null || levels.isEmpty) {
    return issues;
  }

  for (var index = 0; index < issues.length; index += 1) {
    final level = levels[issues[index].code];

    if (level != null) {
      issues[index] = issues[index].withLevel(level);
    }
  }

  return issues;
}

/// Groups issues by check code, in the order the codes were first seen.
Map<Chki18nCheckCode, List<Chki18nIssue>> groupIssuesByCode(List<Chki18nIssue> issues) {
  final grouped = <Chki18nCheckCode, List<Chki18nIssue>>{};

  for (final issue in issues) {
    (grouped[issue.code] ??= <Chki18nIssue>[]).add(issue);
  }

  return grouped;
}

/// Counts a consumer would otherwise have to derive itself: totals per level,
/// per check code, per locale and per group. Computed in one pass.
Chki18nSummary summarizeIssues(List<Chki18nIssue> issues) {
  final byCode = <Chki18nCheckCode, int>{};
  final byLocale = <String, Chki18nLevelCount>{};
  final byGroup = <String, Chki18nLevelCount>{};
  final levels = Chki18nLevelCount();

  for (final issue in issues) {
    levels.add(issue.level);
    byCode[issue.code] = (byCode[issue.code] ?? 0) + 1;

    if (issue.locale.isNotEmpty) {
      (byLocale[issue.locale] ??= Chki18nLevelCount()).add(issue.level);
    }

    (byGroup[issue.group] ??= Chki18nLevelCount()).add(issue.level);
  }

  return Chki18nSummary(
    error: levels.error,
    warn: levels.warn,
    info: levels.info,
    total: issues.length,
    byCode: byCode,
    byLocale: byLocale,
    byGroup: byGroup,
  );
}

/// A run fails only on `error` level issues; warnings never block.
bool hasError(List<Chki18nIssue> issues) =>
    issues.any((issue) => issue.level == Chki18nLevel.error);
