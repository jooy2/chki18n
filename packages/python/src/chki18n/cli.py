"""The command line: what it accepts, and what it does with it."""

from __future__ import annotations

import sys
from collections.abc import Sequence
from dataclasses import replace
from typing import Any

from chki18n._version import installed_version
from chki18n.check import check_translation_files
from chki18n.options import OPTION_DEFINITIONS, build_usage_text, options_from_args

#: The name the usage text calls this program.
BIN_NAME = "chki18n"


def parse_arguments(arguments: Sequence[str]) -> dict[str, Any]:
    """Read `--flag value`, `--flag=value`, `--no-flag` and bare arguments.

    Written out rather than pulled in, because this package has no dependencies
    and `argparse` cannot express `--no-x` as the negation of `x` without
    declaring both. What it accepts is exactly what `OPTION_DEFINITIONS`
    declares: a flag that takes a value swallows the word after it, one that does
    not is a boolean, and `--no-x` sets `x` to ``False``. Everything left over
    lands under `_`, and the first of those is the directory to scan.
    """
    value_flags = {
        definition.flag for definition in OPTION_DEFINITIONS if definition.type != "boolean"
    }
    parsed: dict[str, Any] = {}
    positional: list[str] = []
    index = 0

    while index < len(arguments):
        argument = arguments[index]
        index += 1

        if not argument.startswith("--"):
            positional.append(argument)
            continue

        body = argument[2:]

        if "=" in body:
            name, _, value = body.partition("=")
            parsed[name] = value
            continue

        if body.startswith("no-") and body not in value_flags:
            parsed[body[3:]] = False
            continue

        if body in value_flags:
            if index < len(arguments):
                parsed[body] = arguments[index]
                index += 1

            continue

        parsed[body] = True

    parsed["_"] = positional

    return parsed


def capitalize_first(value: str) -> str:
    """The first character upper cased, which is how the banner writes the name."""
    return f"{value[0].upper()}{value[1:]}" if value else ""


def main(argv: Sequence[str] | None = None) -> int:
    """Run the command line and answer with the exit code it should leave.

    ``0`` when nothing failed the run, ``1`` when at least one `error` level issue
    was found — which is what makes this usable as a CI step.
    """
    args = parse_arguments(sys.argv[1:] if argv is None else argv)
    version = installed_version()

    if args.get("help") is True:
        print(build_usage_text(BIN_NAME))

        return 0

    if args.get("version") is True:
        print(version)

        return 0

    options = options_from_args(args)
    reporter = options.reporter

    # The banner belongs to the report a person reads. Anything that gets piped
    # into another program has to start with its own first line.
    if options.info is not False and (
        reporter is None or str(reporter).strip().lower() == "pretty"
    ):
        print(f"{capitalize_first(BIN_NAME)} {version}\n")

    result = check_translation_files(options=replace(options, verbose=True))

    return 0 if result.success else 1


if __name__ == "__main__":
    sys.exit(main())
