"""The report as a terminal reads it."""

from __future__ import annotations

import re
from collections.abc import Callable, Sequence
from typing import Final

from chki18n._types import Issue, LevelCount
from chki18n.constants import CHECK_META
from chki18n.core.width import display_width
from chki18n.reporter.context import ReportContext
from chki18n.reporter.group import GENERAL_LABEL, IssueGroup, sub_group_issues
from chki18n.reporter.paint import paint_of_level
from chki18n.reporter.text import (
    counts_phrase,
    detail_of,
    key_label_of,
    pad_to,
    plural,
    reference_of,
    relative_to,
    scope_sentence,
    truncate,
    truncate_start,
    widest_of,
    wrap,
)

_INDENT_SECTION: Final = "  "

_INDENT_ITEM: Final = "    "

_INDENT_DETAIL: Final = "      "

#: Longest a column is allowed to grow before its content is cut short.
_MAX_KEY_COLUMN: Final = 40

_MAX_LABEL_COLUMN: Final = 30

_PATH_SEPARATOR: Final = re.compile(r"[/\\]")

#: The line a section heading trails off into. A box drawing character, so a rule
#: reads as a rule rather than as a row of hyphens.
_RULE: Final = "\u2500"


def _rule_line(
    label: str,
    right: tuple[str, int] | None,
    context: ReportContext,
) -> str:
    """A section heading: the label, a rule, and what the section adds up to."""
    paint = context.paint
    tail_length = right[1] + 1 if right is not None else 0
    # A long label is cut rather than allowed to push the counts past the edge
    # and wrap the rule onto a second line. A path keeps its tail, which is the
    # part that tells one file from another.
    room = max(12, context.width - tail_length - 5)
    cut: Callable[[str, int], str] = truncate_start if _PATH_SEPARATOR.search(label) else truncate
    head = f" {cut(label, room)} " if label else " "
    fill = max(3, context.width - display_width(head) - tail_length)

    return (
        f"{paint.heading(head)}{paint.dim(_RULE * fill)}"
        f"{f' {right[0]}' if right is not None else ''}"
    )


def _head_block(context: ReportContext) -> list[str]:
    """What the run was pointed at, above the findings themselves."""
    result = context.result
    options = context.options
    paint = context.paint
    rows: list[tuple[str, str]] = []

    if options.path:
        rows.append(("Path", relative_to(options.path, context.cwd)))

    rows.append(("Target", result.target))

    if result.locales:
        rows.append(("Locales", ", ".join(result.locales)))

    rows.append(
        (
            "Layout",
            ", ".join(
                part
                for part in (
                    result.file_format or "",
                    plural(len(result.groups), "group"),
                    plural(result.key_count, "key"),
                )
                if part
            ),
        )
    )

    if options.source:
        rows.append(("Sources", relative_to(options.source, context.cwd)))

    return [f"{_INDENT_SECTION}{paint.dim(pad_to(label, 9))}{value}" for label, value in rows]


def _item_lines(
    issues: Sequence[Issue],
    context: ReportContext,
    show_locale: bool,
    key_width: int,
) -> list[str]:
    """One line per issue, plus a second one when the issue has more to say."""
    paint = context.paint
    result = context.result
    locale_width = widest_of(issue.locale if show_locale else "" for issue in issues)
    lines: list[str] = []

    for issue in issues:
        key = key_label_of(issue, context.show_group)

        if not key:
            # A bad option or an unreadable file has no key to name; the message
            # is the whole finding.
            lines.extend(
                f"{_INDENT_ITEM}{paint.value(line)}"
                for line in wrap(issue.message, context.width - len(_INDENT_ITEM))
            )
            continue

        locale = (
            f"{pad_to(issue.locale if show_locale else '', locale_width)}  "
            if locale_width > 0
            else ""
        )
        room = context.width - len(_INDENT_ITEM) - display_width(locale) - key_width - 2
        raw_reference = reference_of(issue, result.target)
        reference = truncate(raw_reference, max(16, room)) if raw_reference else ""
        cut = truncate(key, key_width)
        # Padded only when something follows it, so a line that ends on the key
        # does not end on the spaces that would have lined the next column up.
        label = pad_to(cut, key_width) if reference else cut

        lines.append(
            f"{_INDENT_ITEM}{paint.dim(locale)}{paint.key(label)}"
            f"{f'  {paint.value(reference)}' if reference else ''}"
        )

        detail = detail_of(issue)

        if detail:
            lines.extend(
                f"{_INDENT_DETAIL}{paint.dim(line)}"
                for line in wrap(detail, context.width - len(_INDENT_DETAIL))
            )

    return lines


def _description_line(
    issues: Sequence[Issue],
    context: ReportContext,
    indent: str,
) -> list[str]:
    """What a check means, where an issue does not already say it in its own words.

    Repeating both would print the same sentence twice for every finding.
    """
    meta = CHECK_META.get(issues[0].code)

    if meta is None or not meta.description or all(detail_of(issue) for issue in issues):
        return []

    return [
        f"{indent}{context.paint.dim(line)}"
        for line in wrap(meta.description, context.width - len(indent))
    ]


def _key_column_of(section: IssueGroup, context: ReportContext) -> int:
    """The column every key in a section lines up to, however it is sub-grouped."""
    return min(
        _MAX_KEY_COLUMN,
        widest_of(key_label_of(issue, context.show_group) for issue in section.issues),
    )


def _check_section(section: IssueGroup, context: ReportContext) -> list[str]:
    """A section that already is one check: its meaning once, then the findings."""
    return [
        "",
        *_description_line(section.issues, context, _INDENT_SECTION),
        *_item_lines(section.issues, context, True, _key_column_of(section, context)),
    ]


def _mixed_section(section: IssueGroup, context: ReportContext) -> list[str]:
    """A section holding several checks, each under a heading of its own."""
    paint = context.paint
    key_width = _key_column_of(section, context)
    lines: list[str] = []

    # Keyed by severity as well as by check: one check can report at two levels
    # once `levels` re-grades it, and a heading that says ERROR must not stand
    # over a line that is only a note.
    for part in sub_group_issues(section.issues, lambda issue: f"{issue.level} {issue.code}"):
        first = part.issues[0]

        lines.extend(
            [
                "",
                f"{_INDENT_SECTION}"
                f"{paint_of_level(paint, first.level)(pad_to(first.level.upper(), 5))}  "
                f"{paint.heading(first.code)}{paint.dim(f' ({len(part.issues)})')}",
                *_description_line(part.issues, context, f"{_INDENT_SECTION}{' ' * 7}"),
                *_item_lines(part.issues, context, False, key_width),
            ]
        )

    return lines


def _tally(
    issues: Sequence[Issue],
    by: Callable[[Issue], str],
) -> dict[str, LevelCount]:
    counts: dict[str, LevelCount] = {}

    for issue in issues:
        counts.setdefault(by(issue), LevelCount()).add(issue.level)

    return counts


def _cross_tab_rows(context: ReportContext) -> list[str]:
    """The axis the sections did not use.

    Grouping by locale leaves the reader wondering which checks fired, and
    grouping by check leaves them wondering which language is behind; this
    answers whichever question is still open.
    """
    result = context.result
    paint = context.paint
    by_locale = context.options.group_by == "code"
    counts = _tally(context.issues, lambda issue: issue.locale if by_locale else issue.code)

    if by_locale:
        # A language with nothing wrong is worth saying out loud, so every locale
        # that took part gets a row.
        for locale in result.locales:
            counts.setdefault(locale, LevelCount())

    rows = sorted(
        ((identifier or GENERAL_LABEL, count) for identifier, count in counts.items()),
        key=lambda row: (-row[1].error, -row[1].warn, -row[1].info, row[0]),
    )

    if not rows:
        return []

    label_width = min(_MAX_LABEL_COLUMN, widest_of(label for label, _ in rows))

    return [
        "",
        f"{_INDENT_SECTION}{paint.dim('By locale' if by_locale else 'By check')}",
        *(
            f"{_INDENT_ITEM}{paint.key(pad_to(truncate(label, label_width), label_width))}"
            f"  {counts_phrase(count, paint)[0]}"
            for label, count in rows
        ),
    ]


def _summary_block(context: ReportContext) -> list[str]:
    result = context.result
    paint = context.paint
    lines = [
        "",
        f"{_INDENT_SECTION}{paint.dim(scope_sentence(result))}",
        f"{_INDENT_SECTION}{counts_phrase(result.summary.level_count, paint)[0]}",
    ]

    if context.hidden > 0:
        lines.append(
            f"{_INDENT_SECTION}"
            + paint.dim(
                f"{plural(context.hidden, 'issue')} not shown, because of the level options."
            )
        )

    clean = (
        [
            locale
            for locale in result.locales
            if not any(section.id == locale for section in context.sections)
        ]
        if context.options.group_by == "locale"
        else []
    )

    if clean:
        joined = ", ".join(clean)

        lines.append(f"{_INDENT_SECTION}{paint.dim(f'Clean: {joined}')}")

    return [*lines, *_cross_tab_rows(context)]


def _verdict_line(context: ReportContext) -> str:
    result = context.result
    paint = context.paint

    if result.success:
        return f" {paint.passed(' PASS ')} {paint.dim('No error level issue was found.')}"

    return (
        f" {paint.failed(' FAIL ')} "
        f"{plural(result.summary.error, 'error')} must be fixed before this passes."
    )


def format_pretty(context: ReportContext) -> str:
    """The report as a terminal reads it.

    A heading block, one section per group of issues, and a summary that answers
    the question the grouping did not.
    """
    options = context.options
    paint = context.paint
    lines: list[str] = []

    if options.info:
        lines.extend(_head_block(context))

    for section in context.sections:
        lines.extend(["", _rule_line(section.label, counts_phrase(section.counts, paint), context)])
        lines.extend(
            _check_section(section, context)
            if options.group_by == "code"
            else _mixed_section(section, context)
        )

    if not context.sections:
        lines.extend(["", f"{_INDENT_SECTION}{paint.dim('Nothing to report.')}"])

    if options.info:
        lines.extend(["", _rule_line("Summary", None, context), *_summary_block(context)])

    lines.extend(["", _verdict_line(context)])

    return "\n".join(lines)
