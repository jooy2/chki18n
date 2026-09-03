"""Every public type the library hands back or takes in.

The comparison itself works on plain dictionaries — which is what a decoded
translation file already is — so nothing here has to be built before a caller
can ask a question. What is written out is what a result carries, and the
options that shape it.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

from chki18n.constants import (
    CheckCode,
    FileFormat,
    GroupBy,
    KeyCase,
    Level,
    Reporter,
)

#: Translation strings of one locale.
#:
#: Accepts both the nested shape read from a file (``{"desc": {"hello": "Hi"}}``)
#: and the flattened shape used internally (``{"desc.hello": "Hi"}``).
TranslationMap = dict[str, Any]

#: ``group name -> locale -> strings``. A group is one comparable set of files.
TranslationGroups = dict[str, dict[str, TranslationMap]]


@dataclass(slots=True)
class LevelCount:
    """How many issues of each severity a set of issues holds."""

    #: Issues that fail the run.
    error: int = 0
    #: Issues worth fixing that never fail the run.
    warn: int = 0
    #: Notes.
    info: int = 0

    def add(self, level: Level) -> None:
        """Add one issue of `level` to the tally."""
        setattr(self, level, getattr(self, level) + 1)

    def of(self, level: Level) -> int:
        """How many issues of `level` the tally holds."""
        count: int = getattr(self, level)

        return count

    def to_json(self) -> dict[str, Any]:
        """The tally as JSON, for the `json` reporter."""
        return {"error": self.error, "warn": self.warn, "info": self.info}


@dataclass(slots=True)
class Summary:
    """Counts a consumer would otherwise have to derive itself."""

    #: Issues that fail the run.
    error: int
    #: Issues worth fixing that never fail the run.
    warn: int
    #: Notes.
    info: int
    #: Every issue, whatever its severity.
    total: int
    #: How many issues each check reported.
    by_code: dict[CheckCode, int]
    #: How many issues of each severity each language holds.
    by_locale: dict[str, LevelCount]
    #: How many issues of each severity each group holds.
    by_group: dict[str, LevelCount]

    @property
    def level_count(self) -> LevelCount:
        """The three level totals on their own, for the reporters that only need those."""
        return LevelCount(error=self.error, warn=self.warn, info=self.info)

    def to_json(self) -> dict[str, Any]:
        """The summary as JSON, for the `json` reporter."""
        return {
            "error": self.error,
            "warn": self.warn,
            "info": self.info,
            "total": self.total,
            "byCode": dict(self.by_code),
            "byLocale": {name: count.to_json() for name, count in self.by_locale.items()},
            "byGroup": {name: count.to_json() for name, count in self.by_group.items()},
        }


@dataclass(frozen=True, slots=True)
class Issue:
    """One finding: what is wrong, where, and how badly it is meant."""

    #: The check that reported it.
    code: CheckCode
    #: Severity, after any `levels` override.
    level: Level
    #: Human readable, one line description of this specific occurrence.
    message: str
    #: Locale the issue belongs to. Empty for issues that are not locale-bound.
    locale: str = ""
    #: Flattened translation key. Empty for file and option level issues.
    key: str = ""
    #: Group the key belongs to. Empty when the caller supplied a single set.
    group: str = ""
    #: The value that was found, when there is one to show.
    value: str | None = None
    #: The target language's own wording, when there is one to compare against.
    target_value: str | None = None
    #: Interpolation placeholder that triggered the issue.
    interpolation: str | None = None
    #: The other key involved, e.g. the first key holding a duplicated value.
    related_key: str | None = None
    #: Absolute path of the file the key came from, when known.
    file: str | None = None

    def with_level(self, level: Level) -> Issue:
        """The same issue reported at another severity."""
        return Issue(
            code=self.code,
            level=level,
            message=self.message,
            locale=self.locale,
            key=self.key,
            group=self.group,
            value=self.value,
            target_value=self.target_value,
            interpolation=self.interpolation,
            related_key=self.related_key,
            file=self.file,
        )

    def to_json(self) -> dict[str, Any]:
        """The issue as JSON, for the `json` reporter.

        A field with nothing in it is left out rather than written as `null`, and
        the field names are the JavaScript package's so one report can be read
        by the same tool whichever package produced it.
        """
        written: dict[str, Any] = {
            "code": self.code,
            "level": self.level,
            "locale": self.locale,
            "key": self.key,
            "group": self.group,
        }

        for name, value in (
            ("value", self.value),
            ("targetValue", self.target_value),
            ("interpolation", self.interpolation),
            ("relatedKey", self.related_key),
            ("file", self.file),
        ):
            if value is not None:
                written[name] = value

        written["message"] = self.message

        return written


@dataclass(frozen=True, slots=True)
class SourceFile:
    """A translation file located by the scanner."""

    #: Absolute path on disk.
    path: str
    #: Path relative to the directory that was scanned.
    relative_path: str
    #: Comparable set the file belongs to.
    group: str
    #: Language the file holds.
    locale: str

    def to_json(self) -> dict[str, Any]:
        """The file as JSON, for the `json` reporter."""
        return {
            "path": self.path,
            "relativePath": self.relative_path,
            "group": self.group,
            "locale": self.locale,
        }


@dataclass(frozen=True, slots=True)
class KeyUsage:
    """A key the source asks for, and the file that asks for it."""

    #: The key as the source wrote it.
    key: str
    #: Absolute path of the file that asks for it.
    file: str | None = None


@dataclass(slots=True)
class Result:
    """Everything one run found, and what it was run over."""

    #: ``False`` when at least one `error` level issue was found.
    success: bool
    #: Every issue, in scan order.
    issues: list[Issue]
    #: The same issues grouped by check code, for report style output.
    issues_by_code: dict[CheckCode, list[Issue]]
    #: Counts derived from `issues`.
    summary: Summary
    #: Locale used as the comparison base.
    target: str
    #: Every locale that took part in the comparison.
    locales: list[str]
    #: Group names that took part in the comparison.
    groups: list[str]
    #: Number of distinct keys compared across all groups.
    key_count: int
    #: Files read from disk. Empty when the input was supplied in memory.
    files: list[SourceFile]
    #: Detected (or forced) on-disk layout. ``None`` for in-memory input.
    file_format: FileFormat | None
    #: How long the comparison took, in milliseconds.
    elapsed_ms: int

    def of(self, code: CheckCode) -> list[Issue]:
        """Every issue the given check reported, or an empty list when it reported none."""
        return self.issues_by_code.get(code, [])

    def to_json(self) -> dict[str, Any]:
        """The whole result as JSON, which is what the `json` reporter writes."""
        return {
            "locales": list(self.locales),
            "groups": list(self.groups),
            "keyCount": self.key_count,
            "files": [file.to_json() for file in self.files],
            "fileFormat": self.file_format,
            "elapsedMs": self.elapsed_ms,
            "target": self.target,
            "success": self.success,
            "issues": [issue.to_json() for issue in self.issues],
            "issuesByCode": {
                code: [issue.to_json() for issue in issues]
                for code, issues in self.issues_by_code.items()
            },
            "summary": self.summary.to_json(),
        }


@dataclass(frozen=True, slots=True, kw_only=True)
class Options:
    """Options shared by the CLI and the Python API.

    Every CLI flag maps onto one of these fields, so both entry points resolve
    through `resolve_options` and the two can never drift apart. Everything is
    optional and everything is keyword-only.

    The fields a command line has to spell out take their text form as well as
    their typed one: `checks="NO_KEY,EMPTY_VALUE"` and
    `checks=["NO_KEY", "EMPTY_VALUE"]` mean the same thing, and a list accepts
    commas or spaces alike.
    """

    #: Directory holding the translation files.
    path: str | None = None
    #: Locale every other locale is compared against. Default `en`.
    target: str | None = None
    #: Force an on-disk layout instead of detecting it. Default `auto`.
    format: str | None = None
    #: Only run these checks. Mutually exclusive with `ignore_checks`.
    checks: Sequence[str] | str | None = None
    #: Run every check except these.
    ignore_checks: Sequence[str] | str | None = None
    #: Report these checks at a different severity, e.g.
    #: ``{"EMPTY_VALUE": "error"}`` to fail a run on an empty value. Also accepts
    #: the CLI's ``CODE=level`` list. Only comparison checks can be re-graded.
    levels: Mapping[str, str] | Sequence[str] | str | None = None
    #: Opening delimiter of an interpolation placeholder. Default ``{``.
    interpolation_prefix: str | None = None
    #: Closing delimiter of an interpolation placeholder. Default ``}``.
    interpolation_suffix: str | None = None
    #: Directory names skipped while scanning. Replaces the default list.
    exclude: Sequence[str] | str | None = None
    #: Directory of source files to search for key usages. Without it neither
    #: `UNUSED_KEY` nor `UNDEFINED_KEY` has anything to go on.
    source: str | None = None
    #: Names a translation call goes by, which is how `UNDEFINED_KEY` finds the
    #: keys the source asks for. Replaces the default list rather than adding to
    #: it. Defaults to `TRANSLATION_FUNCTIONS`.
    translate_functions: Sequence[str] | str | None = None
    #: Case every segment of a key has to be written in, which is what the
    #: `KEY_NAMING` check compares against. Unset, that check reports nothing.
    key_case: str | None = None
    #: Levels a key may be nested, for the `KEY_DEPTH` check. ``1`` allows
    #: ``folder``, ``2`` allows ``attr.folder``. Unset, that check reports
    #: nothing.
    max_key_depth: int | str | None = None
    #: How many times longer or shorter than the target language a value may be
    #: before `SUSPICIOUS_LENGTH` reports it. ``4`` allows a quarter to four
    #: times. Unset, that check reports nothing.
    length_ratio: float | str | None = None
    #: Treat the input as already flattened and skip the flatten pass.
    flattened: bool | None = None
    #: Shape the report is rendered in. Default `pretty`.
    reporter: str | None = None
    #: Axis the report groups its issues by. Default `locale`.
    group_by: str | None = None
    #: Also write the report to this file. The extension picks the reporter —
    #: ``.json`` and ``.md`` have one of their own, anything else gets plain
    #: text — unless `reporter` names one, which always wins.
    output: str | None = None
    #: Colour the console report. Default ``True`` where the terminal allows it.
    color: bool | None = None
    #: Columns to lay the report out to. Defaults to the terminal's own width,
    #: then to ``COLUMNS``, then to `DEFAULT_REPORT_WIDTH`.
    width: int | str | None = None
    #: Print progress and results to the console. Default ``False``.
    verbose: bool | None = None
    #: Print info level log lines. Only meaningful with `verbose`.
    info: bool | None = None
    #: Print warn level log lines. Only meaningful with `verbose`.
    warn: bool | None = None
    #: Print debug log lines.
    debug: bool | None = None


@dataclass(frozen=True, slots=True)
class ResolvedOptions:
    """Options after defaults, aliases and text forms have been resolved."""

    #: Directory holding the translation files, or ``None`` when none was given.
    path: str | None
    #: Locale every other locale is compared against.
    target: str
    #: On-disk layout, forced or left at `auto` for the scanner to detect.
    format: FileFormat
    #: The checks this run will report.
    enabled_checks: frozenset[CheckCode]
    #: Severity overrides, or ``None`` when every check keeps its own.
    levels: dict[CheckCode, Level] | None
    #: Opening delimiter of an interpolation placeholder.
    interpolation_prefix: str
    #: Closing delimiter of an interpolation placeholder.
    interpolation_suffix: str
    #: Directory names skipped while scanning.
    exclude: frozenset[str]
    #: Directory of source files to search for key usages, or ``None``.
    source: str | None
    #: Names a translation call goes by.
    translate_functions: tuple[str, ...]
    #: Case every key segment has to use, or ``None`` to leave key names alone.
    key_case: KeyCase | None
    #: Levels a key may be nested, or ``None`` to leave key depth alone.
    max_key_depth: int | None
    #: How far a value's length may be from the target language's, or ``None``.
    length_ratio: float | None
    #: Shape the report is rendered in.
    reporter: Reporter
    #: Axis the report groups its issues by.
    group_by: GroupBy
    #: File the report is also written to, or ``None``.
    output: str | None
    #: Reporter the `output` file gets. ``None`` when nothing is written.
    output_reporter: Reporter | None
    #: Whether the console report may use colour.
    color: bool
    #: Columns asked for, or ``None`` to measure the terminal instead.
    width: int | None
    #: Whether the input is already flattened.
    flattened: bool
    #: Whether the run prints its report.
    verbose: bool
    #: Whether info level lines are shown.
    info: bool
    #: Whether warn level lines are shown.
    warn: bool
    #: Whether debug lines are shown.
    debug: bool

    def to_json(self) -> dict[str, Any]:
        """The resolved options as JSON, which is what `--debug` prints."""
        return {
            "path": self.path,
            "target": self.target,
            "format": self.format,
            "enabledChecks": [code for code in self.enabled_checks],
            "levels": dict(self.levels) if self.levels is not None else None,
            "interpolationPrefix": self.interpolation_prefix,
            "interpolationSuffix": self.interpolation_suffix,
            "exclude": list(self.exclude),
            "source": self.source,
            "translateFunctions": list(self.translate_functions),
            "keyCase": self.key_case,
            "maxKeyDepth": self.max_key_depth,
            "lengthRatio": self.length_ratio,
            "reporter": self.reporter,
            "groupBy": self.group_by,
            "output": self.output,
            "outputReporter": self.output_reporter,
            "color": self.color,
            "width": self.width,
            "flattened": self.flattened,
            "verbose": self.verbose,
            "info": self.info,
            "warn": self.warn,
            "debug": self.debug,
        }


@dataclass(frozen=True, slots=True, kw_only=True)
class Input:
    """Input accepted by `analyze_translations`."""

    #: Several comparable sets, e.g. one entry per translation file name.
    groups: TranslationGroups | None = None
    #: A single set. Shorthand for ``{"": locales}``.
    locales: dict[str, TranslationMap] | None = None
    #: Maps a ``group/locale`` pair onto the file it was read from.
    files: list[SourceFile] = field(default_factory=list)
    #: Issues found while producing this input, e.g. a file that could not be
    #: parsed. They are reported alongside the comparison's own findings.
    issues: list[Issue] = field(default_factory=list)
    #: Layout the input came from, carried through to the result.
    file_format: FileFormat | None = None
    #: Flattened keys nothing appears to reference, as `UNUSED_KEY` issues.
    #:
    #: Whether a key is used is a fact about the source tree rather than about
    #: the translations, so it is supplied rather than worked out here.
    #: `check_translation_files` fills this in when given a `source` directory;
    #: an application that already knows can pass its own answer.
    unused_keys: list[str] = field(default_factory=list)
    #: Keys the scanned source asks for that no language file defines, as
    #: `UNDEFINED_KEY` issues. Supplied for the same reason as `unused_keys`.
    undefined_keys: list[KeyUsage] = field(default_factory=list)


@dataclass(frozen=True, slots=True, kw_only=True)
class Entry:
    """One key of one group, as fed to the incremental `check_entry`."""

    #: The flattened key being checked.
    key: str
    #: ``locale -> value``. The target locale's value is read from here too.
    values: dict[str, Any]
    #: Group the key belongs to, carried through to every issue.
    group: str = ""
    #: Locales to compare. Defaults to the keys of `values`; pass it explicitly
    #: when a locale that owns no value still has to be reported as missing.
    locales: Sequence[str] | None = None


__all__ = [
    "Entry",
    "Input",
    "Issue",
    "KeyUsage",
    "LevelCount",
    "Options",
    "ResolvedOptions",
    "Result",
    "SourceFile",
    "Summary",
    "TranslationGroups",
    "TranslationMap",
]
