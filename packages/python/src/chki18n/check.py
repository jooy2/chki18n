"""The two entry points that read translations off the disk."""

from __future__ import annotations

import json
import os
import shutil
import sys
import time
from dataclasses import replace

from chki18n._types import (
    Input,
    Issue,
    Options,
    ResolvedOptions,
    Result,
    SourceFile,
    TranslationGroups,
)
from chki18n.constants import MAX_MEASURED_REPORT_WIDTH
from chki18n.core.duplicate import collect_flat_keys
from chki18n.core.interpolation import Delimiters
from chki18n.core.issue import create_issue
from chki18n.core.result import build_result
from chki18n.core.session import Session
from chki18n.loader.scan import scan_translation_directory
from chki18n.loader.unused_keys import UsageScan, find_unused_keys
from chki18n.logger import create_logger
from chki18n.reporter import ReportInit, format_result


class FileSession(Session):
    """A session over translations read from a directory, which can be read again."""

    __slots__ = ("_detected_interpolation", "_skipped", "path")

    def __init__(self, path: str, options: Options) -> None:
        """Create a session pointed at `path`. Call `reload` to fill it."""
        #: Absolute path the translations were read from. Empty when none was given.
        self.path = path
        self._skipped: list[str] = []
        self._detected_interpolation: Delimiters | None = None

        super().__init__(Input(), options)

    @property
    def skipped(self) -> list[str]:
        """Files that were read but did not belong to any locale."""
        return self._skipped

    @property
    def detected_interpolation(self) -> Delimiters | None:
        """Interpolation delimiters the files look like they are written with.

        ``None`` when nothing in them does. What the scan saw, not what it used:
        `options.interpolation_prefix` is what every check ran with.
        """
        return self._detected_interpolation

    def reload(self) -> None:
        """Read the directory again, replacing everything the session holds."""
        if not self.path:
            self._skipped = []
            self._detected_interpolation = None
            self.reset(
                Input(
                    issues=[
                        create_issue(
                            "INVALID_OPTIONS",
                            level="error",
                            message="No `path` argument is specified.",
                        )
                    ]
                )
            )
            return

        scan = scan_translation_directory(self.path, self.options)
        usage = self._usage_of(scan.groups, scan.files)

        self._skipped = scan.skipped
        self._detected_interpolation = scan.detected_interpolation
        self.reset(
            Input(
                groups=scan.groups,
                files=scan.files,
                issues=scan.issues,
                file_format=scan.file_format,
                unused_keys=usage.unused_keys,
                undefined_keys=usage.undefined_keys,
            )
        )

    def _usage_of(self, groups: TranslationGroups, files: list[SourceFile]) -> UsageScan:
        """What the source tree says about the keys.

        The ones nothing refers to, and the ones it asks for that nothing
        defines. Empty when no source directory was given. The project's own
        translation files are excluded from the search: a key appears verbatim in
        the file that defines it, which would mark every key used.
        """
        source = self.options.source
        wanted = (
            "UNUSED_KEY" in self.options.enabled_checks
            or "UNDEFINED_KEY" in self.options.enabled_checks
        )

        if source is None or not wanted:
            return UsageScan()

        keys: set[str] = set()

        for locales in groups.values():
            for translations in locales.values():
                collect_flat_keys(translations, keys)

        return find_unused_keys(
            os.path.abspath(source),
            sorted(keys),
            self.options,
            skip_files=[file.path for file in files],
        )


def load_translations(path: str | None = None, options: Options | None = None) -> FileSession:
    """Read a directory of translation files once and keep them.

    The same set can then be checked as often as needed without touching the file
    system again. Use this when this module owns the translations. When your own
    application owns them — an editor holding the values it is editing — pass the
    values straight to `Session` or `create_analyzer().check_entry` instead, so
    there is only ever one copy to keep in step.
    """
    given = options if options is not None else Options()
    # `path` first: an explicit `options.path` wins over the argument, which is
    # what the CLI relies on when it passes everything through as options.
    merged = replace(given, path=given.path if given.path else path, flattened=False)
    session = FileSession(
        os.path.abspath(merged.path) if merged.path else "",
        merged,
    )

    session.reload()

    return session


def console_width(options: ResolvedOptions) -> int | None:
    """Columns the console report lays itself out to.

    What `width` asked for, else the terminal's own width, else what `COLUMNS`
    says — a CI runner often sets that where there is no terminal to measure. A
    measured width is capped, since a very wide terminal would put the counts too
    far from the labels for the two to read as one line. ``None`` leaves the
    reporter on its own default.
    """
    if options.width is not None:
        return options.width

    measured = shutil.get_terminal_size((0, 0)).columns

    return min(measured, MAX_MEASURED_REPORT_WIDTH) if measured > 0 else None


def _write_report(result: Result, options: ResolvedOptions) -> Issue | None:
    """Write the report to the file `output` names, creating its directory.

    A write that fails comes back as an issue rather than as an exception, so a
    report that never reached the disk cannot be mistaken for one that did.
    """
    if options.output is None or options.output_reporter is None:
        return None

    file = os.path.abspath(options.output)
    # A saved report is read later, by someone who no longer has the terminal
    # that produced it: no escape codes, and a fixed width.
    text = format_result(
        result,
        options,
        ReportInit(
            reporter=options.output_reporter,
            color=False,
            # Not the terminal's width: the same run has to produce the same file
            # wherever it is run from.
            width=options.width,
            cwd=os.getcwd(),
        ),
    )

    try:
        directory = os.path.dirname(file)

        if directory:
            os.makedirs(directory, exist_ok=True)

        with open(file, "w", encoding="utf-8") as handle:
            handle.write(f"{text}\n")
    except OSError as error:
        return create_issue(
            "INVALID_OPTIONS",
            level="error",
            message=f"The report could not be written to `{options.output}`: {error}",
        )

    return None


def check_translation_files(
    path: str | None = None,
    options: Options | None = None,
) -> Result:
    """Read a directory of translation files and compare every language, in one call.

    Nothing is printed unless `verbose` is set and the process is never exited for
    you, so the result is the only thing a caller has to act on. Reach for
    `load_translations` instead when the same directory is checked more than once.
    """
    started_at = time.monotonic()
    session = load_translations(path, options)
    logger = create_logger(session.options)

    # A backslash cannot appear inside an f-string expression before Python
    # 3.12, so the indent is a name rather than a literal in place.
    tab = "\t"

    logger.debug(f"Options: {json.dumps(session.options.to_json(), indent=tab)}")
    logger.debug(f"Detected file format: {session.file_format}")

    for file in session.skipped:
        logger.debug(f"Skipped '{file}': it does not belong to a known locale.")

    analysis = session.analyze()
    # The session times its own comparison; this call also paid for the scan.
    result = replace(analysis, elapsed_ms=int((time.monotonic() - started_at) * 1000))
    failed_write = _write_report(result, session.options)

    # A report that could not be saved is a failure of the run, so it joins the
    # issues instead of being mentioned once and forgotten.
    if failed_write is not None:
        result = build_result(
            [*result.issues, failed_write],
            session.options,
            locales=result.locales,
            groups=result.groups,
            key_count=result.key_count,
            files=result.files,
            file_format=result.file_format,
            elapsed_ms=result.elapsed_ms,
        )

    if session.options.verbose:
        print(
            format_result(
                result,
                session.options,
                ReportInit(
                    color=session.options.color and sys.stdout.isatty(),
                    width=console_width(session.options),
                    cwd=os.getcwd(),
                ),
            )
        )

    return result
