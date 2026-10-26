"""Flattening nested translations into dotted keys, and the keys that end up defined twice.

``{"a": {"b": 1}, "a.b": 2}`` flattens to ``{"a.b": 2}``: two definitions went
in and one value came out, with nothing said about the one that lost. The same
happens to ``{"a": ["x"], "a.0": "y"}``. Both are easy to write by hand and
impossible to see afterwards, since by the time anything reads the translations
there is only one key left.

One walk answers every question below, so the keys counted are exactly the keys
the comparison sees. A mapping or a list with anything in it is descended into;
everything else, an empty mapping or list included, is a leaf and keeps its
value.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Iterable
from typing import Any, Final

from chki18n._types import TranslationMap

#: The separator between the levels of a flattened key.
KEY_SEPARATOR: Final = "."

#: A key a JavaScript object keeps ahead of the others: a whole number below
#: 2**32 - 1, written without a leading zero.
_ARRAY_INDEX_PATTERN: Final = re.compile(r"0|[1-9][0-9]{0,9}")


def _is_array_index(key: str) -> bool:
    return _ARRAY_INDEX_PATTERN.fullmatch(key) is not None and int(key) < 4294967295


def _items_in_object_order(mapping: dict[Any, Any]) -> Iterable[tuple[str, Any]]:
    """The items of `mapping` in the order a JavaScript object holds its keys.

    That is the order the reference package reaches them in. A JavaScript object
    lists whole-number keys first, in ascending order, and every other key after
    them in the order it was written. Read in the file's own order instead,
    ``{"title": ..., "404": ...}`` would be reported in another order than the
    JavaScript package reports it.
    """
    items = [(str(key), value) for key, value in mapping.items()]
    indices = [item for item in items if _is_array_index(item[0])]

    if not indices:
        return items

    indices.sort(key=lambda item: int(item[0]))

    return [*indices, *(item for item in items if not _is_array_index(item[0]))]


def _children_of(value: Any) -> Iterable[tuple[str, Any]] | None:
    """The children flattening descends into, or ``None`` for a leaf."""
    if isinstance(value, dict) and value:
        return _items_in_object_order(value)

    if isinstance(value, list) and value:
        return ((str(index), child) for index, child in enumerate(value))

    return None


def _walk_leaves(translations: Any, visit: Callable[[str, Any], None]) -> None:
    """Every leaf below `translations` with its flattened key, in the order keys are reached."""

    def walk(value: Any, path: str) -> None:
        children = _children_of(value)

        if children is None:
            visit(path, value)
            return

        for key, child in children:
            walk(child, f"{path}{KEY_SEPARATOR}{key}" if path else key)

    for key, child in _children_of(translations) or ():
        walk(child, key)


def flatten_with_duplicates(translations: Any) -> tuple[TranslationMap, list[str]]:
    """The flat map the comparison works on, and the keys more than one definition produced.

    The duplicates come in the order they are first reached. Where two
    definitions produce one key the later one wins, exactly as it does once the
    file is read back.
    """
    flat: TranslationMap = {}
    duplicates: list[str] = []

    def visit(key: str, value: Any) -> None:
        if key in flat and key not in duplicates:
            duplicates.append(key)

        flat[key] = value

    _walk_leaves(translations, visit)

    return flat, duplicates


def flatten_translations(translations: Any) -> TranslationMap:
    """Flatten nested translations into the dotted keys the comparison works on."""
    return flatten_with_duplicates(translations)[0]


def collect_flat_keys(translations: Any, into: set[str]) -> set[str]:
    """Every flattened key an object will produce, added to `into`."""
    _walk_leaves(translations, lambda key, _: into.add(key))

    return into


def find_duplicate_keys(translations: Any) -> list[str]:
    """Flattened keys that more than one definition produces, first reached first.

    Returns an empty list for the overwhelmingly common case.
    """
    seen: set[str] = set()
    duplicates: list[str] = []

    def visit(key: str, _: Any) -> None:
        if key not in seen:
            seen.add(key)
        elif key not in duplicates:
            duplicates.append(key)

    _walk_leaves(translations, visit)

    return duplicates
