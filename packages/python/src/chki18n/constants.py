"""Every value the library is configured with, and the table of checks it runs.

The check codes, the severities and the option choices are plain strings, the
same spellings the CLI and the JSON reporter use. `Literal` types make them
autocomplete and type-check without turning them into objects a JSON reporter
would have to unwrap again.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final, Literal, get_args

#: A single check identifier.
CheckCode = Literal[
    "UNKNOWN",
    "INVALID_OPTIONS",
    "INVALID_FILE",
    "INVALID_VALUE_TYPE",
    "NO_LOCALE",
    "NO_KEY",
    "DUMMY_KEY",
    "DUPLICATE_KEY",
    "UNUSED_KEY",
    "UNDEFINED_KEY",
    "NO_PLURAL_FORM",
    "KEY_NAMING",
    "KEY_DEPTH",
    "EMPTY_VALUE",
    "NO_INTERPOLATION_KEY",
    "EXTRA_INTERPOLATION_KEY",
    "INTERPOLATION_COUNT",
    "TAG_MISMATCH",
    "NOT_TRANSLATED_VALUE",
    "UNTRANSLATED_SCRIPT",
    "DUPLICATE_VALUE",
    "INCONSISTENT_VALUE",
    "SURROUNDING_WHITESPACE",
    "INVISIBLE_CHARACTER",
    "MISSING_NUMBER",
    "NUMBER_MISMATCH",
    "SUSPICIOUS_LENGTH",
]

#: Every check code there is, in declaration order.
CHECK_CODES: Final[tuple[CheckCode, ...]] = get_args(CheckCode)

#: Severity of a reported issue. `info` issues never fail a run.
Level = Literal["error", "warn", "info"]

#: Every severity, worst first.
LEVELS: Final[tuple[Level, ...]] = get_args(Level)

#: On-disk layout of the translation files.
FileFormat = Literal["auto", "single", "folder", "nested"]

#: Every layout the scanner reads.
FILE_FORMATS: Final[tuple[FileFormat, ...]] = get_args(FileFormat)

#: Case a project writes the segments of its translation keys in.
KeyCase = Literal["kebab", "camel", "snake"]

#: Every case `key_case` accepts.
KEY_CASES: Final[tuple[KeyCase, ...]] = get_args(KeyCase)

#: Shape a finished result is rendered in.
Reporter = Literal["pretty", "list", "json", "markdown", "github"]

#: Every reporter there is.
REPORTERS: Final[tuple[Reporter, ...]] = get_args(Reporter)

#: Axis a report groups its issues by.
GroupBy = Literal["locale", "code", "group", "file", "none"]

#: Every axis a report can group by.
GROUP_BYS: Final[tuple[GroupBy, ...]] = get_args(GroupBy)

#: A plural form a language may need, in the order CLDR lists them.
PluralCategory = Literal["zero", "one", "two", "few", "many", "other"]

#: Every plural category, in the order CLDR lists them.
PLURAL_CATEGORIES: Final[tuple[PluralCategory, ...]] = get_args(PluralCategory)


@dataclass(frozen=True, slots=True)
class CheckMeta:
    """Everything a consumer needs to render a check without hard-coding strings."""

    #: The severity the check reports at unless `levels` re-grades it.
    level: Level
    #: A heading for a list of occurrences.
    summary: str
    #: What the check means, in one sentence.
    description: str


#: What each check is called, what it means, and how badly it is meant.
CHECK_META: Final[dict[CheckCode, CheckMeta]] = {
    "UNKNOWN": CheckMeta(
        level="error",
        summary="An unexpected problem occurred",
        description="Unknown error.",
    ),
    "INVALID_OPTIONS": CheckMeta(
        level="warn",
        summary="Some options could not be used as given",
        description="The option value is missing or not usable.",
    ),
    "INVALID_FILE": CheckMeta(
        level="error",
        summary="Some translation files could not be read",
        description="The file is missing, empty, unreadable or not valid JSON.",
    ),
    "INVALID_VALUE_TYPE": CheckMeta(
        level="warn",
        summary="Some values are not translatable strings",
        description="The value is not a string, so it cannot be compared or translated.",
    ),
    "NO_LOCALE": CheckMeta(
        level="error",
        summary="Some languages have no file in a group at all",
        description=(
            "This group holds no translations for the language, so none of its keys exist."
        ),
    ),
    "NO_KEY": CheckMeta(
        level="error",
        summary="Some translation files did not include the following keys",
        description="The key exists in the target language but is missing here.",
    ),
    "DUMMY_KEY": CheckMeta(
        level="warn",
        summary="The following keys do not exist in the target language",
        description="The key is missing from the target language, so it may be unused.",
    ),
    "DUPLICATE_KEY": CheckMeta(
        level="error",
        summary="Some keys are defined more than once",
        description="The key is defined twice, so one of its two values is silently lost.",
    ),
    "UNUSED_KEY": CheckMeta(
        level="info",
        summary="The following keys were not found in the scanned source files",
        description="Nothing in the scanned sources appears to reference this key.",
    ),
    "KEY_NAMING": CheckMeta(
        level="warn",
        summary="Some keys are not named the way the project asked",
        description="The key is not written in the case `key_case` asks for.",
    ),
    "KEY_DEPTH": CheckMeta(
        level="warn",
        summary="Some keys are nested deeper than the project allows",
        description="The key has more levels than `max_key_depth` allows.",
    ),
    "UNDEFINED_KEY": CheckMeta(
        level="warn",
        summary="The scanned source files ask for keys nothing defines",
        description="The source calls for this key and no language file defines it.",
    ),
    "NO_PLURAL_FORM": CheckMeta(
        level="warn",
        summary="Some keys are missing a plural form their language needs",
        description=("The language needs a plural form of this key that the file does not define."),
    ),
    "EMPTY_VALUE": CheckMeta(
        level="warn",
        summary="The value for the following items is empty",
        description="The key is defined but its value is an empty string.",
    ),
    "NO_INTERPOLATION_KEY": CheckMeta(
        level="error",
        summary="The interpolation key does not match the target language",
        description="An interpolation key of the target language is missing from this value.",
    ),
    "EXTRA_INTERPOLATION_KEY": CheckMeta(
        level="error",
        summary="Some values use interpolation keys the target language does not have",
        description=(
            "This value has an interpolation key that the target language does not define."
        ),
    ),
    "INTERPOLATION_COUNT": CheckMeta(
        level="error",
        summary="Some values use an interpolation key a different number of times",
        description=(
            "The value repeats an interpolation key more or fewer times than the target language."
        ),
    ),
    "TAG_MISMATCH": CheckMeta(
        level="warn",
        summary="Some values do not carry the same markup as the target language",
        description="The markup tags of this value are not the ones the target language uses.",
    ),
    "NOT_TRANSLATED_VALUE": CheckMeta(
        level="warn",
        summary="Some keys have the same value as the target language",
        description=(
            "The value is identical to the target language, so the translation may be incomplete."
        ),
    ),
    "UNTRANSLATED_SCRIPT": CheckMeta(
        level="warn",
        summary="Some values are not written in the script of their language",
        description="The value holds no character of the script this language is written in.",
    ),
    "DUPLICATE_VALUE": CheckMeta(
        level="warn",
        summary="Some keys have duplicate values",
        description="Another key in the same locale already uses this value.",
    ),
    "INCONSISTENT_VALUE": CheckMeta(
        level="warn",
        summary="Some keys with one shared original are translated differently",
        description=(
            "Another key with the same target language value is translated differently here."
        ),
    ),
    "SURROUNDING_WHITESPACE": CheckMeta(
        level="warn",
        summary="Some values begin or end with whitespace",
        description="The value has leading or trailing whitespace, which is usually accidental.",
    ),
    "INVISIBLE_CHARACTER": CheckMeta(
        level="warn",
        summary="Some values hold a character nothing will draw",
        description="The value holds a zero width, bidirectional or non-breaking character.",
    ),
    "MISSING_NUMBER": CheckMeta(
        level="warn",
        summary="Some values dropped a number the target language has",
        description="The target language value contains digits but this value does not.",
    ),
    "NUMBER_MISMATCH": CheckMeta(
        level="warn",
        summary="Some values changed a number the target language has",
        description="The numbers in this value are not the ones the target language uses.",
    ),
    "SUSPICIOUS_LENGTH": CheckMeta(
        level="info",
        summary="Some values are far longer or shorter than the target language",
        description=(
            "The value is further from the target language length than `length_ratio` allows."
        ),
    ),
}

#: Checks that compare translation data, in report order.
#:
#: `INVALID_*` and `UNKNOWN` are excluded: they report how the run itself went
#: and cannot be switched off through `checks` / `ignore_checks`.
ANALYZE_CHECK_CODES: Final[tuple[CheckCode, ...]] = (
    "INVALID_VALUE_TYPE",
    "NO_LOCALE",
    "NO_KEY",
    "DUMMY_KEY",
    "DUPLICATE_KEY",
    "UNUSED_KEY",
    "UNDEFINED_KEY",
    "NO_PLURAL_FORM",
    "KEY_NAMING",
    "KEY_DEPTH",
    "EMPTY_VALUE",
    "NO_INTERPOLATION_KEY",
    "EXTRA_INTERPOLATION_KEY",
    "INTERPOLATION_COUNT",
    "TAG_MISMATCH",
    "NOT_TRANSLATED_VALUE",
    "UNTRANSLATED_SCRIPT",
    "DUPLICATE_VALUE",
    "INCONSISTENT_VALUE",
    "SURROUNDING_WHITESPACE",
    "INVISIBLE_CHARACTER",
    "MISSING_NUMBER",
    "NUMBER_MISMATCH",
    "SUSPICIOUS_LENGTH",
)

#: Checks that need to see every key of a locale at once, so they cannot be
#: answered by `check_entry`, which is handed one key at a time.
CROSS_KEY_CHECK_CODES: Final[tuple[CheckCode, ...]] = (
    "DUPLICATE_VALUE",
    # Two keys have to be seen together for one to be the other's disagreement,
    # and a language missing from a group is a fact about the whole group.
    "INCONSISTENT_VALUE",
    "NO_LOCALE",
    # A key can only be seen twice by looking at the whole file, and whether one
    # is referenced is a fact about the source tree rather than about the key.
    "DUPLICATE_KEY",
    "UNUSED_KEY",
    # Whether the source asks for a key is a fact about the source tree, and a
    # language needs every form of a plural key before any of them is right.
    "UNDEFINED_KEY",
    "NO_PLURAL_FORM",
)

#: The language every other language is compared against, unless one is named.
DEFAULT_TARGET_LOCALE: Final = "en"

#: Opening delimiter of an interpolation placeholder, unless one is named.
DEFAULT_INTERPOLATION_PREFIX: Final = "{"

#: Closing delimiter of an interpolation placeholder, unless one is named.
DEFAULT_INTERPOLATION_SUFFIX: Final = "}"

#: Directory names never worth scanning for translation files.
DEFAULT_EXCLUDE_DIRS: Final[tuple[str, ...]] = (
    "node_modules",
    "dist",
    "build",
    "out",
    "coverage",
    ".git",
    ".next",
    ".nuxt",
    ".svelte-kit",
    ".turbo",
    ".cache",
)

#: File extensions the scanner reads.
SUPPORTED_EXTENSIONS: Final[tuple[str, ...]] = ("json",)

#: Extensions the unused-key scan will read.
#:
#: An allowlist rather than a blocklist of binaries: an unknown binary decoded
#: as UTF-8 could contain a key's bytes by chance and wrongly mark it used, so
#: anything unrecognised is skipped.
SOURCE_EXTENSIONS: Final[tuple[str, ...]] = (
    # Web and app source
    "js",
    "jsx",
    "mjs",
    "cjs",
    "ts",
    "tsx",
    "mts",
    "cts",
    "vue",
    "svelte",
    "astro",
    "html",
    "htm",
    "xml",
    "xhtml",
    "php",
    "rb",
    "py",
    "go",
    "rs",
    "java",
    "kt",
    "kts",
    "swift",
    "dart",
    "cs",
    "ex",
    "exs",
    # Styles and templates
    "css",
    "scss",
    "sass",
    "less",
    "styl",
    "hbs",
    "ejs",
    "pug",
    "twig",
    "erb",
    "liquid",
    # Data and docs that can carry a key
    "json",
    "jsonc",
    "json5",
    "yaml",
    "yml",
    "toml",
    "md",
    "mdx",
    "txt",
)

#: Names a translation call goes by, for the `UNDEFINED_KEY` scan.
#:
#: `t('key')` covers i18next, react-i18next and vue-i18n, including `i18n.t` and
#: a `t` bound by `useTranslation`, since a call is matched wherever the name
#: ends.
TRANSLATION_FUNCTIONS: Final[tuple[str, ...]] = ("t", "$t", "translate")

#: Files above this size are skipped by the unused-key scan.
SOURCE_MAX_FILE_BYTES: Final = 5 * 1024 * 1024

#: The reporter a finished result is rendered with, unless one is named.
DEFAULT_REPORTER: Final[Reporter] = "pretty"

#: The axis a report groups its issues by, unless one is named.
DEFAULT_GROUP_BY: Final[GroupBy] = "locale"

#: The reporter an `output` file name implies.
#:
#: Anything not listed here is treated as plain text and gets the default
#: reporter without its colours.
REPORTER_BY_EXTENSION: Final[dict[str, Reporter]] = {
    "json": "json",
    "md": "markdown",
    "markdown": "markdown",
}

#: Width a report is laid out at when the terminal does not report its own.
DEFAULT_REPORT_WIDTH: Final = 96

#: Widest a report lays itself out to when the width was measured rather than
#: asked for.
#:
#: A very wide terminal would otherwise put the counts so far from the labels
#: that the two stop reading as one line. `width` overrides it.
MAX_MEASURED_REPORT_WIDTH: Final = 120
