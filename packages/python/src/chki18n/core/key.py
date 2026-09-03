"""The shape of a key rather than what it translates to."""

from __future__ import annotations

import re
from typing import Final

from chki18n._types import Issue, ResolvedOptions
from chki18n.constants import KeyCase
from chki18n.core.duplicate import KEY_SEPARATOR
from chki18n.core.issue import create_issue

_SEGMENT_PATTERN: Final[dict[KeyCase, re.Pattern[str]]] = {
    "kebab": re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$"),
    "camel": re.compile(r"^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$"),
    "snake": re.compile(r"^[a-z0-9]+(?:_[a-z0-9]+)*$"),
}

#: What i18next appends to a key to pick a plural form or a context.
#:
#: These are written with an underscore whatever case the project uses for its
#: keys, so a kebab-case project still writes `item-count_one`.
_LIBRARY_SUFFIXES: Final[frozenset[str]] = frozenset(
    {
        "zero",
        "one",
        "two",
        "few",
        "many",
        "other",
        "plural",
        "ordinal",
        "interval",
        "male",
        "female",
    }
)


def _without_library_suffix(segment: str, key_case: KeyCase) -> str:
    """The segment without the plural or context suffix a library added to it."""
    if key_case == "snake":
        return segment

    separator = segment.rfind("_")

    if separator < 1 or segment[separator + 1 :] not in _LIBRARY_SUFFIXES:
        return segment

    return segment[:separator]


def check_key_shape(
    issues: list[Issue],
    key: str,
    group: str,
    options: ResolvedOptions,
) -> None:
    """Check the case a key's segments are written in, and how deeply it is nested.

    Both are off until the project says what it wants, because neither has a
    right answer on its own. Reported once per key rather than once per locale: a
    key is named the same everywhere, so one badly named key is one finding, not
    one per language.
    """
    # Asked of every key of every group, so the case where the project has said
    # nothing costs nothing: not even splitting the key into its segments.
    if not key or (options.max_key_depth is None and options.key_case is None):
        return

    segments = key.split(KEY_SEPARATOR)
    max_key_depth = options.max_key_depth

    if (
        max_key_depth is not None
        and len(segments) > max_key_depth
        and "KEY_DEPTH" in options.enabled_checks
    ):
        issues.append(
            create_issue(
                "KEY_DEPTH",
                key=key,
                group=group,
                message=(
                    f"The key is {len(segments)} levels deep, and `max_key_depth` allows "
                    f"{max_key_depth}."
                ),
            )
        )

    key_case = options.key_case

    if key_case is None or "KEY_NAMING" not in options.enabled_checks:
        return

    pattern = _SEGMENT_PATTERN[key_case]

    for segment in segments:
        if pattern.match(_without_library_suffix(segment, key_case)):
            continue

        issues.append(
            create_issue(
                "KEY_NAMING",
                key=key,
                group=group,
                message=(
                    f"The part `{segment}` is not written in {key_case} case."
                    if len(segments) > 1
                    else f"The key is not written in {key_case} case."
                ),
            )
        )

        # One finding per key. Naming a second bad segment of the same key adds
        # nothing to what has to be done about it.
        return
