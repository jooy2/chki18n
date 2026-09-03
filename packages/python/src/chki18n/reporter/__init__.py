"""Rendering a finished result as text."""

from __future__ import annotations

import json

from chki18n._types import ResolvedOptions, Result
from chki18n.core.width import display_width
from chki18n.reporter.context import ReportContext, ReportInit, build_report_context
from chki18n.reporter.github import format_github
from chki18n.reporter.group import IssueGroup, IssueSubGroup, group_issues, sub_group_issues
from chki18n.reporter.list_report import format_list
from chki18n.reporter.markdown import format_markdown
from chki18n.reporter.paint import Paint, create_paint, paint_of_level
from chki18n.reporter.pretty import format_pretty
from chki18n.reporter.text import pad_to, truncate, widest_of


def format_result(
    result: Result,
    options: ResolvedOptions,
    init: ReportInit | None = None,
) -> str:
    """Render a finished result as text.

    Which reporter runs is the only thing that changes between a terminal, a file
    and another tool's input: the checks, the counts and the order are the same
    in all of them, so a report can be re-rendered without re-running the scan.
    """
    settings = init if init is not None else ReportInit()
    reporter = settings.reporter if settings.reporter is not None else options.reporter

    # The whole result, unfiltered: `no-warn` shapes what a person reads, and a
    # program asking for JSON wants everything that was found.
    if reporter == "json":
        return json.dumps(result.to_json(), indent=2, ensure_ascii=False)

    context = build_report_context(result, options, settings)

    if reporter == "list":
        return format_list(context)

    if reporter == "markdown":
        return format_markdown(context)

    if reporter == "github":
        return format_github(context)

    return format_pretty(context)


__all__ = [
    "IssueGroup",
    "IssueSubGroup",
    "Paint",
    "ReportContext",
    "ReportInit",
    "build_report_context",
    "create_paint",
    "display_width",
    "format_result",
    "group_issues",
    "pad_to",
    "paint_of_level",
    "sub_group_issues",
    "truncate",
    "widest_of",
]
