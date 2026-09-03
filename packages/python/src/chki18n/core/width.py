"""Columns a character occupies, rather than the number of characters there are."""

from __future__ import annotations

from typing import Final

#: Code point ranges a monospace font draws twice as wide.
#:
#: Korean, Japanese and Chinese translations are the normal case here, and
#: counting their characters as one column each is what pulls a report's columns
#: out of line and makes a length comparison against an English original
#: meaningless.
_WIDE_RANGES: Final[tuple[tuple[int, int], ...]] = (
    (0x1100, 0x115F),
    (0x2E80, 0x303E),
    (0x3041, 0x33FF),
    (0x3400, 0x4DBF),
    (0x4E00, 0x9FFF),
    (0xA000, 0xA4CF),
    (0xA960, 0xA97F),
    (0xAC00, 0xD7A3),
    (0xF900, 0xFAFF),
    (0xFE10, 0xFE19),
    (0xFE30, 0xFE6F),
    (0xFF00, 0xFF60),
    (0xFFE0, 0xFFE6),
    (0x1F300, 0x1F64F),
    (0x1F900, 0x1F9FF),
    (0x20000, 0x3FFFD),
)

#: Marks drawn on top of the character before them, taking no column of their own.
_ZERO_WIDTH_RANGES: Final[tuple[tuple[int, int], ...]] = (
    (0x0300, 0x036F),
    (0x200B, 0x200F),
    (0xFE00, 0xFE0F),
    (0xFEFF, 0xFEFF),
)


def _within(ranges: tuple[tuple[int, int], ...], code: int) -> bool:
    return any(start <= code <= end for start, end in ranges)


def char_width(char: str) -> int:
    """Columns one character occupies: none, one, or two."""
    code = ord(char[0]) if char else 0

    if _within(_ZERO_WIDTH_RANGES, code):
        return 0

    return 2 if _within(_WIDE_RANGES, code) else 1


def display_width(text: str) -> int:
    """Columns a string occupies, rather than the number of characters in it."""
    width = 0

    for char in text:
        code = ord(char)

        if _within(_ZERO_WIDTH_RANGES, code):
            continue

        width += 2 if _within(_WIDE_RANGES, code) else 1

    return width
