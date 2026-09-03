"""The report as a document: a heading per section and a table of findings."""

from __future__ import annotations

from chki18n.reporter.context import ReportContext
from chki18n.reporter.text import (
    counts_sentence,
    detail_of,
    key_label_of,
    pad_to,
    plural,
    reference_of,
    scope_sentence,
    widest_of,
)


def _cell(text: str) -> str:
    """A cell may hold a translated value, and a `|` in one would split the row."""
    return text.replace("|", "\\|")


def _code(text: str) -> str:
    return f"`{_cell(text)}`" if text else ""


def _table(header: list[str], rows: list[list[str]]) -> list[str]:
    """A table with its columns padded in the source.

    That is how every Markdown file in this project is written, and what keeps
    the raw text readable when whatever renders it does not.
    """
    widths = [
        widest_of([title, *(row[column] for row in rows)]) for column, title in enumerate(header)
    ]

    def line(cells: list[str]) -> str:
        padded = " | ".join(pad_to(cell, widths[column]) for column, cell in enumerate(cells))

        return f"| {padded} |"

    return [
        line(header),
        "| " + " | ".join("-" * width for width in widths) + " |",
        *(line(row) for row in rows),
    ]


def format_markdown(context: ReportContext) -> str:
    """The report as a document, for a pull request comment or a checked-in report."""
    result = context.result
    lines: list[str] = [
        "# Translation check",
        "",
        f"**{counts_sentence(result.summary)}** {scope_sentence(result)} "
        f"Compared against `{result.target}`.",
    ]

    by_code = context.options.group_by == "code"

    for section in context.sections:
        lines.extend(["", f"## {section.label or 'Issues'}", ""])
        lines.extend(
            _table(
                ["Level", "Locale" if by_code else "Check", "Key", "Value", "Note"],
                [
                    [
                        issue.level,
                        _code(issue.locale if by_code else issue.code),
                        _code(key_label_of(issue, context.show_group)),
                        _cell(reference_of(issue, result.target)),
                        _cell(detail_of(issue)),
                    ]
                    for issue in section.issues
                ],
            )
        )

    if not context.sections:
        lines.extend(["", "Nothing to report."])

    if context.hidden > 0:
        lines.extend(
            ["", f"{plural(context.hidden, 'issue')} not shown, because of the level options."]
        )

    return "\n".join(lines)
