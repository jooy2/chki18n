"""What the source tree says about the translation keys.

Which ones nothing references, and which ones it asks for that nothing defines.

The search is for a key's **leaf segment** — `desc.hello` is looked up as
`hello` — because code very often resolves a nested key by its last segment
alone, through a scoped ``t("hello")`` or a namespace bound higher up. Matching
the whole dotted key would report those as unused, and a check that cries wolf on
working code is worse than one that misses something.

That trade also decides the severity: this can only ever be a hint, so
`UNUSED_KEY` is reported at `info` and never fails a run.
"""

from __future__ import annotations

import os
import re
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass, field
from typing import Final

from chki18n._types import KeyUsage, ResolvedOptions
from chki18n.constants import SOURCE_EXTENSIONS, SOURCE_MAX_FILE_BYTES
from chki18n.core.exclude import create_file_excluder, create_path_excluder
from chki18n.core.plural import plural_base_of
from chki18n.core.value import WHITESPACE
from chki18n.loader.walk import walk_files

_EXTENSIONS: Final[frozenset[str]] = frozenset(SOURCE_EXTENSIONS)

#: A name a translation call goes by starts with a word character in the ASCII
#: sense, as JavaScript reads `\w` and `\b`. Python's would take `한` or `é` for
#: one, and miss `t('key')` written straight after either.
_WORD_START: Final = re.compile(r"[A-Za-z0-9_]")

_WORD_BOUNDARY: Final = r"(?<![A-Za-z0-9_])"


def leaf_of_key(key: str) -> str:
    """`desc.hello` to `hello`, and `desc.item_one` to `item`.

    The plural suffix comes off because no source file writes it: the code asks
    for `item` and the runtime picks the form. Searching for `item_one` would
    report every plural key in the project as unused.
    """
    cut = key.rfind(".")
    leaf = key if cut == -1 else key[cut + 1 :]

    return plural_base_of(leaf) or leaf


#: The characters a key segment is nearly always spelled with. Any occurrence of
#: a leaf spelled only with them sits inside one unbroken run of them, so the
#: runs of a file are all that has to be read to find it.
_WORD_RUN_PATTERN: Final = re.compile(r"[A-Za-z0-9_$-]+")


def _leaf_search(remaining: dict[str, None]) -> Callable[[str], None]:
    """A search that takes out of `remaining` every leaf a text holds.

    It finds them as plain substrings, the way `in` would.

    Asking for each leaf in each file costs the number of leaves times the size
    of the tree: a thousand files and five thousand unused keys took sixteen
    seconds. Instead each run of word characters is cut into the pieces as long as
    some leaf is and looked up in a set, and a run met in an earlier file is not
    cut again, since identifiers repeat from file to file. A leaf with any other
    character in it is still searched for on its own.
    """
    words = {leaf for leaf in remaining if _WORD_RUN_PATTERN.fullmatch(leaf)}
    others = {leaf for leaf in remaining if leaf not in words}
    lengths = sorted({len(leaf) for leaf in words})
    seen_runs: set[str] = set()

    def search(text: str) -> None:
        if words:
            for run in _WORD_RUN_PATTERN.findall(text):
                if run in seen_runs:
                    continue

                seen_runs.add(run)

                for length in lengths:
                    if length > len(run):
                        break

                    for at in range(len(run) - length + 1):
                        piece = run[at : at + length]

                        if piece in words:
                            words.discard(piece)
                            remaining.pop(piece, None)

        for leaf in [leaf for leaf in others if leaf in text]:
            others.discard(leaf)
            remaining.pop(leaf, None)

    return search


def _is_scannable_name(name: str) -> bool:
    cut = name.rfind(".")

    return cut > 0 and name[cut + 1 :].lower() in _EXTENSIONS


@dataclass(frozen=True, slots=True)
class UsageScan:
    """What one walk of a source tree found."""

    #: Keys whose leaf segment was found in no scanned file.
    unused_keys: list[str] = field(default_factory=list)
    #: Keys the source asks for that no translation file defines.
    undefined_keys: list[KeyUsage] = field(default_factory=list)
    #: How many files were actually read.
    scanned_file_count: int = 0


def _call_patterns(names: Sequence[str]) -> list[re.Pattern[str]]:
    """A key written as the first argument of a translation call, or as `i18nKey`."""
    alternatives = "|".join(
        (_WORD_BOUNDARY if _WORD_START.match(name) else "") + re.escape(name) for name in names
    )
    space = f"[{WHITESPACE}]*"

    return [
        re.compile(rf"(?:{alternatives}){space}\({space}(['\"`])([^'\"`\r\n]*)\1"),
        re.compile(rf"{_WORD_BOUNDARY}i18nKey{space}={space}\{{?{space}(['\"`])([^'\"`\r\n]*)\1"),
    ]


def _calls_in(content: str, patterns: Sequence[re.Pattern[str]]) -> list[str]:
    """Keys a file asks a translation function for, in the order it asks for them.

    A dictionary rather than a set because the order is what the report prints,
    and a run over unchanged files has to print the same lines in the same
    places. A template literal holding an expression is skipped: the key is only
    known at run time, and guessing at it would report a working call as broken.
    """
    keys: dict[str, None] = {}

    for pattern in patterns:
        for found in pattern.finditer(content):
            key = found.group(2)

            if key and "${" not in key:
                # `t('common:attr.folder')` names a namespace this comparison
                # does not have, and the key it wants is the part after it.
                keys.setdefault(key[key.find(":") + 1 :])

    return list(keys)


def _addresses_of(keys: Sequence[str]) -> set[str]:
    """Every way a defined key can be addressed.

    In full, by its plural base, and by any run of segments that ends either. A
    `t` bound with a `keyPrefix`, or a namespace loaded higher up, asks for
    `folder` rather than `attr.folder`, and reporting that as undefined would cry
    wolf on working code — the same trade the unused scan makes.
    """
    addresses: set[str] = set()

    def add(key: str) -> None:
        addresses.add(key)
        separator = key.find(".")

        while separator != -1:
            addresses.add(key[separator + 1 :])
            separator = key.find(".", separator + 1)

    for key in keys:
        add(key)

        # The source asks for `item`, never for `item_one`: the runtime picks the
        # form, so the base is an address of the key as much as the key is.
        base = plural_base_of(key)

        if base is not None:
            add(base)

    return addresses


def find_unused_keys(
    source_path: str,
    keys: Sequence[str],
    options: ResolvedOptions,
    skip_files: Iterable[str] = (),
) -> UsageScan:
    """Search `source_path` for each key, and report the ones never found.

    `skip_files` are the project's own translation files: a key appears verbatim
    in the file that defines it, so searching those would mark every key used and
    the scan would never report anything.
    """
    # One leaf can belong to several keys (`a.name` and `b.name`), so the answer
    # is looked up per leaf and applied to every key that shares it.
    keys_by_leaf: dict[str, list[str]] = {}

    for key in keys:
        leaf = leaf_of_key(key)

        if leaf:
            keys_by_leaf.setdefault(leaf, []).append(key)

    # Only worth reading every file for; the unused scan can stop as soon as the
    # last leaf turns up, and this one cannot.
    wants_undefined = "UNDEFINED_KEY" in options.enabled_checks
    addresses = _addresses_of(keys) if wants_undefined else None
    patterns = _call_patterns(options.translate_functions) if wants_undefined else []
    undefined_keys: list[KeyUsage] = []
    reported: set[str] = set()

    if not keys_by_leaf and not wants_undefined:
        return UsageScan()

    # Shrinks as leaves turn up, and the scan stops reading once it is empty.
    #
    # A dictionary rather than a set, because what is left over is the reported
    # order of the unused keys, and a set would shuffle it between runs.
    remaining: dict[str, None] = dict.fromkeys(keys_by_leaf)
    search_leaves = _leaf_search(remaining)
    skip = set(skip_files)
    is_excluded_directory = create_path_excluder(options.exclude)
    is_excluded_file = create_file_excluder(options.exclude_files)
    scanned_file_count = 0

    # Absolute from here on, so `skip_files` (which are absolute) compare equal.
    # There is no `on_unreadable`: a folder that cannot be read degrades the scan
    # rather than failing it.
    walk = walk_files(
        os.path.abspath(source_path),
        is_excluded_directory=is_excluded_directory,
        # The path excluder answers for a file too, because this walk has always
        # let `exclude` name one; `exclude_files` is the pattern form of the same
        # question.
        is_wanted=lambda file: (
            _is_scannable_name(file.segments[-1])
            and not is_excluded_directory(file.segments)
            and not is_excluded_file(file.segments[-1])
            and file.path not in skip
        ),
    )

    for file in walk:
        if not remaining and not wants_undefined:
            break

        try:
            if os.stat(file.path).st_size > SOURCE_MAX_FILE_BYTES:
                continue

            with open(file.path, encoding="utf-8") as handle:
                content = handle.read()
        except (OSError, UnicodeDecodeError):
            continue

        scanned_file_count += 1

        if remaining:
            search_leaves(content)

        if addresses is None:
            continue

        for key in _calls_in(content, patterns):
            if key in addresses or key in reported:
                continue

            reported.add(key)
            undefined_keys.append(KeyUsage(key=key, file=file.path))

    unused_keys: list[str] = []

    for leaf in remaining:
        unused_keys.extend(keys_by_leaf.get(leaf, []))

    return UsageScan(
        unused_keys=unused_keys,
        undefined_keys=undefined_keys,
        scanned_file_count=scanned_file_count,
    )
