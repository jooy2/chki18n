"""Reading a directory of translation files into the shape the analyzer compares.

This is the only part of the library that walks the file system looking for
translations.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from chki18n._types import Issue, ResolvedOptions, SourceFile, TranslationGroups, TranslationMap
from chki18n.constants import SUPPORTED_EXTENSIONS, FileFormat
from chki18n.core.exclude import create_file_excluder, create_path_excluder
from chki18n.core.interpolation import (
    INTERPOLATION_DELIMITERS,
    Delimiters,
    detect_interpolation_delimiters,
)
from chki18n.core.issue import create_issue
from chki18n.core.locale import is_locale_code
from chki18n.loader.json_duplicates import JsonDuplicateKey, find_duplicate_json_keys
from chki18n.loader.walk import WalkedFile, walk_files


@dataclass(frozen=True, slots=True)
class ScanResult:
    """What one walk of a translation directory found."""

    #: Layout the files were read as, whether detected or forced.
    file_format: FileFormat
    #: Parsed translations, ready to hand to the analyzer.
    groups: TranslationGroups
    #: The files that became part of a group.
    files: list[SourceFile]
    #: Files that were read but did not belong to any locale.
    skipped: list[str]
    #: Interpolation delimiters the files appear to be written with, or ``None``
    #: when nothing in them looks like one. A guess to offer a user setting a
    #: project up; the run itself uses `interpolation_prefix` either way.
    detected_interpolation: Delimiters | None
    #: Everything that could not be read, as `INVALID_FILE` issues.
    issues: list[Issue]


@dataclass(frozen=True, slots=True)
class _ScannedFile:
    path: str
    relative_path: str
    #: Path segments relative to the scan root, file name last.
    segments: tuple[str, ...]
    data: Any
    #: Delimiters this file's own text looks like it is written with.
    interpolation: Delimiters | None = None
    #: Keys written twice in the text, which parsing has since collapsed.
    duplicate_keys: list[JsonDuplicateKey] = field(default_factory=list)


def _reject_constant(name: str) -> Any:
    """Refuse `NaN` and `Infinity`, which `json.loads` accepts and JSON does not.

    The other two packages refuse a file holding one, so this one has to as well.
    """
    raise ValueError(f"{name} is not JSON")


def _stem_of(file_name: str) -> str:
    cut = file_name.rfind(".")

    return file_name if cut < 1 else file_name[:cut]


def _extension_of(file_name: str) -> str:
    cut = file_name.rfind(".")

    return "" if cut < 1 else file_name[cut + 1 :].lower()


def _nested_locale_keys(data: Any) -> list[str]:
    """Top level keys of a file that name a locale, as the `nested` layout does."""
    if not isinstance(data, dict):
        return []

    return [str(key) for key in data if is_locale_code(str(key))]


def _is_named_for_locale(segments: tuple[str, ...]) -> bool:
    """Whether a file's own name is a locale, as the `single` layout names them."""
    return is_locale_code(_stem_of(segments[-1]))


def _is_in_locale_folder(segments: tuple[str, ...]) -> bool:
    """Whether a file sits in a folder named for a locale, as `folder` puts them."""
    return len(segments) > 1 and is_locale_code(segments[-2])


def _may_hold_locale(segments: tuple[str, ...], file_format: str) -> bool:
    """Whether a file has to be read in a layout.

    Every layout but `nested` names its locales in the path, so a file whose path
    names none can hold no locale's translations, and reading it would only parse
    a fixture or a data file of the application the scan was pointed at.
    """
    if file_format == "single":
        return _is_named_for_locale(segments)

    if file_format == "folder":
        return _is_in_locale_folder(segments)

    return (
        file_format == "nested" or _is_named_for_locale(segments) or _is_in_locale_folder(segments)
    )


def _file_format_of_paths(files: list[_ScannedFile]) -> FileFormat | None:
    """The layout the files' paths say they are in, or ``None`` when no path names a locale.

    The path shape alone is ambiguous (`a/ko.json` and `ko/common.json` both have
    two segments), so the decision is made by which segment is a real locale
    code: a locale named file means `single`, a locale named folder means
    `folder`. Only a file that could be read decides.
    """
    for file in files:
        if _is_named_for_locale(file.segments):
            return "single"

        if _is_in_locale_folder(file.segments):
            return "folder"

    return None


@dataclass(frozen=True, slots=True)
class _UnreadFile:
    """A file the scan found and did not read, because its path names no locale."""

    path: str
    relative_path: str
    segments: tuple[str, ...]


@dataclass(slots=True)
class _Slot:
    """A place in the walk: a file found there, or a directory it could not list."""

    file: WalkedFile | None = None
    issue: Issue | None = None
    read: _ScannedFile | Issue | None = None


def _walk_translation_tree(root: str, options: ResolvedOptions) -> list[_Slot]:
    """Every supported file below `root` and every directory that could not be listed."""
    slots: list[_Slot] = []
    is_excluded_file = create_file_excluder(options.exclude_files)

    def report_unreadable(directory: str) -> None:
        slots.append(
            _Slot(
                issue=create_issue(
                    "INVALID_FILE",
                    file=directory,
                    message=(
                        f"Failed to read the directory '{directory}'. It may not exist or "
                        "read access may be denied."
                    ),
                )
            )
        )

    walk = walk_files(
        root,
        is_excluded_directory=create_path_excluder(options.exclude),
        is_wanted=lambda file: (
            _extension_of(file.segments[-1]) in SUPPORTED_EXTENSIONS
            and not is_excluded_file(file.segments[-1])
        ),
        on_unreadable=report_unreadable,
    )

    for file in walk:
        slots.append(_Slot(file=file))

    return slots


def _read_translation_file(file: WalkedFile, options: ResolvedOptions) -> _ScannedFile | Issue:
    """One file read and parsed, or the reason it could not be."""
    relative_path = "/".join(file.segments)
    read_error = f"Failed to read file '{relative_path}': "

    try:
        # `utf-8-sig` drops the byte order mark a Windows editor often writes
        # first, which `json.loads` would otherwise refuse.
        with open(file.path, encoding="utf-8-sig") as handle:
            content = handle.read()
    except (OSError, UnicodeDecodeError):
        return create_issue(
            "INVALID_FILE",
            file=file.path,
            message=f"{read_error}May be read access denied or invalid file format.",
        )

    if not content.strip():
        return create_issue(
            "INVALID_FILE",
            file=file.path,
            message=f"{read_error}File content is empty.",
        )

    try:
        data = json.loads(content, parse_constant=_reject_constant)
    except ValueError:
        return create_issue(
            "INVALID_FILE",
            file=file.path,
            message=(
                f"{read_error}Content is not json format or parse failed due to an invalid "
                "character."
            ),
        )

    return _ScannedFile(
        path=file.path,
        relative_path=relative_path,
        segments=file.segments,
        data=data,
        interpolation=detect_interpolation_delimiters(content),
        # Read off the text, because the decoder has already discarded it.
        duplicate_keys=(
            find_duplicate_json_keys(content) if "DUPLICATE_KEY" in options.enabled_checks else []
        ),
    )


def _read_slots(
    slots: list[_Slot], is_wanted: Callable[[WalkedFile], bool], options: ResolvedOptions
) -> None:
    """Read the files of `slots` that `is_wanted` asks for, each into its own slot."""
    for slot in slots:
        if slot.file is not None and slot.read is None and is_wanted(slot.file):
            slot.read = _read_translation_file(slot.file, options)


def _scanned_of(slots: list[_Slot]) -> list[_ScannedFile]:
    return [slot.read for slot in slots if isinstance(slot.read, _ScannedFile)]


def _build_groups(
    files: list[_ScannedFile | _UnreadFile],
    file_format: FileFormat,
    issues: list[Issue],
) -> tuple[TranslationGroups, list[SourceFile], list[str]]:
    """Sort the files into comparable groups.

    A group is one set of files that hold the same keys in different languages,
    so a project with several translation files (`common.json`, `errors.json`) is
    compared file by file rather than as one flat pile of keys.
    """
    groups: TranslationGroups = {}
    sources: list[SourceFile] = []
    skipped: list[str] = []

    def add(group: str, locale: str, translations: Any, file: _ScannedFile) -> None:
        # A translation file is an object of keys. Anything else — a top level
        # array, a bare string — has no keys to compare and is reported rather
        # than silently read as an empty one.
        if not isinstance(translations, dict):
            issues.append(
                create_issue(
                    "INVALID_FILE",
                    locale=locale,
                    group=group,
                    file=file.path,
                    message=(
                        f"The translations of `{locale}` in '{file.relative_path}' are not "
                        "an object."
                    ),
                )
            )

            return

        typed: TranslationMap = {str(key): value for key, value in translations.items()}
        groups.setdefault(group, {})[locale] = typed
        sources.append(
            SourceFile(
                path=file.path,
                relative_path=file.relative_path,
                group=group,
                locale=locale,
            )
        )

        # A `nested` file's paths start with the locale that owns them; every
        # other layout's are already relative to the locale's own root.
        prefix = f"{locale}." if file_format == "nested" else ""

        for duplicate in file.duplicate_keys:
            if prefix and not duplicate.path.startswith(prefix):
                continue

            issues.append(
                create_issue(
                    "DUPLICATE_KEY",
                    locale=locale,
                    group=group,
                    key=duplicate.path[len(prefix) :],
                    file=file.path,
                    message=(
                        f"The key is written twice in '{file.relative_path}' "
                        f"(line {duplicate.line}), so one of its values is lost."
                    ),
                )
            )

    for file in files:
        segments = file.segments
        file_name = segments[-1]

        # Left unread because its path names no locale, so it belongs to none.
        if isinstance(file, _UnreadFile):
            skipped.append(file.relative_path)
            continue

        if file_format == "nested":
            locales = _nested_locale_keys(file.data)

            if not locales:
                skipped.append(file.relative_path)
                continue

            for locale in locales:
                add(file.relative_path, locale, file.data[locale], file)

            continue

        if file_format == "folder":
            locale = segments[-2] if len(segments) > 1 else ""

            if not is_locale_code(locale):
                skipped.append(file.relative_path)
                continue

            directory = "/".join(segments[:-2])

            add(f"{directory}/{file_name}" if directory else file_name, locale, file.data, file)
            continue

        locale = _stem_of(file_name)

        if not is_locale_code(locale):
            skipped.append(file.relative_path)
            continue

        add("/".join(segments[:-1]), locale, file.data, file)

    return groups, sources, skipped


def _detected_interpolation_of(files: list[_ScannedFile], skipped: list[str]) -> Delimiters | None:
    """The delimiters the whole tree looks like it is written with.

    The files are read as one text rather than voted on: a project writing
    ``{{name}}`` anywhere is a project whose delimiters are ``{{`` and ``}}``,
    however many of its other files happen to hold no placeholder at all. Files
    that belong to no locale are left out — they are not this project's
    translations.
    """
    ignored = set(skipped)
    seen = {
        file.interpolation.prefix
        for file in files
        if file.interpolation is not None and file.relative_path not in ignored
    }

    for candidate in INTERPOLATION_DELIMITERS:
        if candidate.prefix in seen:
            return candidate

    return None


def scan_translation_directory(path: str, options: ResolvedOptions) -> ScanResult:
    """Read a directory of translation files into the shape the analyzer compares."""
    issues: list[Issue] = []
    slots = _walk_translation_tree(path, options)

    _read_slots(slots, lambda file: _may_hold_locale(file.segments, options.format), options)

    file_format: FileFormat | None = (
        _file_format_of_paths(_scanned_of(slots)) if options.format == "auto" else options.format
    )

    if file_format is None:
        # No path names a locale, so only the files' content can tell whether
        # their top level keys do, as the `nested` layout writes them.
        _read_slots(slots, lambda _: True, options)

        nested = any(_nested_locale_keys(file.data) for file in _scanned_of(slots))
        file_format = "nested" if nested else "single"

    # The issues go out in walk order.
    entries: list[_ScannedFile | _UnreadFile] = []

    for slot in slots:
        if slot.issue is not None:
            issues.append(slot.issue)
        elif slot.file is not None and slot.read is None:
            entries.append(
                _UnreadFile(
                    path=slot.file.path,
                    relative_path="/".join(slot.file.segments),
                    segments=slot.file.segments,
                )
            )
        elif isinstance(slot.read, _ScannedFile):
            entries.append(slot.read)
        elif slot.read is not None:
            issues.append(slot.read)

    groups, sources, skipped = _build_groups(entries, file_format, issues)

    if not sources:
        issues.append(
            create_issue(
                "INVALID_FILE",
                file=path,
                message=(
                    f"No translation file matching the `{file_format}` format was found in "
                    f"'{path}'. Check the `format` option."
                    if entries
                    else f"No translation file was found in '{path}'."
                ),
            )
        )

    read = [entry for entry in entries if isinstance(entry, _ScannedFile)]

    return ScanResult(
        file_format=file_format,
        groups=groups,
        files=sources,
        skipped=skipped,
        detected_interpolation=_detected_interpolation_of(read, skipped),
        issues=issues,
    )
