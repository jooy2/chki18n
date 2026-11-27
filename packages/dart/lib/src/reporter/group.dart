/// Splitting issues into the sections a report prints, and the order they go
/// in.
library;

import 'package:chki18n/src/constants.dart';
import 'package:chki18n/src/reporter/text.dart';
import 'package:chki18n/src/types.dart';

/// Issues sharing one value of the grouping axis, ready to be printed.
class Chki18nIssueGroup {
  /// Creates one section.
  Chki18nIssueGroup({
    required this.id,
    required this.label,
    required this.issues,
    required this.counts,
  });

  /// The axis value itself, e.g. a locale code. Empty when the issue has none.
  final String id;

  /// What the report prints as this section's heading.
  final String label;

  /// The issues in this section, in report order.
  final List<Chki18nIssue> issues;

  /// What the section adds up to.
  final Chki18nLevelCount counts;
}

/// Issues about the run itself rather than about one locale or one file.
const String generalLabel = '(general)';

/// The unnamed group a single set of translation files forms.
const String defaultGroupLabel = '(default)';

/// Report order within a section: what fails the run first, then the checks in
/// the order they are declared, then alphabetically.
///
/// Two runs over unchanged files therefore print the same lines in the same
/// places, which is what makes a saved report worth diffing.
int compareIssues(Chki18nIssue a, Chki18nIssue b) {
  // Both enums are declared in report order, error first and `NO_KEY` before
  // the checks that come after it, so the position of each is its rank.
  final byLevel = a.level.index - b.level.index;

  if (byLevel != 0) {
    return byLevel;
  }

  final byCode = a.code.index - b.code.index;

  if (byCode != 0) {
    return byCode;
  }

  final byLocale = a.locale.compareTo(b.locale);

  return byLocale != 0 ? byLocale : a.key.compareTo(b.key);
}

/// Sorts [list] by [compare], keeping the ones it calls equal in the order
/// they were in.
///
/// `List.sort` makes no such promise, and two findings about one key, such as
/// a missing and an extra tag, could trade places and be reported in another
/// order than the other two packages report them, whose sorts are stable.
void _sortStably<T>(List<T> list, int Function(T a, T b) compare) {
  // Positions are sorted rather than pairs of position and item, so the sort
  // moves plain integers and nothing is allocated per item.
  final items = List<T>.of(list);
  final order = List<int>.generate(items.length, (index) => index)..sort((a, b) {
    final byItem = compare(items[a], items[b]);

    return byItem != 0 ? byItem : a - b;
  });

  for (var index = 0; index < items.length; index += 1) {
    list[index] = items[order[index]];
  }
}

String _axisValueOf(Chki18nIssue issue, Chki18nGroupBy groupBy) => switch (groupBy) {
  Chki18nGroupBy.code => issue.code.code,
  Chki18nGroupBy.group => issue.group,
  Chki18nGroupBy.file => issue.file ?? '',
  Chki18nGroupBy.locale => issue.locale,
  Chki18nGroupBy.none => '',
};

String _labelOf(String id, Chki18nGroupBy groupBy, String cwd) {
  if (groupBy == Chki18nGroupBy.none) {
    return '';
  }

  if (groupBy == Chki18nGroupBy.group) {
    return id.isEmpty ? defaultGroupLabel : id;
  }

  if (id.isEmpty) {
    return generalLabel;
  }

  return groupBy == Chki18nGroupBy.file ? relativeTo(id, cwd) : id;
}

/// A section with an error outranks one with only warnings, and so on down.
int _severityRank(Chki18nLevelCount counts) {
  if (counts.error > 0) {
    return 0;
  }

  return counts.warn > 0 ? 1 : 2;
}

/// Splits issues into the sections a report prints, worst section first.
///
/// Issues that carry no value for the chosen axis — a bad option has no locale
/// — collect into one leading section rather than being dropped.
List<Chki18nIssueGroup> groupIssues(
  List<Chki18nIssue> issues,
  Chki18nGroupBy groupBy, [
  String cwd = '',
]) {
  final sections = <String, Chki18nIssueGroup>{};

  for (final issue in issues) {
    final id = _axisValueOf(issue, groupBy);
    final section = sections.putIfAbsent(
      id,
      () => Chki18nIssueGroup(
        id: id,
        label: _labelOf(id, groupBy, cwd),
        issues: <Chki18nIssue>[],
        counts: Chki18nLevelCount(),
      ),
    );

    section.issues.add(issue);
    section.counts.add(issue.level);
  }

  for (final section in sections.values) {
    _sortStably(section.issues, compareIssues);
  }

  final ordered =
      sections.values.toList()..sort((a, b) {
        final bySeverity = _severityRank(a.counts) - _severityRank(b.counts);

        if (bySeverity != 0) {
          return bySeverity;
        }

        final byError = b.counts.error - a.counts.error;

        if (byError != 0) {
          return byError;
        }

        final byWarn = b.counts.warn - a.counts.warn;

        if (byWarn != 0) {
          return byWarn;
        }

        if (groupBy == Chki18nGroupBy.code) {
          final left = Chki18nCheckCode.parse(a.id);
          final right = Chki18nCheckCode.parse(b.id);

          final last = Chki18nCheckCode.values.length;

          return (left?.index ?? last) - (right?.index ?? last);
        }

        return a.id.compareTo(b.id);
      });

  return ordered;
}

/// One sub-heading's worth of issues inside a section.
class Chki18nIssueSubGroup {
  /// Creates one sub-group.
  Chki18nIssueSubGroup({required this.id, required this.issues, required this.counts});

  /// What the issues of this sub-group have in common.
  final String id;

  /// The issues themselves, in the order they were reported.
  final List<Chki18nIssue> issues;

  /// What the sub-group adds up to.
  final Chki18nLevelCount counts;
}

/// The same split one level down, for the sub-headings inside a section.
List<Chki18nIssueSubGroup> subGroupIssues(
  List<Chki18nIssue> issues,
  String Function(Chki18nIssue issue) by,
) {
  final parts = <Chki18nIssueSubGroup>[];
  final index = <String, int>{};

  for (final issue in issues) {
    final id = by(issue);
    final at = index.putIfAbsent(id, () {
      parts.add(
        Chki18nIssueSubGroup(id: id, issues: <Chki18nIssue>[], counts: Chki18nLevelCount()),
      );

      return parts.length - 1;
    });

    parts[at].issues.add(issue);
    parts[at].counts.add(issue.level);
  }

  return parts;
}
