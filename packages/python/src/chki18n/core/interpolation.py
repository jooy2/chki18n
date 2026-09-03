"""The placeholders a translation value carries."""

from __future__ import annotations

import re
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
