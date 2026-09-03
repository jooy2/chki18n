"""One line per issue and nothing else."""

from __future__ import annotations

from chki18n.reporter.context import ReportContext
from chki18n.reporter.paint import paint_of_level
from chki18n.reporter.text import (
    counts_sentence,
    detail_of,
    key_label_of,
    pad_to,
    reference_of,
    scope_sentence,
    widest_of,
)


def format_list(context: ReportContext) -> str:
    """One line per issue and nothing else.

    The output survives a `grep`, a diff or an editor that parses each line on
    its own. Sections are dropped, but the chosen grouping still decides the
    order, keeping related lines together.
    """
    issues = [issue for section in context.sections for issue in section.issues]
    locales = [issue.locale or "-" for issue in issues]
    codes = [issue.code for issue in issues]
    keys = [key_label_of(issue, context.show_group) or "-" for issue in issues]
    details = [
        "  ".join(
            part for part in (reference_of(issue, context.result.target), detail_of(issue)) if part
        )
        for issue in issues
    ]

    locale_width = widest_of(locales)
    code_width = widest_of(codes)
    key_width = widest_of(keys)
    paint = context.paint

    lines = [
        "  ".join(
            [
                pad_to(locales[index], locale_width),
                paint_of_level(paint, issue.level)(pad_to(issue.level, 5)),
                paint.heading(pad_to(codes[index], code_width)),
                paint.key(pad_to(keys[index], key_width)),
                paint.value(details[index]),
            ]
        ).rstrip()
        for index, issue in enumerate(issues)
    ]

    if not context.options.info:
        return "\n".join(lines)

    summary = f"{counts_sentence(context.result.summary)} {scope_sentence(context.result)}"

    # Nothing to separate from when there are no findings, so no blank line.
    return "\n".join([*lines, "", summary] if lines else [summary])
