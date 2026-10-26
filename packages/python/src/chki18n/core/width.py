"""Columns a character occupies, rather than the number of characters there are.

Both tables are Unicode 16, written out as `start-end` in hexadecimal rather
than read from the runtime: each package runs on a different Unicode version,
and the three must agree on how wide a value is. A gap holding only unassigned
code points is folded into the ranges around it.
"""

from __future__ import annotations

from bisect import bisect_right
from typing import Final


def _ranges_of(table: str) -> tuple[tuple[int, ...], tuple[int, ...]]:
    """A table's ranges as two lists, the starts and the ends."""
    starts: list[int] = []
    ends: list[int] = []

    for item in table.split():
        start, _, end = item.partition("-")
        starts.append(int(start, 16))
        ends.append(int(end or start, 16))

    return tuple(starts), tuple(ends)


#: Code points a terminal draws in no column of their own: the marks that sit on
#: the character before them (general categories `Mn` and `Me`), the zero width
#: spaces, joiners and direction marks, the variation selectors, and the vowel
#: and final jamo an old style Hangul syllable is spelled with.
_ZERO_WIDTH: Final = _ranges_of(
    "300-36f 483-489 591-5bd 5bf 5c1-5c2 5c4-5c5 5c7 610-61a 64b-65f 670 6d6-6dc "
    "6df-6e4 6e7-6e8 6ea-6ed 711 730-74a 7a6-7b0 7eb-7f3 7fd 816-819 81b-823 825-827 "
    "829-82d 859-85b 897-89f 8ca-8e1 8e3-902 93a 93c 941-948 94d 951-957 962-963 981 "
    "9bc 9c1-9c4 9cd 9e2-9e3 9fe-a02 a3c a41-a51 a70-a71 a75 a81-a82 abc ac1-ac8 acd "
    "ae2-ae3 afa-b01 b3c b3f b41-b44 b4d-b56 b62-b63 b82 bc0 bcd c00 c04 c3c c3e-c40 "
    "c46-c56 c62-c63 c81 cbc cbf cc6 ccc-ccd ce2-ce3 d00-d01 d3b-d3c d41-d44 d4d "
    "d62-d63 d81 dca dd2-dd6 e31 e34-e3a e47-e4e eb1 eb4-ebc ec8-ece f18-f19 f35 f37 "
    "f39 f71-f7e f80-f84 f86-f87 f8d-fbc fc6 102d-1030 1032-1037 1039-103a 103d-103e "
    "1058-1059 105e-1060 1071-1074 1082 1085-1086 108d 109d 1160-11ff 135d-135f "
    "1712-1714 1732-1733 1752-1753 1772-1773 17b4-17b5 17b7-17bd 17c6 17c9-17d3 17dd "
    "180b-180d 180f 1885-1886 18a9 1920-1922 1927-1928 1932 1939-193b 1a17-1a18 1a1b "
    "1a56 1a58-1a60 1a62 1a65-1a6c 1a73-1a7f 1ab0-1b03 1b34 1b36-1b3a 1b3c 1b42 "
    "1b6b-1b73 1b80-1b81 1ba2-1ba5 1ba8-1ba9 1bab-1bad 1be6 1be8-1be9 1bed 1bef-1bf1 "
    "1c2c-1c33 1c36-1c37 1cd0-1cd2 1cd4-1ce0 1ce2-1ce8 1ced 1cf4 1cf8-1cf9 1dc0-1dff "
    "200b-200f 2060 20d0-20f0 2cef-2cf1 2d7f 2de0-2dff 302a-302d 3099-309a a66f-a672 "
    "a674-a67d a69e-a69f a6f0-a6f1 a802 a806 a80b a825-a826 a82c a8c4-a8c5 a8e0-a8f1 "
    "a8ff a926-a92d a947-a951 a980-a982 a9b3 a9b6-a9b9 a9bc-a9bd a9e5 aa29-aa2e "
    "aa31-aa32 aa35-aa36 aa43 aa4c aa7c aab0 aab2-aab4 aab7-aab8 aabe-aabf aac1 "
    "aaec-aaed aaf6 abe5 abe8 abed fb1e fe00-fe0f fe20-fe2f feff 101fd 102e0 "
    "10376-1037a 10a01-10a0f 10a38-10a3f 10ae5-10ae6 10d24-10d27 10d69-10d6d "
    "10eab-10eac 10efc-10eff 10f46-10f50 10f82-10f85 11001 11038-11046 11070 "
    "11073-11074 1107f-11081 110b3-110b6 110b9-110ba 110c2 11100-11102 11127-1112b "
    "1112d-11134 11173 11180-11181 111b6-111be 111c9-111cc 111cf 1122f-11231 11234 "
    "11236-11237 1123e 11241 112df 112e3-112ea 11300-11301 1133b-1133c 11340 "
    "11366-11374 113bb-113c0 113ce 113d0 113d2 113e1-113e2 11438-1143f 11442-11444 "
    "11446 1145e 114b3-114b8 114ba 114bf-114c0 114c2-114c3 115b2-115b5 115bc-115bd "
    "115bf-115c0 115dc-115dd 11633-1163a 1163d 1163f-11640 116ab 116ad 116b0-116b5 "
    "116b7 1171d 1171f 11722-11725 11727-1172b 1182f-11837 11839-1183a 1193b-1193c "
    "1193e 11943 119d4-119db 119e0 11a01-11a0a 11a33-11a38 11a3b-11a3e 11a47 "
    "11a51-11a56 11a59-11a5b 11a8a-11a96 11a98-11a99 11c30-11c3d 11c3f 11c92-11ca7 "
    "11caa-11cb0 11cb2-11cb3 11cb5-11cb6 11d31-11d45 11d47 11d90-11d91 11d95 11d97 "
    "11ef3-11ef4 11f00-11f01 11f36-11f3a 11f40 11f42 11f5a 13440 13447-13455 "
    "1611e-16129 1612d-1612f 16af0-16af4 16b30-16b36 16f4f 16f8f-16f92 16fe4 "
    "1bc9d-1bc9e 1cf00-1cf46 1d167-1d169 1d17b-1d182 1d185-1d18b 1d1aa-1d1ad "
    "1d242-1d244 1da00-1da36 1da3b-1da6c 1da75 1da84 1da9b-1daaf 1e000-1e02a 1e08f "
    "1e130-1e136 1e2ae 1e2ec-1e2ef 1e4ec-1e4ef 1e5ee-1e5ef 1e8d0-1e8d6 1e944-1e94a "
    "e0100-e01ef "
)

#: Code points a terminal draws two columns wide: those Unicode gives an East
#: Asian width of `W` or `F`. Korean, Japanese and Chinese translations are the
#: normal case, and so is an emoji. Counting them as one column each is what pulls
#: a report's columns out of line and makes a length comparison against an English
#: original meaningless.
_WIDE: Final = _ranges_of(
    "1100-115f 231a-231b 2329-232a 23e9-23ec 23f0 23f3 25fd-25fe 2614-2615 2630-2637 "
    "2648-2653 267f 268a-268f 2693 26a1 26aa-26ab 26bd-26be 26c4-26c5 26ce 26d4 26ea "
    "26f2-26f3 26f5 26fa 26fd 2705 270a-270b 2728 274c 274e 2753-2755 2757 2795-2797 "
    "27b0 27bf 2b1b-2b1c 2b50 2b55 2e80-3029 302e-303e 3041-3096 309b-3247 3250-a4c6 "
    "a960-a97c ac00-d7a3 f900-faff fe10-fe19 fe30-fe6b ff01-ff60 ffe0-ffe6 "
    "16fe0-16fe3 16ff0-1b2fb 1d300-1d376 1f004 1f0cf 1f18e 1f191-1f19a 1f200-1f320 "
    "1f32d-1f335 1f337-1f37c 1f37e-1f393 1f3a0-1f3ca 1f3cf-1f3d3 1f3e0-1f3f0 1f3f4 "
    "1f3f8-1f43e 1f440 1f442-1f4fc 1f4ff-1f53d 1f54b-1f54e 1f550-1f567 1f57a "
    "1f595-1f596 1f5a4 1f5fb-1f64f 1f680-1f6c5 1f6cc 1f6d0-1f6d2 1f6d5-1f6df "
    "1f6eb-1f6ec 1f6f4-1f6fc 1f7e0-1f7f0 1f90c-1f93a 1f93c-1f945 1f947-1f9ff "
    "1fa70-1faf8 20000-3fffd "
)


def _within(ranges: tuple[tuple[int, ...], tuple[int, ...]], code: int) -> bool:
    """Whether a code point falls in one of a table's ranges, found by halving."""
    starts, ends = ranges
    at = bisect_right(starts, code) - 1

    return at >= 0 and code <= ends[at]


def _width_of(code: int) -> int:
    """Columns one code point occupies: none, one, or two."""
    # Nothing below the first combining mark is drawn wide or not at all, and
    # ASCII and Latin-1 are what most values are made of.
    if code < 0x300:
        return 1

    if _within(_ZERO_WIDTH, code):
        return 0

    return 2 if _within(_WIDE, code) else 1


def char_width(char: str) -> int:
    """Columns one character occupies: none, one, or two."""
    return _width_of(ord(char[0]) if char else 0)


def display_width(text: str) -> int:
    """Columns a string occupies, rather than the number of characters in it."""
    if text.isascii():
        return len(text)

    return sum(_width_of(ord(char)) for char in text)
