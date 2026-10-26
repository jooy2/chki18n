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
import unicodedata
from bisect import bisect_right
from typing import Final

_NOTHING: Final[list[str]] = []

#: Markup tags, as they are written. The character after the `<` may not be a
#: space, so prose comparing two numbers is not mistaken for a tag.
#: What JavaScript's `\s` matches, as a character class. Python's `\s` reads
#: the file and record separators and U+0085 as space and the byte order mark as
#: not, so a pattern written with it would disagree with the other two packages
#: about exactly the characters that are hardest to see.
WHITESPACE: Final = "\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"

TAG_PATTERN: Final = re.compile(f"</?[^<>{WHITESPACE}][^<>]*>")

#: The zero of every set of decimal digits Unicode 17 defines, each followed by
#: the nine digits after it. A translation into Arabic, Hindi or Japanese often
#: writes its numbers in that language's own digits, and `٣` says the same as
#: `3`. Written out rather than read from the runtime: each package runs on a
#: different Unicode version, and the three must agree on what a digit is.
_DIGIT_ZEROS: Final = (
    0x30,
    0x660,
    0x6F0,
    0x7C0,
    0x966,
    0x9E6,
    0xA66,
    0xAE6,
    0xB66,
    0xBE6,
    0xC66,
    0xCE6,
    0xD66,
    0xDE6,
    0xE50,
    0xED0,
    0xF20,
    0x1040,
    0x1090,
    0x17E0,
    0x1810,
    0x1946,
    0x19D0,
    0x1A80,
    0x1A90,
    0x1B50,
    0x1BB0,
    0x1C40,
    0x1C50,
    0xA620,
    0xA8D0,
    0xA900,
    0xA9D0,
    0xA9F0,
    0xAA50,
    0xABF0,
    0xFF10,
    0x104A0,
    0x10D30,
    0x10D40,
    0x11066,
    0x110F0,
    0x11136,
    0x111D0,
    0x112F0,
    0x11450,
    0x114D0,
    0x11650,
    0x116C0,
    0x116D0,
    0x116DA,
    0x11730,
    0x118E0,
    0x11950,
    0x11BF0,
    0x11C50,
    0x11D50,
    0x11DA0,
    0x11DE0,
    0x11F50,
    0x16130,
    0x16A60,
    0x16AC0,
    0x16B50,
    0x16D70,
    0x1CCF0,
    0x1D7CE,
    0x1D7D8,
    0x1D7E2,
    0x1D7EC,
    0x1D7F6,
    0x1E140,
    0x1E2F0,
    0x1E4F0,
    0x1E5F1,
    0x1E950,
    0x1FBF0,
)

_DIGIT_CLASS: Final = "".join(f"\\U{zero:08x}-\\U{zero + 9:08x}" for zero in _DIGIT_ZEROS)

_NUMBER_PATTERN: Final = re.compile(f"[{_DIGIT_CLASS}]+")

_DIGIT_PATTERN: Final = re.compile(f"[{_DIGIT_CLASS}]")

_ASCII_NUMBER_PATTERN: Final = re.compile(r"[0-9]+")

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


def has_digit(value: str) -> bool:
    """Whether a value holds a digit of any script."""
    return _DIGIT_PATTERN.search(value) is not None


def extract_numbers(value: str) -> list[str]:
    """Runs of digits a value carries, as they are written.

    Kept as text so `03` and `3` stay apart. A run may be written in any
    script's digits.
    """
    return _NUMBER_PATTERN.findall(value)


def ascii_digits_of(digits: str) -> str:
    """A run of digits in ASCII, so `٠٣` and `03` compare equal."""
    if _ASCII_NUMBER_PATTERN.fullmatch(digits):
        return digits

    # The last zero at or below each digit is the one its set starts from.
    return "".join(
        chr(0x30 + ord(char) - _DIGIT_ZEROS[bisect_right(_DIGIT_ZEROS, ord(char)) - 1])
        for char in digits
    )


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

    # A letter is what JavaScript's `\p{L}` calls one. Python's `\w` takes in
    # numbers such as `½` too, which would make a value of them translatable.
    return any(unicodedata.category(char).startswith("L") for char in text)
