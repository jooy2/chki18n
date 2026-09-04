"""Workflow commands, so GitHub Actions annotates the files themselves."""

from __future__ import annotations

from typing import Final

from chki18n.constants import Level
from chki18n.reporter.context import ReportContext
from chki18n.reporter.text import (
    counts_sentence,
    key_label_of,
    reference_of,
    relative_to,
    scope_sentence,
)

#: What GitHub calls each of our severities.
_ANNOTATION: Final[dict[Level, str]] = {
    "error": "error",
    "warn": "warning",
    "info": "notice",
}


def _escape_data(value: str) -> str:
    """A command ends at the first newline, and a `%` starts an escape."""
    return value.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def _escape_property(value: str) -> str:
    """A property value additionally ends at a `,` and its name ends at a `:`."""
    return _escape_data(value).replace(":", "%3A").replace(",", "%2C")


def _annotation_path(path: str) -> str:
    r"""A path GitHub can match against the repository, which means forward slashes.

    An annotation carrying `locales\ko.json` attaches to nothing at all,
    silently, on a Windows runner.
    """
    return path.replace("\\", "/")


def format_github(context: ReportContext) -> str:
    """Workflow commands, one per issue, which GitHub Actions turns into annotations.

    A reviewer then sees each finding on the line of the pull request it belongs
    to rather than in a log nobody opens.

    There is no line number to give: the checks work on parsed translations, and
    the commonest finding of all is a key that is not in the file to begin with.
    An annotation without one attaches to the file, which is the right
    granularity for a missing or mistranslated key anyway.
    """
    result = context.result
    lines: list[str] = []

    for section in context.sections:
        for issue in section.issues:
            file = _annotation_path(relative_to(issue.file, context.cwd)) if issue.file else ""
            properties = ",".join(
                [
                    *([f"file={_escape_property(file)}"] if file else []),
                    f"title={_escape_property(f'chki18n {issue.code}')}",
                ]
            )
            reference = reference_of(issue, result.target)
            message = " ".join(
                part
                for part in (
                    " ".join(
                        one
                        for one in (issue.locale, key_label_of(issue, context.show_group))
                        if one
                    ),
                    issue.message,
                    f"({reference})" if reference else "",
                )
                if part
            )

            lines.append(f"::{_ANNOTATION[issue.level]} {properties}::{_escape_data(message)}")

    if not context.options.info:
        return "\n".join(lines)

    # Plain text rather than a command: a run's totals belong in the log, not as
    # one more annotation for a reviewer to dismiss.
    return "\n".join([*lines, f"{counts_sentence(result.summary)} {scope_sentence(result)}"])
