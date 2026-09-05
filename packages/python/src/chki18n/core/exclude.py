"""What a scan does not look at.

Two questions, kept together because both are answered from a path alone:
whether a directory is one the walk should not enter, and whether a file is one
it should not read. Neither needs the file system, so the rules are the same
wherever they are applied — the directory scanner, the unused-key scan, or a
caller colouring a folder picker of its own.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Iterable, Sequence
from typing import Final

#: Both separators, because a path may be written with either.
_SEPARATOR: Final = re.compile(r"[/\\]")


def path_segments(path: str) -> list[str]:
    """A path as segments, with empty ones and `.` dropped."""
    return [segment for segment in _SEPARATOR.split(path) if segment != "" and segment != "."]


def matches_name_pattern(name: str, pattern: str) -> bool:
    """Whether `name` matches `pattern`, where `*` stands for any run of characters.

    Everything else is literal. Case is ignored, because the file systems these
    names come from mostly ignore it too.
    """
    subject = name.lower()
    parts = pattern.lower().split("*")

    if len(parts) == 1:
        return subject == parts[0]

    first = parts[0]
    last = parts[-1]

    if not subject.startswith(first) or not subject.endswith(last):
        return False

    index = len(first)

    for part in parts[1:-1]:
        if not part:
            continue

        found = subject.find(part, index)

        if found == -1:
            return False

        index = found + len(part)

    # The parts matched in order, but the first and the last may have claimed
    # the same characters: `ab` must not match `a*b*b`.
    return index + len(last) <= len(subject)


def create_path_excluder(
    entries: Iterable[str],
) -> Callable[[Sequence[str]], bool]:
    """A test for the directories a walk should not enter.

    The candidate is given as its path relative to the root, its own name last.

    An entry of one segment names a directory at any depth, which is what makes
    `node_modules` mean every `node_modules` there is. An entry of more names a
    path from the root, matching that directory and everything under it, which
    is what lets a project exclude its own `src/legacy` without excluding a
    `legacy` belonging to something else.
    """
    names: set[str] = set()
    paths: list[list[str]] = []

    for entry in entries:
        segments = path_segments(entry)

        if len(segments) == 1:
            names.add(segments[0])
        elif len(segments) > 1:
            paths.append(segments)

    def excluded(segments: Sequence[str]) -> bool:
        for segment in segments:
            if segment in names:
                return True

        return any(
            len(path) <= len(segments) and list(segments[: len(path)]) == path for path in paths
        )

    return excluded


def create_file_excluder(patterns: Iterable[str]) -> Callable[[str], bool]:
    """A test for the files a walk should not read, over the file's own name."""
    exact: set[str] = set()
    globs: list[str] = []

    for pattern in patterns:
        if not pattern:
            continue

        if "*" in pattern:
            globs.append(pattern)
        else:
            exact.add(pattern.lower())

    def excluded(name: str) -> bool:
        subject = name.lower()

        return subject in exact or any(matches_name_pattern(subject, pattern) for pattern in globs)

    return excluded
