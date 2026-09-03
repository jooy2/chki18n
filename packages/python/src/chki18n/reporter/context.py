"""Everything a formatter reads, worked out once and shared by all of them."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Final

from chki18n._types import Issue, LevelCount, ResolvedOptions, Result
from chki18n.constants import DEFAULT_REPORT_WIDTH, Reporter
from chki18n.reporter.group import IssueGroup, group_issues
from chki18n.reporter.paint import Paint, create_paint


@dataclass(frozen=True, slots=True, kw_only=True)
class ReportInit:
    """How a report is rendered, beyond what the options already say."""

    #: Overrides `options.reporter`. The file output renders its own.
    reporter: Reporter | None = None
    #: Overrides `options.color`. A file never gets escape codes.
    color: bool | None = None
    #: Column to lay the report out to. Defaults to `DEFAULT_REPORT_WIDTH`.
    width: int | None = None
    #: Working directory, so a path can be shown relative to it.
    cwd: str = ""


#: Sanity bounds only. The caller decides the width; these keep a wrong answer
#: from producing a report with no room for a key or one nothing can display.
_MIN_WIDTH: Final = 40

_MAX_WIDTH: Final = 400


@dataclass(slots=True)
class ReportContext:
    """Everything a formatter reads, worked out once and shared by all of them."""

    #: The result being rendered.
    result: Result
    #: The options the run was made with.
    options: ResolvedOptions
    #: The issues the level filter kept, in report order.
    issues: list[Issue]
    #: Those issues split into the sections the report prints.
    sections: list[IssueGroup]
    #: How many issues `no-warn` and `no-info` removed.
    hidden: int
    #: Levels of the kept issues, which is what the sections add up to.
    counts: LevelCount
    #: The palette the report paints with.
    paint: Paint
    #: Column the report is laid out to.
    width: int
    #: Working directory, so a path can be shown relative to it.
    cwd: str
    #: Whether a key needs its group named to be addressed without ambiguity.
    show_group: bool = field(default=False)


def build_report_context(
    result: Result,
    options: ResolvedOptions,
    init: ReportInit | None = None,
) -> ReportContext:
    """Work out everything the formatters share, once."""
    settings = init if init is not None else ReportInit()
    issues = [
        issue
        for issue in result.issues
        if (issue.level != "warn" or options.warn) and (issue.level != "info" or options.info)
    ]
    counts = LevelCount()

    for issue in issues:
        counts.add(issue.level)

    asked = settings.width or DEFAULT_REPORT_WIDTH
    width = min(_MAX_WIDTH, max(_MIN_WIDTH, asked))

    return ReportContext(
        result=result,
        options=options,
        issues=issues,
        sections=group_issues(issues, options.group_by, settings.cwd),
        hidden=len(result.issues) - len(issues),
        counts=counts,
        paint=create_paint(settings.color if settings.color is not None else options.color),
        width=width,
        cwd=settings.cwd,
        # A section that already is a group or a file has named it in its heading.
        show_group=(
            len(result.groups) > 1 and options.group_by != "group" and options.group_by != "file"
        ),
    )
