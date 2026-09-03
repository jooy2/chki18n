"""Holding a set of translations and checking them repeatedly."""

from __future__ import annotations

from dataclasses import replace
from typing import Any

from chki18n._types import (
    Entry,
    Input,
    Issue,
    KeyUsage,
    Options,
    ResolvedOptions,
    Result,
    SourceFile,
    TranslationGroups,
    TranslationMap,
)
from chki18n.constants import FileFormat
from chki18n.core.analyzer import Analyzer, collect_keys, prepare_groups


class Session:
    """A set of translations held in memory, checked as often as needed.

    Options are resolved once, the translations are flattened once, and every
    later call works on what is already in memory. Use it when this module owns
    the data; when your own application owns it, `Analyzer.check_entry` takes the
    values directly and keeps a single source of truth.
    """

    __slots__ = (
        "_analyzer",
        "_file_format",
        "_files",
        "_group_names",
        "_groups",
        "_input_is_flat",
        "_locale_names",
        "_source_issues",
        "_undefined_keys",
        "_unused_keys",
    )

    def __init__(self, data: Input | None = None, options: Options | None = None) -> None:
        """Create a session over translations that are already in memory.

        `options` shapes every check the session runs. Set `flattened` on it when
        the dictionaries handed in are already keyed by their dotted paths.
        """
        given = options if options is not None else Options()
        # The session flattens once, up front, so the analyzer never has to.
        self._analyzer = Analyzer(replace(given, flattened=True))
        self._input_is_flat = given.flattened is True
        self._groups: TranslationGroups = {}
        self._group_names: list[str] = []
        self._locale_names: list[str] = []
        self._files: list[SourceFile] = []
        self._file_format: FileFormat | None = None
        self._source_issues: list[Issue] = []
        self._unused_keys: list[str] = []
        self._undefined_keys: list[KeyUsage] = []

        self.reset(data if data is not None else Input())

    @property
    def options(self) -> ResolvedOptions:
        """The options every check of this session runs with."""
        return self._analyzer.options

    @property
    def locales(self) -> list[str]:
        """Every locale the session holds."""
        return list(self._locale_names)

    @property
    def groups(self) -> list[str]:
        """Every group the session holds, in scan order."""
        return list(self._group_names)

    @property
    def files(self) -> list[SourceFile]:
        """The files the translations were read from, when they came from disk."""
        return self._files

    @property
    def file_format(self) -> FileFormat | None:
        """Layout the translations came from, or ``None`` for in-memory input."""
        return self._file_format

    def reset(self, data: Input) -> None:
        """Replace the translations, keeping the options and the analyzer."""
        load_issues: list[Issue] = []

        self._groups = prepare_groups(
            data, self._analyzer.options, load_issues, flattened=self._input_is_flat
        )
        self._group_names = list(self._groups)
        self._files = list(data.files)
        self._file_format = data.file_format
        self._source_issues = [*data.issues, *load_issues]
        self._unused_keys = list(data.unused_keys)
        self._undefined_keys = list(data.undefined_keys)

        seen: dict[str, None] = {}

        for group in self._group_names:
            for locale in self._groups[group]:
                seen.setdefault(locale)

        self._locale_names = list(seen)

    def _resolve_group(self, key: str | None, group: str | None) -> str:
        """Which group a call means.

        With one group there is nothing to decide; with several, an unnamed key
        is looked for where it actually lives, so callers only have to name a
        group when adding a key that does not exist yet.
        """
        if group is not None:
            return group

        if len(self._group_names) < 2 or key is None:
            return self._group_names[0] if self._group_names else ""

        for name in self._group_names:
            for locale in self._groups[name]:
                if key in self._groups[name][locale]:
                    return name

        return self._group_names[0] if self._group_names else ""

    def _locales_of(self, group: str) -> list[str]:
        return list(self._groups.get(group, {}))

    def keys(self, group: str | None = None) -> list[str]:
        """Keys of a group, target language first."""
        name = self._resolve_group(None, group)
        locales = self._locales_of(name)
        target = self._analyzer.options.target

        return collect_keys(
            [self._groups[name][locale] for locale in locales],
            locales.index(target) if target in locales else -1,
        )

    def translations(self, group: str | None = None) -> dict[str, TranslationMap]:
        """The flattened translations of a group, keyed by locale.

        The dictionaries are the session's own: read them freely, but write
        through `set` and `remove`.
        """
        return self._groups.get(self._resolve_group(None, group), {})

    def get(self, locale: str, key: str, group: str | None = None) -> Any:
        """One value, or ``None`` when that locale does not define the key."""
        return self._groups.get(self._resolve_group(key, group), {}).get(locale, {}).get(key)

    def set(self, locale: str, key: str, value: str, group: str | None = None) -> list[Issue]:
        """Write a value and report what that key now looks like."""
        name = self._resolve_group(key, group)

        self._groups.setdefault(name, {}).setdefault(locale, {})[key] = value

        if locale not in self._locale_names:
            self._locale_names.append(locale)

        if name not in self._group_names:
            self._group_names.append(name)

        return self.check_key(key, name)

    def remove(
        self,
        key: str,
        *,
        locale: str | None = None,
        group: str | None = None,
    ) -> list[Issue]:
        """Drop a key from one locale, or from every locale, and re-check it."""
        name = self._resolve_group(key, group)
        locales = [locale] if locale is not None else self._locales_of(name)

        for one in locales:
            self._groups.get(name, {}).get(one, {}).pop(key, None)

        return self.check_key(key, name)

    def check_key(self, key: str, group: str | None = None) -> list[Issue]:
        """Check a single key. Cross-key checks are not reported here."""
        name = self._resolve_group(key, group)
        locales = self._locales_of(name)
        values = {
            locale: self._groups[name][locale][key]
            for locale in locales
            if key in self._groups[name][locale]
        }

        return self._analyzer.check_entry(
            Entry(key=key, values=values, locales=locales, group=name)
        )

    def analyze(self) -> Result:
        """Check everything the session holds. Reads no files."""
        return self._analyzer.analyze(
            Input(
                groups=self._groups,
                files=self._files,
                issues=self._source_issues,
                unused_keys=self._unused_keys,
                undefined_keys=self._undefined_keys,
                file_format=self._file_format,
            )
        )


def create_session(data: Input | None = None, options: Options | None = None) -> Session:
    """Hold a set of translations and check them repeatedly."""
    return Session(data, options)
