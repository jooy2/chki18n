"""The placeholders a translation value carries."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Final

#: A placeholder name is written by a developer, so it is spelled the way an
#: identifier is. Anything else between the delimiters is prose that happens to
#: sit between them, not a placeholder.
_KEY_PATTERN: Final = re.compile(r"^[A-Za-z0-9_$-]*$")

_NO_KEYS: Final[list[str]] = []


def _is_escaped(text: str, at: int) -> bool:
    """Whether the delimiter at `at` is escaped by an odd number of backslashes."""
    count = 0
    index = at - 1

    while index >= 0 and text[index] == "\\":
        count += 1
        index -= 1

    return count % 2 == 1


def extract_interpolation_keys(value: Any, prefix: str, suffix: str) -> list[str]:
    """Interpolation keys used by a value, e.g. `["name"]` for `Hello {name}`.

    The scan walks the string character by character, which is the single most
    repeated operation of an analysis, so values that cannot possibly hold a
    placeholder are rejected up front by one `find`.

    A doubled single-character delimiter is not a delimiter: `{{name}}` holds no
    key as far as `{` and `}` are concerned, which is what makes
    `interpolation_prefix="{{"` a real setting rather than a formality.
    """
    if not isinstance(value, str) or len(value) < len(prefix) + len(suffix):
        return _NO_KEYS

    if prefix not in value or suffix not in value:
        return _NO_KEYS

    if not prefix or not suffix or prefix == suffix:
        return _NO_KEYS

    found: list[str] = []
    length = len(value)
    prefix_length = len(prefix)
    suffix_length = len(suffix)
    single = prefix_length == 1 and suffix_length == 1

    def is_delimiter(at: int, delimiter: str) -> bool:
        size = len(delimiter)

        if at < 0 or at + size > length:
            return False

        if value[at : at + size] != delimiter:
            return False

        if _is_escaped(value, at):
            return False

        if single:
            if at > 0 and value[at - 1] == delimiter:
                return False

            if at + 1 < length and value[at + 1] == delimiter:
                return False

        return True

    at = 0

    while at <= length - prefix_length:
        if not is_delimiter(at, prefix):
            at += 1
            continue

        start = at + prefix_length
        close_at = -1
        index = start

        while index <= length - suffix_length:
            if is_delimiter(index, suffix):
                close_at = index
                break

            index += 1

        if close_at == -1:
            at += 1
            continue

        key = value[start:close_at]

        if (
            "\n" not in key
            and "\r" not in key
            and prefix not in key
            and suffix not in key
            and _KEY_PATTERN.match(key)
        ):
            found.append(key)

        at = close_at + suffix_length

    return found


@dataclass(frozen=True, slots=True)
class Delimiters:
    """An opening and closing delimiter pair, as `interpolation_prefix` takes them."""

    #: Opening delimiter, e.g. ``{{``.
    prefix: str
    #: Closing delimiter, e.g. ``}}``.
    suffix: str


#: The delimiter pairs `detect_interpolation_delimiters` knows, in the order it
#: believes them. A doubled pair comes before its single form, or ``{{name}}``
#: would be read as ``{`` wrapped around ``{name``.
INTERPOLATION_DELIMITERS: Final[tuple[Delimiters, ...]] = (
    Delimiters("{{", "}}"),
    Delimiters("{", "}"),
    Delimiters("[[", "]]"),
    Delimiters("[", "]"),
    Delimiters("((", "))"),
    Delimiters("(", ")"),
    Delimiters("<<", ">>"),
    Delimiters("<", ">"),
)

#: The opening characters of every pair above.
_OPENERS: Final = frozenset("{[(<")

#: Characters an interpolation key can start with, which is how a placeholder
#: name is spelled everywhere else in this library. Deliberately narrow: it is
#: what tells ``{name}`` apart from the ``{"`` of the JSON holding it, which is
#: the whole reason this can be pointed at a file's raw text.
_KEY_START: Final = frozenset("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$")


def detect_interpolation_delimiters(text: str) -> Delimiters | None:
    """Guess which delimiters a text writes its interpolation keys with.

    ``None`` when nothing in it looks like one.

    This is a suggestion to offer a user, not a decision to act on: a text that
    uses none can only be guessed at, and one that mixes two answers with the
    first pair of `INTERPOLATION_DELIMITERS` that it holds. Reach for it when a
    project is being set up and `interpolation_prefix` has nobody to ask.
    """
    # One pass over the text, then the priority order is applied to what it saw.
    # Probing the candidates one at a time would read a large file eight times.
    seen: set[str] = set()
    length = len(text)
    at = 0

    while at < length:
        opener = text[at]

        if opener not in _OPENERS:
            at += 1
            continue

        end = at + 1

        while end < length and text[end] == opener:
            end += 1

        key = end

        # `{{ name }}` is as common as `{{name}}`, and the space belongs to the
        # style rather than to the delimiter.
        while key < length and text[key] == " ":
            key += 1

        if key < length and text[key] in _KEY_START:
            # A run of three or more is read as the doubled form, the way a run
            # of one is read as the single one.
            seen.add(opener * 2 if end - at > 1 else opener)

            # Nothing later in the text can outrank the first candidate, so a
            # file written in it is answered by its first placeholder.
            if INTERPOLATION_DELIMITERS[0].prefix in seen:
                break

        at = end

    if not seen:
        return None

    for candidate in INTERPOLATION_DELIMITERS:
        if candidate.prefix in seen:
            return candidate

    return None
