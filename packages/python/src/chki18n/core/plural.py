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
        # The source asks for `place` with `ordinal: True`, never for the infix.
        return parts[0][: -len(_ORDINAL_INFIX)] if is_ordinal_base(parts[0]) else parts[0]

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


#: What i18next writes between a key and the category of an ordinal form, as in
#: `place_ordinal_one`. Ordinal forms follow rules of their own, which the table
#: above does not hold: English needs `two` and `few` for `2nd` and `3rd`, while
#: German and Russian need only `other`.
_ORDINAL_INFIX: Final = "_ordinal"


def is_ordinal_base(base: str) -> bool:
    """Whether the base of a plural key names ordinal forms, as `place_ordinal` does."""
    return len(base) > len(_ORDINAL_INFIX) and base.endswith(_ORDINAL_INFIX)


def uses_plural_form(locale: str, parts: tuple[str, PluralCategory]) -> bool:
    """Whether a locale's language uses the form a plural key names.

    An ordinal form is asked for nothing beyond `other`: which ordinal forms a
    language needs is not in the table, and `other` is the one every language
    has.
    """
    base, category = parts

    return category == "other" if is_ordinal_base(base) else uses_plural_category(locale, category)


def plural_forms_needed(locale: str, base: str) -> tuple[PluralCategory, ...] | None:
    """The forms a plural key needs in a locale.

    ``None`` when its language is not one the table is sure about. Ordinal forms
    need `other` alone, for the reason `uses_plural_form` gives.
    """
    categories = plural_categories_of(locale)

    return _ONLY_OTHER if categories is not None and is_ordinal_base(base) else categories
