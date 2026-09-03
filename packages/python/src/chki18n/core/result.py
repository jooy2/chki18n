"""Assembling a result around a set of issues."""

from __future__ import annotations

from collections.abc import Sequence

from chki18n._types import Issue, ResolvedOptions, Result, SourceFile
from chki18n.constants import FileFormat
from chki18n.core.issue import group_issues_by_code, has_error, summarize_issues


def build_result(
    issues: list[Issue],
    options: ResolvedOptions,
    *,
    locales: Sequence[str] = (),
    groups: Sequence[str] = (),
    key_count: int = 0,
    files: Sequence[SourceFile] = (),
    file_format: FileFormat | None = None,
    elapsed_ms: int = 0,
) -> Result:
    """Assemble a result around a set of issues.

    Every entry point builds its result here, so a caller sees the same shape
    whether the translations came from disk, from memory or from a session. The
    counted fields are derived rather than taken as arguments: they follow from
    the issue list, and a caller that knows only part of it must not be able to
    state them.
    """
    return Result(
        success=not has_error(issues),
        issues=issues,
        issues_by_code=group_issues_by_code(issues),
        summary=summarize_issues(issues),
        target=options.target,
        locales=list(locales),
        groups=list(groups),
        key_count=key_count,
        files=list(files),
        file_format=file_format,
        elapsed_ms=elapsed_ms,
    )
