"""Reading a directory of translation files into the shape the analyzer compares.

This is the only part of the library that walks the file system looking for
translations.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any

from chki18n._types import Issue, ResolvedOptions, SourceFile, TranslationGroups, TranslationMap
from chki18n.constants import SUPPORTED_EXTENSIONS, FileFormat
from chki18n.core.exclude import create_file_excluder, create_path_excluder
from chki18n.core.issue import create_issue
from chki18n.core.locale import is_locale_code
from chki18n.loader.json_duplicates import JsonDuplicateKey, find_duplicate_json_keys


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
    #: Everything that could not be read, as `INVALID_FILE` issues.
    issues: list[Issue]


@dataclass(frozen=True, slots=True)
class _ScannedFile:
    path: str
    relative_path: str
    #: Path segments relative to the scan root, file name last.
    segments: tuple[str, ...]
    data: Any
    #: Keys written twice in the text, which parsing has since collapsed.
    duplicate_keys: list[JsonDuplicateKey] = field(default_factory=list)


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


def _collect_files(
    root: str,
    options: ResolvedOptions,
    issues: list[Issue],
) -> list[_ScannedFile]:
    """Read every supported file below `root`, parsed and in a stable order."""
    files: list[_ScannedFile] = []
    is_excluded_directory = create_path_excluder(options.exclude)
    is_excluded_file = create_file_excluder(options.exclude_files)

    def walk(directory: str, segments: tuple[str, ...]) -> None:
        try:
            entries = sorted(os.scandir(directory), key=lambda entry: entry.name)
        except OSError:
            issues.append(
                create_issue(
                    "INVALID_FILE",
                    file=directory,
                    message=(
                        f"Failed to read the directory '{directory}'. It may not exist or "
                        "read access may be denied."
                    ),
                )
            )
            return

        for entry in entries:
            # Hidden entries are tooling state, never translations.
            if entry.name.startswith("."):
                continue

            path = os.path.join(directory, entry.name)

            if entry.is_dir():
                if not is_excluded_directory((*segments, entry.name)):
                    walk(path, (*segments, entry.name))

                continue

            if _extension_of(entry.name) not in SUPPORTED_EXTENSIONS or is_excluded_file(
                entry.name
            ):
                continue

            relative_path = "/".join((*segments, entry.name))
            read_error = f"Failed to read file '{relative_path}': "

            try:
                with open(path, encoding="utf-8") as handle:
                    content = handle.read()
            except OSError:
                issues.append(
                    create_issue(
                        "INVALID_FILE",
                        file=path,
                        message=f"{read_error}May be read access denied or invalid file format.",
                    )
                )
                continue
            except UnicodeDecodeError:
                issues.append(
                    create_issue(
                        "INVALID_FILE",
                        file=path,
                        message=f"{read_error}May be read access denied or invalid file format.",
                    )
                )
                continue

            if not content.strip():
                issues.append(
                    create_issue(
                        "INVALID_FILE",
                        file=path,
                        message=f"{read_error}File content is empty.",
                    )
                )
                continue

            try:
                data = json.loads(content)
            except ValueError:
                issues.append(
                    create_issue(
                        "INVALID_FILE",
                        file=path,
                        message=(
                            f"{read_error}Content is not json format or parse failed due to "
                            "an invalid character."
                        ),
                    )
                )
                continue

            files.append(
                _ScannedFile(
                    path=path,
                    relative_path=relative_path,
                    segments=(*segments, entry.name),
                    data=data,
                    # Read off the text, because the decoder has already
                    # discarded it.
                    duplicate_keys=(
                        find_duplicate_json_keys(content)
                        if "DUPLICATE_KEY" in options.enabled_checks
                        else []
                    ),
                )
            )

    walk(root, ())

    return files


def _detect_file_format(files: list[_ScannedFile]) -> FileFormat:
    """Work out how the files are laid out.

    The path shape alone is ambiguous (`a/ko.json` and `ko/common.json` both have
    two segments), so the decision is made by which segment is a real locale
    code: a locale named file means `single`, a locale named folder means
    `folder`. When no path segment is a locale, a file whose top level keys are
    locales means `nested`.
    """
    for file in files:
        if is_locale_code(_stem_of(file.segments[-1])):
            return "single"

        if len(file.segments) > 1 and is_locale_code(file.segments[-2]):
            return "folder"

    for file in files:
        if _nested_locale_keys(file.data):
            return "nested"

    return "single"


def _build_groups(
    files: list[_ScannedFile],
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


def scan_translation_directory(path: str, options: ResolvedOptions) -> ScanResult:
    """Read a directory of translation files into the shape the analyzer compares."""
    issues: list[Issue] = []
    files = _collect_files(path, options, issues)
    file_format = _detect_file_format(files) if options.format == "auto" else options.format
    groups, sources, skipped = _build_groups(files, file_format, issues)

    if not sources:
        issues.append(
            create_issue(
                "INVALID_FILE",
                file=path,
                message=(
                    f"No translation file matching the `{file_format}` format was found in "
                    f"'{path}'. Check the `format` option."
                    if files
                    else f"No translation file was found in '{path}'."
                ),
            )
        )

    return ScanResult(
        file_format=file_format,
        groups=groups,
        files=sources,
        skipped=skipped,
        issues=issues,
    )
