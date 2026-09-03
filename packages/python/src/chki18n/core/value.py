"""What a translation value can be measured on beyond its text.

The markup it carries, the numbers in it, the characters nothing will draw, and
the script it is written in. Kept apart from the analyzer so each one can be
tested and reused on its own.

Every character class here is written as escapes rather than as the characters
themselves. Some of them are invisible, and a source file that holds one is a
source file nobody can review.
"""

from __future__ import annotations

import re
from typing import Final

_NOTHING: Final[list[str]] = []

#: Markup tags, as they are written. The character after the `<` may not be a
#: space, so prose comparing two numbers is not mistaken for a tag.
TAG_PATTERN: Final = re.compile(r"</?[^<>\s][^<>]*>")

_NUMBER_PATTERN: Final = re.compile(r"\d+")

#: Characters that take no space and are invisible in a review: zero width
#: joiners and spaces, the byte order mark, and the bidirectional controls a copy
#: out of a right-to-left editor leaves behind. The non-breaking space is here
#: too, because it looks exactly like the ordinary space it is not.
_INVISIBLE_PATTERN: Final = re.compile(
    "[\u00a0\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]"
)

_NAMED_INVISIBLE: Final[dict[str, str]] = {
    "\u00a0": "a non-breaking space",
    "\u200b": "a zero width space",
    "\u200c": "a zero width non-joiner",
    "\u200d": "a zero width joiner",
    "\u200e": "a left-to-right mark",
    "\u200f": "a right-to-left mark",
    "\ufeff": "a byte order mark",
}

_LETTER_PATTERN: Final = re.compile(r"[^\W\d_]", re.UNICODE)

_SCRIPT_CACHE: Final[dict[str, re.Pattern[str] | None]] = {}

_SUBTAG_SEPARATOR: Final = re.compile(r"[-_]")

#: The script each language is written in, for the languages whose script says
#: something a comparison can act on.
#:
#: A language written in the Latin alphabet is left out: there would be nothing
#: to tell it apart from an English string nobody translated.
_SCRIPT_OF_LANGUAGE: Final[dict[str, re.Pattern[str]]] = {
    "am": re.compile("[\u1200-\u137f]"),
    "ar": re.compile("[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]"),
    "be": re.compile("[\u0400-\u04ff]"),
    "bg": re.compile("[\u0400-\u04ff]"),
    "bn": re.compile("[\u0980-\u09ff]"),
    "el": re.compile("[\u0370-\u03ff\u1f00-\u1fff]"),
    "fa": re.compile("[\u0600-\u06ff\u0750-\u077f]"),
    "he": re.compile("[\u0590-\u05ff]"),
    "hi": re.compile("[\u0900-\u097f]"),
    "hy": re.compile("[\u0530-\u058f]"),
    "ja": re.compile("[\u3040-\u30ff\u31f0-\u31ff\u4e00-\u9fff]"),
    "ka": re.compile("[\u10a0-\u10ff]"),
    "kk": re.compile("[\u0400-\u04ff]"),
    "km": re.compile("[\u1780-\u17ff]"),
    "ko": re.compile("[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]"),
    "ky": re.compile("[\u0400-\u04ff]"),
    "lo": re.compile("[\u0e80-\u0eff]"),
    "mk": re.compile("[\u0400-\u04ff]"),
    "ml": re.compile("[\u0d00-\u0d7f]"),
    "mn": re.compile("[\u0400-\u04ff]"),
    "my": re.compile("[\u1000-\u109f]"),
    "ne": re.compile("[\u0900-\u097f]"),
    "ru": re.compile("[\u0400-\u04ff]"),
    "si": re.compile("[\u0d80-\u0dff]"),
    "ta": re.compile("[\u0b80-\u0bff]"),
    "te": re.compile("[\u0c00-\u0c7f]"),
    "th": re.compile("[\u0e00-\u0e7f]"),
    "uk": re.compile("[\u0400-\u04ff]"),
    "ur": re.compile("[\u0600-\u06ff\u0750-\u077f]"),
    "zh": re.compile("[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]"),
}


def extract_tags(value: str) -> list[str]:
    """Markup tags a value carries, in the order they appear."""
    if "<" not in value:
        return _NOTHING

    return TAG_PATTERN.findall(value)


def extract_numbers(value: str) -> list[str]:
    """Runs of digits a value carries, as text so `03` and `3` stay apart."""
    return _NUMBER_PATTERN.findall(value)


def find_invisible_character(value: str) -> str | None:
    """The first character in a value that nothing will draw, if there is one."""
    found = _INVISIBLE_PATTERN.search(value)

    return found.group(0) if found else None


def name_of_invisible_character(char: str) -> str:
    """How to name an invisible character in a message, since it cannot be shown."""
    code = format(ord(char[0]) if char else 0, "04X")

    return f"{_NAMED_INVISIBLE.get(char, 'a bidirectional control')} (U+{code})"


def script_of_locale(locale: str) -> re.Pattern[str] | None:
    """The script a locale's translations are expected to be written in.

    ``None`` when the locale writes in the Latin alphabet, is not listed, or
    names a script of its own — `sr-Latn` is Serbian written in Latin, and asking
    it for Cyrillic would be wrong.
    """
    # Asked once per value of every locale, and the answer only ever depends on
    # the tag. A project has a handful of locales, so the cache stays tiny.
    if locale in _SCRIPT_CACHE:
        return _SCRIPT_CACHE[locale]

    parts = _SUBTAG_SEPARATOR.split(locale.lower())
    script = None if "latn" in parts else _SCRIPT_OF_LANGUAGE.get(parts[0])
    _SCRIPT_CACHE[locale] = script

    return script


def has_translatable_text(value: str, prefix: str, suffix: str) -> bool:
    """Whether a value holds a word of its own, once the never-translated parts are out.

    A value that is only a placeholder, a tag or a number cannot be judged on the
    script it is written in.
    """
    text = TAG_PATTERN.sub(" ", value)
    start = text.find(prefix)

    # A placeholder name is written by the developer and stays in English, so
    # leaving it in would let it answer for the whole value.
    while start != -1:
        end = text.find(suffix, start + len(prefix))

        if end == -1:
            break

        text = f"{text[:start]} {text[end + len(suffix) :]}"
        start = text.find(prefix)

    return _LETTER_PATTERN.search(text) is not None
