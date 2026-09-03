"""Building a finding, and counting a set of them."""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from chki18n._types import Issue, LevelCount, Summary
from chki18n.constants import CHECK_META, CheckCode, Level


def create_issue(
    code: CheckCode,
    *,
    level: Level | None = None,
    message: str | None = None,
    locale: str = "",
    key: str = "",
    group: str = "",
    value: str | None = None,
    target_value: str | None = None,
    interpolation: str | None = None,
    related_key: str | None = None,
    file: str | None = None,
) -> Issue:
    """Build an issue, taking its severity and its default description from `CHECK_META`.

    No call site has to repeat either, so a check whose wording changes changes
    in one place.
    """
    meta = CHECK_META.get(code, CHECK_META["UNKNOWN"])

    return Issue(
        code=code,
        level=level if level is not None else meta.level,
        message=message if message is not None else meta.description,
        locale=locale,
        key=key,
        group=group,
        value=value,
        target_value=target_value,
        interpolation=interpolation,
        related_key=related_key,
        file=file,
    )


def apply_level_overrides(
    issues: list[Issue],
    levels: Mapping[CheckCode, Level] | None,
) -> list[Issue]:
    """Re-grade issues whose check the caller asked to report at another severity.

    Applied to a finished list rather than at every call site, so a check that
    builds its issues in several places cannot be left half converted. The list
    is rewritten in place and handed back, which is what lets a caller keep the
    reference it already has.
    """
    if not levels:
        return issues

    for index, issue in enumerate(issues):
        level = levels.get(issue.code)

        if level is not None:
            issues[index] = issue.with_level(level)

    return issues


def group_issues_by_code(issues: Sequence[Issue]) -> dict[CheckCode, list[Issue]]:
    """Group issues by check code, in the order the codes were first seen."""
    grouped: dict[CheckCode, list[Issue]] = {}

    for issue in issues:
        grouped.setdefault(issue.code, []).append(issue)

    return grouped


def summarize_issues(issues: Sequence[Issue]) -> Summary:
    """Totals per level, per check code, per locale and per group, in one pass."""
    by_code: dict[CheckCode, int] = {}
    by_locale: dict[str, LevelCount] = {}
    by_group: dict[str, LevelCount] = {}
    levels = LevelCount()

    for issue in issues:
        levels.add(issue.level)
        by_code[issue.code] = by_code.get(issue.code, 0) + 1

        if issue.locale:
            by_locale.setdefault(issue.locale, LevelCount()).add(issue.level)

        by_group.setdefault(issue.group, LevelCount()).add(issue.level)

    return Summary(
        error=levels.error,
        warn=levels.warn,
        info=levels.info,
        total=len(issues),
        by_code=by_code,
        by_locale=by_locale,
        by_group=by_group,
    )


def has_error(issues: Sequence[Issue]) -> bool:
    """A run fails only on `error` level issues; warnings never block."""
    return any(issue.level == "error" for issue in issues)
