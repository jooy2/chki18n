"""Diagnostics for the command line, and only diagnostics."""

from __future__ import annotations

import sys
from collections.abc import Callable

from chki18n._types import ResolvedOptions


class Logger:
    """Writes what a run is doing, when a run was asked to say."""

    __slots__ = ("_write",)

    def __init__(self, write: Callable[[str], None] | None = None) -> None:
        """Create a logger that writes through `write`, or nowhere at all."""
        self._write = write

    def debug(self, message: str) -> None:
        """Write one diagnostic line."""
        if self._write is not None:
            self._write(message)


#: A logger that writes nothing. What the library uses unless asked to speak.
SILENT_LOGGER = Logger()


def create_logger(options: ResolvedOptions) -> Logger:
    """Diagnostics for the CLI, and only diagnostics.

    The findings are rendered by the reporter, in whichever shape was asked for.
    These go to standard error so that a report piped out of standard output
    stays parseable with `--debug` on.
    """
    if not options.debug:
        return SILENT_LOGGER

    label = (
        "\x1b[104m\x1b[97m Chki18n \x1b[0m\x1b[44m\x1b[97m DEBUG \x1b[0m"
        if options.color
        else " Chki18n  DEBUG "
    )

    return Logger(lambda message: print(f"{label} {message}", file=sys.stderr))
