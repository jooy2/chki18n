"""The colours a report may use, held as a table rather than reached for at each call site.

One formatter then renders both the coloured terminal report and the plain text
that goes into a file, with no branching of its own.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Final

from chki18n.constants import Level

#: Ends whatever the code before it started. Nothing here nests, so the one reset
#: is enough and a table of matching close codes would be dead weight.
_RESET: Final = "\x1b[0m"


def _wrap_with(open_code: str) -> Callable[[str], str]:
    def paint(text: str) -> str:
        return f"{open_code}{text}{_RESET}"

    return paint


def _identity(text: str) -> str:
    return text


@dataclass(frozen=True, slots=True)
class Paint:
    """The colours a report may use."""

    #: Something that fails the run.
    error: Callable[[str], str]
    #: Something worth fixing that does not fail the run.
    warn: Callable[[str], str]
    #: A note.
    info: Callable[[str], str]
    #: A section heading or a check code.
    heading: Callable[[str], str]
    #: A translation key.
    key: Callable[[str], str]
    #: A translation value.
    value: Callable[[str], str]
    #: Supporting text the reader does not have to look at.
    dim: Callable[[str], str]
    #: The badge on a run that passed.
    passed: Callable[[str], str]
    #: The badge on a run that failed.
    failed: Callable[[str], str]


#: The palette a file gets: escape codes in a saved report are noise nothing
#: will read.
PLAIN_PAINT: Final = Paint(
    error=_identity,
    warn=_identity,
    info=_identity,
    heading=_identity,
    key=_identity,
    value=_identity,
    dim=_identity,
    passed=_identity,
    failed=_identity,
)

#: The palette a terminal gets.
COLOURED_PAINT: Final = Paint(
    error=_wrap_with("\x1b[91m"),
    warn=_wrap_with("\x1b[93m"),
    info=_wrap_with("\x1b[90m"),
    heading=_wrap_with("\x1b[1m\x1b[97m"),
    key=_wrap_with("\x1b[96m"),
    value=_wrap_with("\x1b[37m"),
    dim=_wrap_with("\x1b[90m"),
    passed=_wrap_with("\x1b[102m\x1b[97m"),
    failed=_wrap_with("\x1b[101m\x1b[97m"),
)


def create_paint(enabled: bool) -> Paint:
    """Colours when asked for them.

    Whether the terminal can draw them is the caller's question rather than this
    one's: a report rendered for a file, for a string or for a test never wants
    them, and only the command line knows what its own output is attached to.
    """
    return COLOURED_PAINT if enabled else PLAIN_PAINT


def paint_of_level(paint: Paint, level: Level) -> Callable[[str], str]:
    """The painter that matches a severity, for level coloured text."""
    if level == "error":
        return paint.error

    return paint.warn if level == "warn" else paint.info
