"""Telling a locale code from any other path segment."""

from __future__ import annotations

import re
from typing import Final

# Full ISO 639-1 two letter language codes, plus the legacy aliases (in/iw/ji)
# still found in older projects. Used to tell which path segment carries the
# locale, so `a/ko.json` (a sub-folder) is not confused with `ko/common.json`
# (a folder per locale).
_ISO_639_1: Final = """
aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy
da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu
hy hz ia id ie ig ii ik in io is it iu iw ja ji jv ka kg ki kj kk kl km kn ko kr ks ku kv kw
ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny
oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st
su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh
zu
"""

_KNOWN_LOCALES: Final[frozenset[str]] = frozenset(_ISO_639_1.split())

_SUBTAG_SEPARATOR: Final = re.compile(r"[-_]")


def is_locale_code(name: str) -> bool:
    """Whether a name looks like a locale.

    Region and script variants (`en-US`, `pt_BR`, `zh-Hans`) are accepted by
    matching on the base language subtag.
    """
    if not name:
        return False

    return _SUBTAG_SEPARATOR.split(name.lower())[0] in _KNOWN_LOCALES
