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
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from typing import Final

from chki18n._types import KeyUsage, ResolvedOptions
from chki18n.constants import SOURCE_EXTENSIONS, SOURCE_MAX_FILE_BYTES
from chki18n.core.plural import plural_base_of

_EXTENSIONS: Final[frozenset[str]] = frozenset(SOURCE_EXTENSIONS)

_WORD_START: Final = re.compile(r"^\w")


def leaf_of_key(key: str) -> str:
    """`desc.hello` to `hello`, and `desc.item_one` to `item`.

    The plural suffix comes off because no source file writes it: the code asks
    for `item` and the runtime picks the form. Searching for `item_one` would
    report every plural key in the project as unused.
    """
    cut = key.rfind(".")
    leaf = key if cut == -1 else key[cut + 1 :]

    return plural_base_of(leaf) or leaf


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
    # A backslash cannot appear inside an f-string expression before Python
    # 3.12, so the word boundary is a name rather than a literal in place.
    boundary = r"\b"
    alternatives = "|".join(
        (boundary if _WORD_START.match(name) else "") + re.escape(name) for name in names
    )

    return [
        re.compile(rf"(?:{alternatives})\s*\(\s*(['\"`])([^'\"`\r\n]*)\1"),
        re.compile(r"\bi18nKey\s*=\s*\{?\s*(['\"`])([^'\"`\r\n]*)\1"),
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

    # Shrinks as leaves turn up. Searching only what is still missing is what
    # keeps this cheap: in a real project most keys are found in the first
    # handful of files, and every later file costs one search per remaining leaf.
    #
    # A dictionary rather than a set, because what is left over is the reported
    # order of the unused keys, and a set would shuffle it between runs.
    remaining: dict[str, None] = dict.fromkeys(keys_by_leaf)
    skip = set(skip_files)
    scanned_file_count = 0

    def walk(directory: str) -> None:
        nonlocal scanned_file_count

        if not remaining and not wants_undefined:
            return

        try:
            entries = list(os.scandir(directory))
        except OSError:
            # A folder that cannot be read should degrade the scan, not fail it.
            return

        for entry in entries:
            if not remaining and not wants_undefined:
                return

            if entry.name.startswith(".") or entry.name in options.exclude:
                continue

            path = os.path.join(directory, entry.name)

            if entry.is_dir():
                walk(path)
                continue

            if not _is_scannable_name(entry.name) or path in skip:
                continue

            try:
                if entry.stat().st_size > SOURCE_MAX_FILE_BYTES:
                    continue

                with open(path, encoding="utf-8") as handle:
                    content = handle.read()
            except (OSError, UnicodeDecodeError):
                continue

            scanned_file_count += 1

            for leaf in [leaf for leaf in remaining if leaf in content]:
                del remaining[leaf]

            if addresses is None:
                continue

            for key in _calls_in(content, patterns):
                if key in addresses or key in reported:
                    continue

                reported.add(key)
                undefined_keys.append(KeyUsage(key=key, file=path))

    # Absolute from here on, so `skip_files` (which are absolute) compare equal.
    walk(os.path.abspath(source_path))

    unused_keys: list[str] = []

    for leaf in remaining:
        unused_keys.extend(keys_by_leaf.get(leaf, []))

    return UsageScan(
        unused_keys=unused_keys,
        undefined_keys=undefined_keys,
        scanned_file_count=scanned_file_count,
    )
