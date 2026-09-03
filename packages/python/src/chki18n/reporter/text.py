"""The wording and the column arithmetic every reporter shares."""

from __future__ import annotations

import re
from collections.abc import Callable, Iterable
from typing import Final

from chki18n._types import Issue, LevelCount, Result, Summary
from chki18n.constants import CHECK_META
from chki18n.core.width import char_width, display_width
from chki18n.reporter.paint import Paint

_WHITESPACE_RUN: Final = re.compile(r"\s+")


def plural(count: int, noun: str) -> str:
    """`1 key` / `2 keys`, so a count never has to be read as `2 key(s)`."""
    return f"{count} {noun}{'' if count == 1 else 's'}"


def one_line(value: str) -> str:
    """Collapse the newlines and runs of spaces that would break a column apart.

    Only the report collapses them; nothing is changed for the checks themselves,
    which is where whitespace still matters.
    """
    return _WHITESPACE_RUN.sub(" ", value)


def quote(value: str | None) -> str:
    """A value as the report shows it, or `(none)` when there was none."""
    return "(none)" if value is None else f'"{one_line(value)}"'


def pad_to(text: str, width: int) -> str:
    """Pad to a column count, so a column of Korean lines up with one of English."""
    room = width - display_width(text)

    return f"{text}{' ' * room}" if room > 0 else text


def widest_of(values: Iterable[str]) -> int:
    """The widest of a set of strings, in columns."""
    return max((display_width(value) for value in values), default=0)


def truncate(text: str, maximum: int) -> str:
    """Cut to a column count and mark the cut."""
    if display_width(text) <= maximum:
        return text

    room = max(1, maximum - 3)
    kept: list[str] = []
    width = 0

    for char in text:
        following = width + char_width(char)

        if following > room:
            break

        width = following
        kept.append(char)

    return f"{''.join(kept)}..."


def wrap(text: str, width: int) -> list[str]:
    """Break a sentence on its spaces so it fits a column count.

    Prose is wrapped rather than cut: a description that stops mid-word tells the
    reader less than one that runs onto a second line. A word wider than the
    column is left to overflow, since breaking it would only make it unreadable.
    """
    if width < 8:
        return [text]

    lines: list[str] = []
    line = ""

    for word in text.split(" "):
        if not line:
            line = word
        elif display_width(line) + 1 + display_width(word) > width:
            lines.append(line)
            line = word
        else:
            line = f"{line} {word}"

    if line:
        lines.append(line)

    return lines


def truncate_start(text: str, maximum: int) -> str:
    """Cut the front instead of the back.

    What tells two file paths apart is their last few segments, so those are the
    ones a heading has to keep.
    """
    if display_width(text) <= maximum:
        return text

    room = max(1, maximum - 3)
    kept = ""
    width = 0

    for char in reversed(text):
        following = width + char_width(char)

        if following > room:
            break

        width = following
        kept = f"{char}{kept}"

    return f"...{kept}"


def counts_phrase(counts: LevelCount, paint: Paint) -> tuple[str, int]:
    """`3 errors, 7 warnings, 1 info`, or `clean` when there is nothing to say.

    Returns the painted phrase and the width the escape codes do not add to.
    """
    parts: list[str] = []
    length = 0

    def add(count: int, word: str, painter: Callable[[str], str]) -> None:
        nonlocal length

        if count < 1:
            return

        length += (3 if parts else 0) + len(word)
        parts.append(painter(word))

    add(counts.error, plural(counts.error, "error"), paint.error)
    add(counts.warn, plural(counts.warn, "warning"), paint.warn)
    # `info` has no plural that reads well, so the noun is left as it is.
    add(counts.info, f"{counts.info} info", paint.info)

    if not parts:
        return paint.dim("clean"), 5

    return paint.dim(" · ").join(parts), length


def counts_sentence(counts: Summary) -> str:
    """The same tally as `counts_phrase`, unpainted and as a sentence."""
    parts = [
        *([plural(counts.error, "error")] if counts.error > 0 else []),
        *([plural(counts.warn, "warning")] if counts.warn > 0 else []),
        *([f"{counts.info} info"] if counts.info > 0 else []),
    ]

    return f"Found {', '.join(parts)}." if parts else "Found no issues."


def scope_sentence(result: Result) -> str:
    """What the run compared, as one sentence."""
    return (
        f"Compared {plural(result.key_count, 'key')} across "
        f"{plural(len(result.locales), 'locale')} in "
        f"{plural(len(result.groups), 'group')}. ({result.elapsed_ms}ms)"
    )


def reference_of(issue: Issue, target: str) -> str:
    """The target language's own wording, which a translation is compared against.

    Keys the target language does not have fall back to their own value, and a
    check about the key rather than the value shows neither.
    """
    if issue.target_value is not None:
        return f"{target}: {quote(issue.target_value)}"

    if issue.value is not None:
        return f"{issue.locale}: {quote(issue.value)}"

    return ""


def detail_of(issue: Issue) -> str:
    """What this occurrence adds over the check's own description.

    A check that only repeats the description has nothing to add, so it
    contributes no line.
    """
    meta = CHECK_META.get(issue.code)

    return "" if meta is not None and issue.message == meta.description else issue.message


def key_label_of(issue: Issue, show_group: bool) -> str:
    """The key as the report shows it.

    When a project has more than one comparable set of files, the group is part
    of the key's address and is shown with it.
    """
    if not issue.key:
        # A finding about a whole group or file has no key to address it by, and
        # a bare `@group` would read as one.
        return ""

    return f"{issue.key} @{issue.group}" if show_group and issue.group else issue.key


def relative_to(path: str, cwd: str) -> str:
    """Strip the working directory from a path, leaving an absolute one alone."""
    if not cwd:
        return path

    for separator in ("/", "\\"):
        prefix = cwd if cwd.endswith(separator) else f"{cwd}{separator}"

        if path.startswith(prefix):
            return path[len(prefix) :]

    return path
