"""Splitting issues into the sections a report prints, and the order they go in."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Final

from chki18n._types import Issue, LevelCount
from chki18n.constants import CHECK_CODES, CheckCode, GroupBy, Level
from chki18n.reporter.text import relative_to


@dataclass(slots=True)
class IssueGroup:
    """Issues sharing one value of the grouping axis, ready to be printed."""

    #: The axis value itself, e.g. a locale code. Empty when the issue has none.
    id: str
    #: What the report prints as this section's heading.
    label: str
    #: The issues in this section, in report order.
    issues: list[Issue] = field(default_factory=list)
    #: What the section adds up to.
    counts: LevelCount = field(default_factory=LevelCount)


_CODE_ORDER: Final[dict[str, int]] = {code: index for index, code in enumerate(CHECK_CODES)}

_LEVEL_ORDER: Final[dict[Level, int]] = {"error": 0, "warn": 1, "info": 2}

#: Issues about the run itself rather than about one locale or one file.
GENERAL_LABEL: Final = "(general)"

#: The unnamed group a single set of translation files forms.
DEFAULT_GROUP_LABEL: Final = "(default)"


def _code_rank(code: str) -> int:
    return _CODE_ORDER.get(code, len(_CODE_ORDER))


def issue_sort_key(issue: Issue) -> tuple[int, int, str, str]:
    """Report order within a section.

    What fails the run first, then the checks in the order they are declared,
    then alphabetically. Two runs over unchanged files therefore print the same
    lines in the same places, which is what makes a saved report worth diffing.
    """
    return (_LEVEL_ORDER[issue.level], _code_rank(issue.code), issue.locale, issue.key)


def _axis_value_of(issue: Issue, group_by: GroupBy) -> str:
    if group_by == "code":
        return issue.code

    if group_by == "group":
        return issue.group

    if group_by == "file":
        return issue.file or ""

    return issue.locale if group_by == "locale" else ""


def _label_of(identifier: str, group_by: GroupBy, cwd: str) -> str:
    if group_by == "none":
        return ""

    if group_by == "group":
        return identifier or DEFAULT_GROUP_LABEL

    if not identifier:
        return GENERAL_LABEL

    return relative_to(identifier, cwd) if group_by == "file" else identifier


def _severity_rank(counts: LevelCount) -> int:
    """A section with an error outranks one with only warnings, and so on down."""
    if counts.error > 0:
        return 0

    return 1 if counts.warn > 0 else 2


def group_issues(
    issues: Sequence[Issue],
    group_by: GroupBy,
    cwd: str = "",
) -> list[IssueGroup]:
    """Split issues into the sections a report prints, worst section first.

    Issues that carry no value for the chosen axis — a bad option has no locale —
    collect into one leading section rather than being dropped.
    """
    sections: dict[str, IssueGroup] = {}

    for issue in issues:
        identifier = _axis_value_of(issue, group_by)
        section = sections.get(identifier)

        if section is None:
            section = IssueGroup(id=identifier, label=_label_of(identifier, group_by, cwd))
            sections[identifier] = section

        section.issues.append(issue)
        section.counts.add(issue.level)

    for section in sections.values():
        section.issues.sort(key=issue_sort_key)

    def order(section: IssueGroup) -> tuple[int, int, int, object]:
        return (
            _severity_rank(section.counts),
            -section.counts.error,
            -section.counts.warn,
            _code_rank(section.id) if group_by == "code" else section.id,
        )

    return sorted(sections.values(), key=order)


@dataclass(slots=True)
class IssueSubGroup:
    """One sub-heading's worth of issues inside a section."""

    #: What the issues of this sub-group have in common.
    id: str
    #: The issues themselves, in the order they were reported.
    issues: list[Issue] = field(default_factory=list)
    #: What the sub-group adds up to.
    counts: LevelCount = field(default_factory=LevelCount)


def sub_group_issues(
    issues: Sequence[Issue],
    by: Callable[[Issue], str],
) -> list[IssueSubGroup]:
    """The same split one level down, for the sub-headings inside a section."""
    parts: list[IssueSubGroup] = []
    index: dict[str, int] = {}

    for issue in issues:
        identifier = by(issue)
        at = index.get(identifier)

        if at is None:
            at = len(parts)
            index[identifier] = at
            parts.append(IssueSubGroup(id=identifier))

        parts[at].issues.append(issue)
        parts[at].counts.add(issue.level)

    return parts


def code_rank(code: CheckCode) -> int:
    """Where a check sits in the order the report lists them."""
    return _code_rank(code)
