"""The single definition of every option, and the one place they are resolved.

The CLI builds its parser and its help text from `OPTION_DEFINITIONS` and the
Python API resolves the same fields, so a flag and its option counterpart can
never drift apart.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Final, Literal, cast

from chki18n._types import Issue, Options, ResolvedOptions
from chki18n.constants import (
    ANALYZE_CHECK_CODES,
    CHECK_CODES,
    DEFAULT_EXCLUDE_DIRS,
    DEFAULT_EXCLUDE_FILES,
    DEFAULT_GROUP_BY,
    DEFAULT_INTERPOLATION_PREFIX,
    DEFAULT_INTERPOLATION_SUFFIX,
    DEFAULT_REPORTER,
    DEFAULT_TARGET_LOCALE,
    FILE_FORMATS,
    GROUP_BYS,
    KEY_CASES,
    LEVELS,
    REPORTER_BY_EXTENSION,
    REPORTERS,
    TRANSLATION_FUNCTIONS,
    CheckCode,
    FileFormat,
    GroupBy,
    KeyCase,
    Level,
    Reporter,
)
from chki18n.core.issue import create_issue

#: What a command line flag carries after its name.
OptionType = Literal["string", "boolean", "list"]


@dataclass(frozen=True, slots=True)
class OptionDefinition:
    """One option, as both a CLI flag and an API field."""

    #: CLI flag, without the leading dashes.
    flag: str
    #: Field name on `Options`, in its Python spelling.
    option: str
    #: What the flag carries after its name.
    type: OptionType
    #: One line, as the usage text prints it.
    description: str
    #: Placeholder shown in the usage text for value taking flags.
    value_name: str | None = None


#: Every option the CLI and the Python API share, in the order `--help` lists them.
OPTION_DEFINITIONS: Final[tuple[OptionDefinition, ...]] = (
    OptionDefinition(
        flag="path",
        option="path",
        type="string",
        value_name="<dir>",
        description="The directory where the files to be scanned are located (required)",
    ),
    OptionDefinition(
        flag="target",
        option="target",
        type="string",
        value_name="<locale>",
        description=(
            "The language every other language is compared against (default: "
            f"`{DEFAULT_TARGET_LOCALE}`)"
        ),
    ),
    OptionDefinition(
        flag="format",
        option="format",
        type="string",
        value_name="<format>",
        description="Layout of the translation files: `auto`, `single`, `folder` or `nested`",
    ),
    OptionDefinition(
        flag="checks",
        option="checks",
        type="list",
        value_name="<codes>",
        description="Run only these comma separated check codes",
    ),
    OptionDefinition(
        flag="ignore-checks",
        option="ignore_checks",
        type="list",
        value_name="<codes>",
        description="Run every check except these comma separated check codes",
    ),
    OptionDefinition(
        flag="levels",
        option="levels",
        type="list",
        value_name="<code=level>",
        description="Report a check at another severity, e.g. `EMPTY_VALUE=error`",
    ),
    OptionDefinition(
        flag="interpolation-prefix",
        option="interpolation_prefix",
        type="string",
        value_name="<str>",
        description=(
            f"Opening delimiter of an interpolation key (default: `{DEFAULT_INTERPOLATION_PREFIX}`)"
        ),
    ),
    OptionDefinition(
        flag="interpolation-suffix",
        option="interpolation_suffix",
        type="string",
        value_name="<str>",
        description=(
            f"Closing delimiter of an interpolation key (default: `{DEFAULT_INTERPOLATION_SUFFIX}`)"
        ),
    ),
    OptionDefinition(
        flag="exclude",
        option="exclude",
        type="list",
        value_name="<dirs>",
        description="Comma separated directory names or paths to skip while scanning",
    ),
    OptionDefinition(
        flag="exclude-files",
        option="exclude_files",
        type="list",
        value_name="<globs>",
        description="Comma separated file name patterns never read as translations",
    ),
    OptionDefinition(
        flag="source",
        option="source",
        type="string",
        value_name="<dir>",
        description=(
            "Source files to read for key usages (enables `UNUSED_KEY` and `UNDEFINED_KEY`)"
        ),
    ),
    OptionDefinition(
        flag="translate-functions",
        option="translate_functions",
        type="list",
        value_name="<names>",
        description=(
            "Comma separated names a translation call goes by (default: "
            f"`{'`, `'.join(TRANSLATION_FUNCTIONS)}`)"
        ),
    ),
    OptionDefinition(
        flag="key-case",
        option="key_case",
        type="string",
        value_name="<case>",
        description=f"Case every key segment has to use: `{'`, `'.join(KEY_CASES)}`",
    ),
    OptionDefinition(
        flag="max-key-depth",
        option="max_key_depth",
        type="string",
        value_name="<levels>",
        description="How many levels a key may be nested, e.g. `2` for `attr.folder`",
    ),
    OptionDefinition(
        flag="length-ratio",
        option="length_ratio",
        type="string",
        value_name="<times>",
        description=("Report a value more than this many times longer or shorter than the target"),
    ),
    OptionDefinition(
        flag="reporter",
        option="reporter",
        type="string",
        value_name="<name>",
        description=f"How to render the report: `{'`, `'.join(REPORTERS)}`",
    ),
    OptionDefinition(
        flag="group-by",
        option="group_by",
        type="string",
        value_name="<axis>",
        description=f"Group the reported issues by `{'`, `'.join(GROUP_BYS)}`",
    ),
    OptionDefinition(
        flag="output",
        option="output",
        type="string",
        value_name="<file>",
        description="Also write the report to this file, in the format its extension implies",
    ),
    OptionDefinition(
        flag="width",
        option="width",
        type="string",
        value_name="<columns>",
        description=("Lay the report out to this many columns instead of measuring the terminal"),
    ),
    OptionDefinition(
        flag="no-color",
        option="color",
        type="boolean",
        description="Do not colour the output",
    ),
    OptionDefinition(
        flag="no-info",
        option="info",
        type="boolean",
        description="Do not show info messages",
    ),
    OptionDefinition(
        flag="no-warn",
        option="warn",
        type="boolean",
        description="Do not show warning messages",
    ),
    OptionDefinition(
        flag="debug",
        option="debug",
        type="boolean",
        description="Show debug messages",
    ),
)

_LIST_SEPARATOR: Final = re.compile(r"[,\s]+")

_FLAG_TO_SNAKE: Final = re.compile(r"-")


def split_option_list(value: Sequence[str] | str | None) -> list[str]:
    """Accept `["A", "B"]`, `"A,B"` and `"A B"` alike, and drop what is left over."""
    if value is None:
        return []

    if isinstance(value, str):
        return [item.strip() for item in _LIST_SEPARATOR.split(value) if item.strip()]

    found: list[str] = []

    for item in value:
        found.extend(split_option_list(item))

    return found


def reporter_of_file_name(file_name: str) -> Reporter:
    """The reporter a file name asks for.

    A `.json` or a `.md` report has a shape of its own; anything else is read as
    plain text and gets the default reporter without its colours.
    """
    return REPORTER_BY_EXTENSION.get(file_name.rsplit(".", 1)[-1].lower(), DEFAULT_REPORTER)


def build_usage_text(bin_name: str) -> str:
    """Usage text for `--help`, generated from `OPTION_DEFINITIONS`."""
    lines = [
        "  "
        + f"--{definition.flag}"
        f"{f' {definition.value_name}' if definition.value_name else ''}".ljust(32)
        + definition.description
        for definition in OPTION_DEFINITIONS
    ]

    return "\n".join(
        [
            f"Usage: `{bin_name} [options]` or `{bin_name} [options] <targetDirectory>`",
            "",
            "Options:",
            *lines,
            "  --help                          Show this message",
            "  --version                       Show the installed version",
            "",
            f"Check codes: {', '.join(ANALYZE_CHECK_CODES)}",
        ]
    )


def options_from_args(args: Mapping[str, Any]) -> Options:
    """Read raw CLI arguments into the option shape shared with the Python API.

    `--path` and a bare positional argument mean the same thing, and negated
    booleans (`--no-warn`) arrive already inverted.
    """
    read: dict[str, Any] = {}

    for definition in OPTION_DEFINITIONS:
        # `--no-warn` is parsed as `warn: False`, so read the positive name.
        flag = definition.flag[3:] if definition.flag.startswith("no-") else definition.flag
        value = args.get(flag, args.get(_FLAG_TO_SNAKE.sub("_", flag)))

        if value is None:
            continue

        read[definition.option] = value

    positional = args.get("_") or []

    if not read.get("path") and positional:
        read["path"] = str(positional[0])

    return Options(**read)


def _least(value: float, floor: float) -> bool:
    return value >= floor


def resolve_options(
    options: Options | None = None,
    defaults: Options | None = None,
) -> tuple[ResolvedOptions, list[Issue]]:
    """Fill in defaults and normalise the loose forms an option may take.

    Everything downstream then reads a single resolved shape. Anything unusable
    is reported as an `INVALID_OPTIONS` issue instead of raising: a typo in one
    flag should not stop the rest of the scan.
    """
    given = options if options is not None else Options()
    fallback = defaults if defaults is not None else Options()
    issues: list[Issue] = []

    def invalid(message: str) -> None:
        issues.append(create_issue("INVALID_OPTIONS", message=message))

    def pick(name: str) -> Any:
        value = getattr(given, name)

        return getattr(fallback, name) if value is None else value

    target = pick("target")

    if not target:
        # Reported so a caller can see which language it ended up comparing
        # against, but at `info`: leaving `target` out is a default, not a fault.
        issues.append(
            create_issue(
                "INVALID_OPTIONS",
                level="info",
                message=(
                    f"No target language is specified. Defaulting to `{DEFAULT_TARGET_LOCALE}`."
                ),
            )
        )
        target = DEFAULT_TARGET_LOCALE

    def read_choice(value: Any, allowed: Iterable[str], fallback_value: str, name: str) -> str:
        if value is None or value == "":
            return fallback_value

        choice = str(value).strip().lower()

        if choice not in allowed:
            invalid(f"Unknown `{name}` value `{value}`. Defaulting to `{fallback_value}`.")

            return fallback_value

        return choice

    raw_format = pick("format")
    file_format: FileFormat = "auto"

    if raw_format is not None and raw_format != "":
        choice = str(raw_format).strip().lower()

        if choice in FILE_FORMATS:
            file_format = choice
        else:
            invalid(f"Unknown format `{raw_format}`. Defaulting to `auto`.")

    def read_check_codes(value: Any, name: str) -> list[CheckCode]:
        codes: list[CheckCode] = []

        for item in split_option_list(value):
            code = item.upper()

            if code not in CHECK_CODES:
                invalid(f"Unknown check code `{item}` in `{name}` was ignored.")
                continue

            codes.append(code)

        return codes

    only = read_check_codes(pick("checks"), "checks")
    ignored = read_check_codes(pick("ignore_checks"), "ignore_checks")

    if only:
        if ignored:
            invalid(
                "`checks` and `ignore_checks` cannot be used together. `ignore_checks` was ignored."
            )

        enabled_checks = frozenset(only)
    else:
        enabled_checks = frozenset(ANALYZE_CHECK_CODES) - frozenset(ignored)

    # `CODE=level` pairs from the CLI, or a plain mapping from the API.
    raw_levels = pick("levels")
    level_entries = (
        [f"{code}={level}" for code, level in raw_levels.items()]
        if isinstance(raw_levels, Mapping)
        else split_option_list(raw_levels)
    )
    levels: dict[CheckCode, Level] | None = None

    for entry in level_entries:
        raw_code, _, raw_level = entry.partition("=")
        code = raw_code.strip().upper()
        level = raw_level.strip().lower()

        if code not in ANALYZE_CHECK_CODES:
            invalid(f"`{raw_code}` in `levels` is not a check whose severity can be changed.")
            continue

        if level not in LEVELS:
            invalid(f"`{raw_level}` is not a level. Use `error`, `warn` or `info`.")
            continue

        if levels is None:
            levels = {}

        levels[code] = level

    def read_number(value: Any, name: str, floor: float, *, whole: bool = False) -> float | None:
        """Read a number an option needs, or ``None`` when there is none to read.

        An unusable value is reported and dropped rather than guessed at: a check
        that runs on a number nobody meant is worse than one that does not run.
        """
        if value is None or value == "":
            return None

        try:
            parsed = float(value)
        except (TypeError, ValueError):
            invalid(f"`{value}` is not a usable `{name}`. It was ignored.")

            return None

        if parsed != parsed or parsed in (float("inf"), float("-inf")) or not _least(parsed, floor):
            invalid(f"`{value}` is not a usable `{name}`. It was ignored.")

            return None

        return float(int(parsed)) if whole else parsed

    raw_width = read_number(pick("width"), "width", 1, whole=True)
    raw_depth = read_number(pick("max_key_depth"), "max_key_depth", 1, whole=True)
    # A ratio of one would report every value whose length is not exactly the
    # target's, which is every value there is.
    length_ratio = read_number(pick("length_ratio"), "length_ratio", 1.01)

    key_case: KeyCase | None = None
    raw_key_case = pick("key_case")

    if raw_key_case:
        choice = str(raw_key_case).strip().lower()

        if choice in KEY_CASES:
            key_case = choice
        else:
            invalid(f"Unknown `key_case` value `{raw_key_case}`. Key names were not checked.")

    exclude_list = split_option_list(pick("exclude"))
    exclude_file_list = split_option_list(pick("exclude_files"))
    translate_function_list = split_option_list(pick("translate_functions"))
    output = pick("output") or None
    raw_reporter = pick("reporter")
    # `read_choice` has already checked the value against the same tuple the
    # `Literal` is built from, so the cast states what the check established.
    reporter = cast("Reporter", read_choice(raw_reporter, REPORTERS, DEFAULT_REPORTER, "reporter"))
    group_by = cast(
        "GroupBy", read_choice(pick("group_by"), GROUP_BYS, DEFAULT_GROUP_BY, "group_by")
    )

    return (
        ResolvedOptions(
            path=pick("path") or None,
            target=str(target),
            format=file_format,
            enabled_checks=enabled_checks,
            levels=levels,
            interpolation_prefix=pick("interpolation_prefix") or DEFAULT_INTERPOLATION_PREFIX,
            interpolation_suffix=pick("interpolation_suffix") or DEFAULT_INTERPOLATION_SUFFIX,
            exclude=frozenset(exclude_list or DEFAULT_EXCLUDE_DIRS),
            exclude_files=frozenset(exclude_file_list or DEFAULT_EXCLUDE_FILES),
            source=pick("source") or None,
            translate_functions=tuple(translate_function_list or TRANSLATION_FUNCTIONS),
            key_case=key_case,
            max_key_depth=None if raw_depth is None else int(raw_depth),
            length_ratio=length_ratio,
            reporter=reporter,
            group_by=group_by,
            output=output,
            # An explicit `reporter` always wins, so `--reporter list --output
            # out.txt` writes a list. Without one the file name decides, which is
            # what makes `--output report.json` do the obvious thing on its own.
            output_reporter=(
                None
                if not output
                else (reporter if raw_reporter else reporter_of_file_name(output))
            ),
            color=pick("color") is not False,
            width=None if raw_width is None else int(raw_width),
            flattened=pick("flattened") is True,
            verbose=pick("verbose") is True,
            info=pick("info") is not False,
            warn=pick("warn") is not False,
            debug=pick("debug") is True,
        ),
        issues,
    )
