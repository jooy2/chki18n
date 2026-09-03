"""Keys that end up defined twice, which flattening then silently resolves.

``{"a": {"b": 1}, "a.b": 2}`` flattens to ``{"a.b": 2}``: two definitions went
in and one value came out, with nothing said about the one that lost. The same
happens to ``{"a": ["x"], "a.0": "y"}``. Both are easy to write by hand and
impossible to see afterwards, since by the time anything reads the translations
there is only one key left.

The walk mirrors what `flatten_translations` does — a mapping or a list with
anything in it is descended into, everything else (including an empty mapping or
list) is a leaf — so the paths counted here are exactly the keys that will exist.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Final

from chki18n._types import TranslationMap

#: The separator between the levels of a flattened key.
KEY_SEPARATOR: Final = "."


def _is_branch(value: Any) -> bool:
    return isinstance(value, dict | list) and len(value) > 0


def _walk(value: Any, path: str, leaf: Callable[[str], None]) -> None:
    if isinstance(value, dict) and value:
        for key, child in value.items():
            _walk(child, f"{path}{KEY_SEPARATOR}{key}" if path else str(key), leaf)

        return

    if isinstance(value, list) and value:
        for index, child in enumerate(value):
            _walk(child, f"{path}{KEY_SEPARATOR}{index}" if path else str(index), leaf)

        return

    if path:
        leaf(path)


def collect_flat_keys(translations: Any, into: set[str]) -> set[str]:
    """Every flattened key an object will produce, added to `into`."""
    _walk(translations, "", into.add)

    return into


def flatten_translations(translations: Any) -> TranslationMap:
    """Flatten nested translations into the dotted keys the comparison works on.

    A mapping or a list with anything in it is descended into; everything else,
    including an empty mapping or list, is a leaf and keeps its value. Where two
    definitions produce one key the later one wins, exactly as it does once the
    file is read back — which is the loss `find_duplicate_keys` is there to
    report before it happens.
    """
    flat: TranslationMap = {}

    def walk(value: Any, path: str) -> None:
        if isinstance(value, dict) and value:
            for key, child in value.items():
                walk(child, f"{path}{KEY_SEPARATOR}{key}" if path else str(key))

            return

        if isinstance(value, list) and value:
            for index, child in enumerate(value):
                walk(child, f"{path}{KEY_SEPARATOR}{index}" if path else str(index))

            return

        if path:
            flat[path] = value

    walk(translations, "")

    return flat


def find_duplicate_keys(translations: Any) -> list[str]:
    """Flattened keys that more than one definition produces, first reached first.

    Returns an empty list for the overwhelmingly common case.
    """
    if not _is_branch(translations):
        return []

    seen: set[str] = set()
    duplicates: list[str] = []

    def leaf(path: str) -> None:
        if path in seen:
            if path not in duplicates:
                duplicates.append(path)

            return

        seen.add(path)

    _walk(translations, "", leaf)

    return duplicates
