"""Walking a directory tree, the one way both scans walk it."""

from __future__ import annotations

import os
from collections.abc import Callable, Iterator
from dataclasses import dataclass

from chki18n.core.order import text_sort_key


@dataclass(frozen=True, slots=True)
class WalkedFile:
    """A file a walk reached."""

    path: str
    #: Path segments relative to the walk's root, file name last.
    segments: tuple[str, ...]


def walk_files(
    root: str,
    *,
    is_excluded_directory: Callable[[tuple[str, ...]], bool],
    is_wanted: Callable[[WalkedFile], bool],
    on_unreadable: Callable[[str], None] | None = None,
) -> Iterator[WalkedFile]:
    """Every wanted file below `root`, depth first and in name order.

    A directory lists its entries in whatever order the file system keeps, so
    sorting is what makes two walks of one tree, on two machines or in two
    packages, meet its files in the same order. Hidden entries are tooling state
    and are never entered, and a link to a directory is not followed: one that
    points back up the tree would never end.

    `is_excluded_directory` is asked about each directory by its segments,
    `is_wanted` about each file, and `on_unreadable` is told about a directory
    that could not be listed, the root included.
    """

    def walk(directory: str, segments: tuple[str, ...]) -> Iterator[WalkedFile]:
        try:
            with os.scandir(directory) as listing:
                entries = sorted(listing, key=lambda entry: text_sort_key(entry.name))
        except OSError:
            if on_unreadable is not None:
                on_unreadable(directory)

            return

        for entry in entries:
            if entry.name.startswith("."):
                continue

            path = os.path.join(directory, entry.name)
            entry_segments = (*segments, entry.name)

            if entry.is_dir(follow_symlinks=False):
                if not is_excluded_directory(entry_segments):
                    yield from walk(path, entry_segments)

                continue

            file = WalkedFile(path=path, segments=entry_segments)

            if is_wanted(file):
                yield file

    return walk(root, ())
