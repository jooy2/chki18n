"""Which plural forms a language needs, and how a key names the one it holds.

The table is deliberately conservative. Recent CLDR releases added a `many`
category to several languages for compact decimals, and a project on an older
i18n runtime does not write it; asking for a form nobody uses would report a
correct file as broken. Where the answer is not settled the language is left
out, and a language that is left out is never judged.
"""

from __future__ import annotations

import re
from typing import Final

from chki18n.constants import PLURAL_CATEGORIES, PluralCategory

_CATEGORY_NAMES: Final[frozenset[str]] = frozenset(PLURAL_CATEGORIES)

#: The i18next suffix that predates the named categories, paired with a bare key
#: for the singular.
#:
#: It is not read as a category: which of the two forms is which depends on the
#: language, so requiring either would report a correct file as broken. A key
#: written this way is judged as an ordinary key, exactly as it was before this
#: check existed.
_LEGACY_PLURAL_SUFFIX: Final = "plural"

_ONLY_OTHER: Final[tuple[PluralCategory, ...]] = ("other",)

_ONE_OTHER: Final[tuple[PluralCategory, ...]] = ("one", "other")

_ONE_FEW_OTHER: Final[tuple[PluralCategory, ...]] = ("one", "few", "other")

_ONE_FEW_MANY_OTHER: Final[tuple[PluralCategory, ...]] = ("one", "few", "many", "other")

_CATEGORIES_OF_LANGUAGE: Final[dict[str, tuple[PluralCategory, ...]]] = {
    "af": _ONE_OTHER,
    "am": _ONE_OTHER,
    "ar": PLURAL_CATEGORIES,
    "az": _ONE_OTHER,
    "be": _ONE_FEW_MANY_OTHER,
    "bg": _ONE_OTHER,
    "bn": _ONE_OTHER,
    "bs": _ONE_FEW_OTHER,
    "ca": _ONE_OTHER,
    "cs": _ONE_FEW_MANY_OTHER,
    "cy": PLURAL_CATEGORIES,
    "da": _ONE_OTHER,
    "de": _ONE_OTHER,
    "el": _ONE_OTHER,
    "en": _ONE_OTHER,
    "es": _ONE_OTHER,
    "et": _ONE_OTHER,
    "eu": _ONE_OTHER,
    "fa": _ONE_OTHER,
    "fi": _ONE_OTHER,
    "fr": _ONE_OTHER,
    "ga": ("one", "two", "few", "many", "other"),
    "gu": _ONE_OTHER,
    "ha": _ONE_OTHER,
    "hi": _ONE_OTHER,
    "hr": _ONE_FEW_OTHER,
    "hu": _ONE_OTHER,
    "hy": _ONE_OTHER,
    "id": _ONLY_OTHER,
    "is": _ONE_OTHER,
    "it": _ONE_OTHER,
    "ja": _ONLY_OTHER,
    "ka": _ONE_OTHER,
    "kk": _ONE_OTHER,
    "km": _ONLY_OTHER,
    "kn": _ONE_OTHER,
    "ko": _ONLY_OTHER,
    "ky": _ONE_OTHER,
    "lo": _ONLY_OTHER,
    "lt": _ONE_FEW_MANY_OTHER,
    "lv": ("zero", "one", "other"),
    "ml": _ONE_OTHER,
    "mn": _ONE_OTHER,
    "mr": _ONE_OTHER,
    "ms": _ONLY_OTHER,
    "my": _ONLY_OTHER,
    "nb": _ONE_OTHER,
    "ne": _ONE_OTHER,
    "nl": _ONE_OTHER,
    "nn": _ONE_OTHER,
    "no": _ONE_OTHER,
    "pl": _ONE_FEW_MANY_OTHER,
    "pt": _ONE_OTHER,
    "ro": _ONE_FEW_OTHER,
    "ru": _ONE_FEW_MANY_OTHER,
    "si": _ONE_OTHER,
    "sk": _ONE_FEW_MANY_OTHER,
    "sl": ("one", "two", "few", "other"),
    "sq": _ONE_OTHER,
    "sr": _ONE_FEW_OTHER,
    "sv": _ONE_OTHER,
    "sw": _ONE_OTHER,
    "ta": _ONE_OTHER,
    "te": _ONE_OTHER,
    "th": _ONLY_OTHER,
    "tr": _ONE_OTHER,
    "uk": _ONE_FEW_MANY_OTHER,
    "ur": _ONE_OTHER,
    "uz": _ONE_OTHER,
    "vi": _ONLY_OTHER,
    "zh": _ONLY_OTHER,
    "zu": _ONE_OTHER,
}

_CACHE: Final[dict[str, tuple[PluralCategory, ...] | None]] = {}

_SUBTAG_SEPARATOR: Final = re.compile(r"[-_]")


def plural_categories_of(locale: str) -> tuple[PluralCategory, ...] | None:
    """The plural forms a locale's language needs, or ``None`` for one not in the table.

    A language the table is not sure about is left exactly as it was: nothing is
    required of it and nothing is excused it.
    """
    if locale in _CACHE:
        return _CACHE[locale]

    categories = _CATEGORIES_OF_LANGUAGE.get(_SUBTAG_SEPARATOR.split(locale.lower())[0])
    _CACHE[locale] = categories

    return categories


def plural_parts_of(key: str) -> tuple[str, PluralCategory] | None:
    """The key and the plural form a suffixed key names, or ``None`` for an ordinary key.

    `item_one` is the `one` form of `item`.
    """
    separator = key.rfind("_")

    if separator < 1:
        return None

    suffix = key[separator + 1 :]

    if suffix not in _CATEGORY_NAMES:
        return None

    category: PluralCategory = suffix  # type: ignore[assignment]

    return key[:separator], category


def plural_base_of(key: str) -> str | None:
    """The key a plural form belongs to, whichever convention wrote it.

    ``None`` when the key is not a plural form at all. Looser than
    `plural_parts_of` on purpose: this answers "what does the source call
    this?", where the legacy suffix is as good an answer as a named category,
    and no check depends on which of the two it was.
    """
    parts = plural_parts_of(key)

    if parts is not None:
        return parts[0]

    separator = key.rfind("_")

    if separator > 0 and key[separator + 1 :] == _LEGACY_PLURAL_SUFFIX:
        return key[:separator]

    return None


def uses_plural_category(locale: str, category: PluralCategory) -> bool:
    """Whether a locale's language uses a plural form at all.

    A language the table does not cover is assumed to use every form, so nothing
    changes for it.
    """
    categories = plural_categories_of(locale)

    return categories is None or category in categories
