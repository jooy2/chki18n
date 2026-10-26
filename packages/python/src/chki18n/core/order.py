"""How strings are put in order, the same way in every package."""

from __future__ import annotations


def text_sort_key(text: str) -> bytes:
    """`text` as UTF-16 code units, which is the order JavaScript and Dart sort in.

    Python compares code points, which puts a character above U+FFFF after the
    ones from U+E000 to U+FFFF rather than before them.
    """
    return text.encode("utf-16-be", "surrogatepass")
