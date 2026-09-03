"""The comparison itself: every check that reads translation data."""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from typing import Any, Final

from chki18n._types import (
    Entry,
    Input,
    Issue,
    Options,
    ResolvedOptions,
    Result,
    SourceFile,
    TranslationGroups,
    TranslationMap,
)
from chki18n.constants import CheckCode
from chki18n.core.duplicate import find_duplicate_keys, flatten_translations
from chki18n.core.interpolation import extract_interpolation_keys
from chki18n.core.issue import apply_level_overrides, create_issue
from chki18n.core.key import check_key_shape
from chki18n.core.plural import plural_categories_of, plural_parts_of, uses_plural_category
from chki18n.core.result import build_result
from chki18n.core.value import (
    extract_numbers,
    extract_tags,
    find_invisible_character,
    has_translatable_text,
    name_of_invisible_character,
    script_of_locale,
)
from chki18n.core.width import display_width
from chki18n.options import resolve_options

_DIGIT_PATTERN: Final = re.compile(r"\d")

_SURROUNDING_WHITESPACE_PATTERN: Final = re.compile(r"^\s|\s$")

_NO_KEYS: Final[list[str]] = []

#: Below this many columns a length ratio says nothing: `OK` and its four
#: character translation are four times apart and both are correct.
_MIN_MEASURED_LENGTH: Final = 8

#: Stands where a locale has no value at all, which is not the same as a value
#: of ``None``: one is a missing key and the other is a key whose value is null.
_MISSING: Final = object()


def _times(count: int) -> str:
    return f"{count} time{'' if count == 1 else 's'}"


def _list_of(items: list[str]) -> str:
    """`a`, `a and b`, `a, b and c` -- a list as a sentence reads it."""
    if len(items) < 3:
        return " and ".join(items)

    return f"{', '.join(items[:-1])} and {items[-1]}"


def _count_of(items: list[str]) -> dict[str, int]:
    """How often each item appears, for the checks that compare two multisets."""
    counts: dict[str, int] = {}

    for item in items:
        counts[item] = counts.get(item, 0) + 1

    return counts


def _same_items(left: list[str], right: list[str]) -> bool:
    """The same items in the same numbers, whatever order they appear in."""
    if len(left) != len(right):
        return False

    # A translation almost always keeps the numbers in the order it found them,
    # so the answer is usually one walk and no allocation at all.
    if left == right:
        return True

    return sorted(left) == sorted(right)


@dataclass(slots=True)
class _TagCount:
    """One markup tag, counted and quoted as it was actually written."""

    text: str
    count: int = 1


def _count_tags(tags: list[str]) -> dict[str, _TagCount]:
    """Markup tags by their lower case spelling, keeping the first spelling seen.

    HTML tag names are case insensitive, so `<B>` and `<b>` are the same tag, and
    a message still quotes the tag the way the file wrote it.
    """
    counts: dict[str, _TagCount] = {}

    for tag in tags:
        found = counts.get(tag.lower())

        if found is not None:
            found.count += 1
            continue

        counts[tag.lower()] = _TagCount(tag)

    return counts


@dataclass(frozen=True, slots=True)
class _CheckFlags:
    """Whether each comparison check is enabled, resolved once."""

    invalid_value_type: bool
    no_locale: bool
    no_key: bool
    dummy_key: bool
    unused_key: bool
    undefined_key: bool
    no_plural_form: bool
    empty_value: bool
    no_interpolation_key: bool
    extra_interpolation_key: bool
    interpolation_count: bool
    tag_mismatch: bool
    not_translated_value: bool
    untranslated_script: bool
    duplicate_value: bool
    inconsistent_value: bool
    surrounding_whitespace: bool
    invisible_character: bool
    missing_number: bool
    number_mismatch: bool
    suspicious_length: bool

    @staticmethod
    def of(enabled: frozenset[CheckCode]) -> _CheckFlags:
        """Read the enabled set once, instead of asking it for every key of every locale."""
        return _CheckFlags(
            invalid_value_type="INVALID_VALUE_TYPE" in enabled,
            no_locale="NO_LOCALE" in enabled,
            no_key="NO_KEY" in enabled,
            dummy_key="DUMMY_KEY" in enabled,
            unused_key="UNUSED_KEY" in enabled,
            undefined_key="UNDEFINED_KEY" in enabled,
            no_plural_form="NO_PLURAL_FORM" in enabled,
            empty_value="EMPTY_VALUE" in enabled,
            no_interpolation_key="NO_INTERPOLATION_KEY" in enabled,
            extra_interpolation_key="EXTRA_INTERPOLATION_KEY" in enabled,
            interpolation_count="INTERPOLATION_COUNT" in enabled,
            tag_mismatch="TAG_MISMATCH" in enabled,
            not_translated_value="NOT_TRANSLATED_VALUE" in enabled,
            untranslated_script="UNTRANSLATED_SCRIPT" in enabled,
            duplicate_value="DUPLICATE_VALUE" in enabled,
            inconsistent_value="INCONSISTENT_VALUE" in enabled,
            surrounding_whitespace="SURROUNDING_WHITESPACE" in enabled,
            invisible_character="INVISIBLE_CHARACTER" in enabled,
            missing_number="MISSING_NUMBER" in enabled,
            number_mismatch="NUMBER_MISMATCH" in enabled,
            suspicious_length="SUSPICIOUS_LENGTH" in enabled,
        )


def _as_display_value(value: Any) -> str:
    """Values are reported as text, whatever their original type was.

    Spelled the way JSON spells them rather than the way Python does, so a report
    quotes `null` and `true` and reads the same in every package.
    """
    if isinstance(value, str):
        return value

    if value is None:
        return "null"

    if isinstance(value, bool):
        return "true" if value else "false"

    return str(value)


def _type_name_of(value: Any) -> str:
    """What JavaScript's `typeof` would call this value, so the wording is shared."""
    if isinstance(value, bool):
        return "boolean"

    if isinstance(value, int | float):
        return "number"

    return "object"


def _build_file_lookup(files: list[SourceFile]) -> dict[str, str] | None:
    if not files:
        return None

    return {f"{file.group} {file.locale}": file.path for file in files}


def _report_tag_mismatch(
    issues: list[Issue],
    base: dict[str, Any],
    value: str,
    expected: dict[str, _TagCount],
) -> None:
    """Report the markup this value does not carry the way the target language does.

    Counts rather than presence: a value that opens `<b>` twice and closes it
    once renders as broken as one that dropped the tag altogether.
    """
    found = _count_tags(extract_tags(value))

    if not found and not expected:
        return

    missing: list[str] = []
    extra: list[str] = []

    # One finding per direction rather than per tag: a dropped `<b>...</b>` is a
    # single mistake, and reporting its two halves separately reads as two.
    for identifier, tag in expected.items():
        seen = found[identifier].count if identifier in found else 0

        if seen < tag.count:
            missing.append(
                f"`{tag.text}`" if seen < 1 else f"`{tag.text}` ({_times(seen)} of {tag.count})"
            )

    for identifier, tag in found.items():
        wanted = expected[identifier].count if identifier in expected else 0

        if tag.count > wanted:
            extra.append(
                f"`{tag.text}`" if wanted < 1 else f"`{tag.text}` ({_times(tag.count)} of {wanted})"
            )

    if missing:
        issues.append(
            create_issue(
                "TAG_MISMATCH",
                **base,
                value=value,
                message=(
                    f"The {'tag' if len(missing) == 1 else 'tags'} {_list_of(missing)} of the "
                    f"target language {'is' if len(missing) == 1 else 'are'} missing from "
                    "this value."
                ),
            )
        )

    if extra:
        issues.append(
            create_issue(
                "TAG_MISMATCH",
                **base,
                value=value,
                message=(
                    f"The {'tag' if len(extra) == 1 else 'tags'} {_list_of(extra)} "
                    f"{'is' if len(extra) == 1 else 'are'} not in the target language."
                ),
            )
        )


def _check_key_slots(
    issues: list[Issue],
    key: str,
    group: str,
    locale_names: list[str],
    values: list[Any],
    target_index: int,
    flags: _CheckFlags,
    options: ResolvedOptions,
    file_of: dict[str, str] | None,
) -> None:
    """Compare one key across every locale.

    Locales are addressed by index into two parallel lists rather than by one
    object per key: a full analysis calls this once per key per group, so the
    caller can refill the same lists instead of allocating on every iteration.
    """
    has_target_key = target_index != -1 and values[target_index] is not _MISSING
    target_value = values[target_index] if has_target_key else None
    target_is_string = has_target_key and isinstance(target_value, str)
    target_text = _as_display_value(target_value) if has_target_key else None
    target_interpolations = (
        extract_interpolation_keys(
            target_value, options.interpolation_prefix, options.interpolation_suffix
        )
        if target_is_string
        else _NO_KEYS
    )
    target_has_digit = target_is_string and _DIGIT_PATTERN.search(str(target_value)) is not None
    target_numbers = (
        extract_numbers(str(target_value))
        if flags.number_mismatch and target_has_digit
        else _NO_KEYS
    )
    # Counted once per key rather than once per locale: what the target language
    # carries does not change while the locales are walked.
    target_tag_counts = (
        _count_tags(extract_tags(str(target_value)))
        if flags.tag_mismatch and target_is_string
        else None
    )
    target_width = (
        display_width(str(target_value))
        if flags.suspicious_length and options.length_ratio is not None and target_is_string
        else 0
    )
    target_interpolation_counts = (
        _count_of(target_interpolations)
        if flags.interpolation_count and target_interpolations
        else None
    )
    check_interpolation = (
        flags.no_interpolation_key or flags.extra_interpolation_key or flags.interpolation_count
    )
    # A plural key belongs to one language's grammar. Korean needs only `other`,
    # so `item_one` being absent from it is correct rather than missing, and
    # Russian needs `item_few` that English never writes.
    plural = plural_parts_of(key)

    for index, locale in enumerate(locale_names):
        if index == target_index:
            continue

        value = values[index]
        file = file_of.get(f"{group} {locale}") if file_of is not None else None
        base: dict[str, Any] = {
            "locale": locale,
            "key": key,
            "group": group,
            "file": file,
            "target_value": target_text,
        }

        if value is _MISSING:
            if (
                has_target_key
                and flags.no_key
                and (plural is None or uses_plural_category(locale, plural[1]))
            ):
                issues.append(create_issue("NO_KEY", **base))

            continue

        text = _as_display_value(value)

        if (
            not has_target_key
            and flags.dummy_key
            # The target language may simply have no use for this plural form.
            and (plural is None or uses_plural_category(options.target, plural[1]))
        ):
            issues.append(create_issue("DUMMY_KEY", **base, value=text))

        if not isinstance(value, str):
            if flags.invalid_value_type:
                spelled = "`null`" if value is None else f"a `{_type_name_of(value)}`"

                issues.append(
                    create_issue(
                        "INVALID_VALUE_TYPE",
                        **base,
                        value=text,
                        message=f"The value is {spelled}, not a translatable string.",
                    )
                )

            continue

        if not value:
            if flags.empty_value:
                issues.append(create_issue("EMPTY_VALUE", **base, value=value))

            continue

        if flags.surrounding_whitespace and _SURROUNDING_WHITESPACE_PATTERN.search(value):
            issues.append(create_issue("SURROUNDING_WHITESPACE", **base, value=value))

        if flags.invisible_character:
            invisible = find_invisible_character(value)

            if invisible is not None:
                issues.append(
                    create_issue(
                        "INVISIBLE_CHARACTER",
                        **base,
                        value=value,
                        message=(
                            f"The value holds {name_of_invisible_character(invisible)}, "
                            "which nothing will draw."
                        ),
                    )
                )

        if target_is_string:
            if flags.not_translated_value and value == target_value:
                issues.append(create_issue("NOT_TRANSLATED_VALUE", **base, value=value))

            if flags.missing_number and target_has_digit and not _DIGIT_PATTERN.search(value):
                issues.append(create_issue("MISSING_NUMBER", **base, value=value))

            if flags.number_mismatch and target_has_digit and _DIGIT_PATTERN.search(value):
                numbers = extract_numbers(value)

                if not _same_items(target_numbers, numbers):
                    issues.append(
                        create_issue(
                            "NUMBER_MISMATCH",
                            **base,
                            value=value,
                            message=(
                                f"The target language uses {', '.join(target_numbers)} and "
                                f"this value uses {', '.join(numbers)}."
                            ),
                        )
                    )

            if target_tag_counts is not None and (target_tag_counts or "<" in value):
                _report_tag_mismatch(issues, base, value, target_tag_counts)

            # A value identical to the target language is already reported as
            # untranslated; saying it twice adds nothing.
            if flags.untranslated_script and value != target_value:
                script = script_of_locale(locale)

                if (
                    script is not None
                    and not script.search(value)
                    and has_translatable_text(
                        value, options.interpolation_prefix, options.interpolation_suffix
                    )
                ):
                    issues.append(create_issue("UNTRANSLATED_SCRIPT", **base, value=value))

            length_ratio = options.length_ratio

            if target_width >= _MIN_MEASURED_LENGTH and length_ratio is not None:
                ratio = display_width(value) / target_width

                if ratio > length_ratio or ratio * length_ratio < 1:
                    issues.append(
                        create_issue(
                            "SUSPICIOUS_LENGTH",
                            **base,
                            value=value,
                            message=(
                                f"The value is {ratio:.1f} times the length of the target "
                                "language value."
                            ),
                        )
                    )

        if not has_target_key or not check_interpolation:
            continue

        current_interpolations = extract_interpolation_keys(
            value, options.interpolation_prefix, options.interpolation_suffix
        )

        if flags.no_interpolation_key:
            for interpolation in target_interpolations:
                if interpolation in current_interpolations:
                    continue

                issues.append(
                    create_issue(
                        "NO_INTERPOLATION_KEY",
                        **base,
                        value=value,
                        interpolation=interpolation,
                        message=(
                            f"The interpolation key `{options.interpolation_prefix}"
                            f"{interpolation}{options.interpolation_suffix}` of the target "
                            "language is missing from this value."
                        ),
                    )
                )

        if flags.extra_interpolation_key:
            for interpolation in current_interpolations:
                if interpolation in target_interpolations:
                    continue

                issues.append(
                    create_issue(
                        "EXTRA_INTERPOLATION_KEY",
                        **base,
                        value=value,
                        interpolation=interpolation,
                        message=(
                            f"The interpolation key `{options.interpolation_prefix}"
                            f"{interpolation}{options.interpolation_suffix}` is not defined "
                            "by the target language."
                        ),
                    )
                )

        # Only a repeated placeholder can differ in number, and the two checks
        # above already report one that is missing or unknown outright.
        if target_interpolation_counts is None or (
            len(target_interpolations) < 2 and len(current_interpolations) < 2
        ):
            continue

        current_counts = _count_of(current_interpolations)

        for interpolation, expected in target_interpolation_counts.items():
            found = current_counts.get(interpolation)

            if found is None or found == expected:
                continue

            issues.append(
                create_issue(
                    "INTERPOLATION_COUNT",
                    **base,
                    value=value,
                    interpolation=interpolation,
                    message=(
                        f"The interpolation key `{options.interpolation_prefix}"
                        f"{interpolation}{options.interpolation_suffix}` is used "
                        f"{_times(found)} here and {_times(expected)} in the target language."
                    ),
                )
            )


def _check_duplicate_values(
    issues: list[Issue],
    group: str,
    locale_names: list[str],
    maps: list[TranslationMap],
    target_index: int,
    file_of: dict[str, str] | None,
) -> None:
    """Report keys of one locale that repeat a value another key already uses.

    This is the one check that has to see a whole locale at once, so it cannot
    live in `_check_key_slots`. A dictionary keyed by the value keeps it linear.
    """
    for index, locale in enumerate(locale_names):
        first_key_of_value: dict[str, str] = {}

        for key, value in maps[index].items():
            if not isinstance(value, str) or not value:
                continue

            first_key = first_key_of_value.get(value)

            if first_key is None:
                first_key_of_value[value] = key
                continue

            target_value = maps[target_index].get(key) if target_index != -1 else None

            issues.append(
                create_issue(
                    "DUPLICATE_VALUE",
                    locale=locale,
                    key=key,
                    group=group,
                    value=value,
                    target_value=(
                        None if target_value is None else _as_display_value(target_value)
                    ),
                    related_key=first_key,
                    file=file_of.get(f"{group} {locale}") if file_of is not None else None,
                    message=f"The key `{first_key}` in the same locale already uses this value.",
                )
            )


def _check_inconsistent_values(
    issues: list[Issue],
    group: str,
    locale_names: list[str],
    maps: list[TranslationMap],
    target_index: int,
    target: str,
    file_of: dict[str, str] | None,
) -> None:
    """Report keys that share one target language string but are translated two ways.

    `DUPLICATE_VALUE` asks whether one locale repeats itself; this asks the
    opposite question, and catches the terminology drift that turns one `Save`
    button into two different words on two screens.
    """
    keys_of_value: dict[str, list[str]] = {}

    for key, value in maps[target_index].items():
        if not isinstance(value, str) or not value:
            continue

        keys_of_value.setdefault(value, []).append(key)

    for target_value, keys in keys_of_value.items():
        if len(keys) < 2:
            continue

        for index, locale in enumerate(locale_names):
            if index == target_index:
                continue

            first_key = ""
            first_value = ""

            for key in keys:
                value = maps[index].get(key)

                # A key this locale does not have, or has not filled in, is
                # somebody else's finding.
                if not isinstance(value, str) or not value:
                    continue

                if not first_key:
                    first_key = key
                    first_value = value
                    continue

                if value == first_value:
                    continue

                issues.append(
                    create_issue(
                        "INCONSISTENT_VALUE",
                        locale=locale,
                        key=key,
                        group=group,
                        value=value,
                        target_value=target_value,
                        related_key=first_key,
                        file=(file_of.get(f"{group} {locale}") if file_of is not None else None),
                        message=(
                            f"The key `{first_key}` has the same {target} value but is "
                            f'translated as "{first_value}".'
                        ),
                    )
                )


def _check_plural_forms(
    issues: list[Issue],
    group: str,
    locale_names: list[str],
    maps: list[TranslationMap],
    file_of: dict[str, str] | None,
) -> None:
    """Report a plural key one of whose forms the language needs and does not have.

    Which forms a language needs is a fact about the language, not about the
    target: English writes two, Russian four, Korean one, and a file that follows
    its own language is right even where it does not follow the original.
    """
    for index, locale in enumerate(locale_names):
        categories = plural_categories_of(locale)

        if categories is None:
            continue

        forms_of_base: dict[str, set[str]] = {}

        for key in maps[index]:
            parts = plural_parts_of(key)

            if parts is None:
                continue

            forms_of_base.setdefault(parts[0], set()).add(parts[1])

        for base, found in forms_of_base.items():
            missing = [category for category in categories if category not in found]

            if not missing:
                continue

            issues.append(
                create_issue(
                    "NO_PLURAL_FORM",
                    locale=locale,
                    key=base,
                    group=group,
                    file=file_of.get(f"{group} {locale}") if file_of is not None else None,
                    message=(
                        f"`{locale}` needs "
                        f"{_list_of([f'`{base}_{category}`' for category in missing])} and "
                        f"the file does not define {'it' if len(missing) == 1 else 'them'}."
                    ),
                )
            )


def collect_keys(maps: list[TranslationMap], target_index: int) -> list[str]:
    """Keys of every locale, target language first so reports follow its order."""
    keys: list[str] = []
    seen: set[str] = set()

    def collect(one: TranslationMap) -> None:
        for key in one:
            if key in seen:
                continue

            seen.add(key)
            keys.append(key)

    if target_index != -1:
        collect(maps[target_index])

    for index, one in enumerate(maps):
        if index != target_index:
            collect(one)

    return keys


def prepare_groups(
    data: Input,
    options: ResolvedOptions,
    issues: list[Issue],
    *,
    flattened: bool | None = None,
) -> TranslationGroups:
    """Bring the input into the `group -> locale -> flat map` shape the analysis works on.

    With `flattened` the caller's own dictionaries are used as they are, which is
    what makes analysing data already held in memory allocation free. The keyword
    overrides what the options say, which is how a session flattens once up front
    and still hands the analyzer maps it is told are already flat.
    """
    already_flat = options.flattened if flattened is None else flattened
    source = data.groups if data.groups is not None else {"": data.locales or {}}
    prepared: TranslationGroups = {}

    for group, locales in source.items():
        prepared_locales: dict[str, TranslationMap] = {}

        for locale, values in (locales or {}).items():
            if not isinstance(values, dict):
                issues.append(
                    create_issue(
                        "INVALID_FILE",
                        locale=locale,
                        group=group,
                        message=f"The translations of `{locale}` are not an object.",
                    )
                )
                continue

            if already_flat:
                prepared_locales[locale] = values
                continue

            # Before flattening, because flattening is what hides it: two
            # definitions go in and one key comes out.
            if "DUPLICATE_KEY" in options.enabled_checks:
                for key in find_duplicate_keys(values):
                    issues.append(
                        create_issue(
                            "DUPLICATE_KEY",
                            locale=locale,
                            group=group,
                            key=key,
                            message=(
                                f"The key `{key}` is defined more than once, so one of its "
                                "values is lost."
                            ),
                        )
                    )

            prepared_locales[locale] = flatten_translations(values)

        prepared[group] = prepared_locales

    return prepared


def _now_ms() -> int:
    return int(time.monotonic() * 1000)


class Analyzer:
    """A reusable analyzer bound to one set of options.

    Prefer this over calling `analyze_translations` repeatedly: the options, the
    enabled checks and the interpolation delimiters are resolved once, so a
    caller re-checking after every edit pays only for the comparison itself.
    """

    __slots__ = ("_flags", "option_issues", "options")

    def __init__(self, options: Options | None = None) -> None:
        """Create an analyzer bound to `options`."""
        resolved = resolve_options(options)

        #: The options every call of this analyzer runs with.
        self.options: ResolvedOptions = resolved[0]
        #: Issues raised while resolving those options, replayed into every result.
        self.option_issues: list[Issue] = resolved[1]
        self._flags = _CheckFlags.of(self.options.enabled_checks)

    def analyze(self, data: Input) -> Result:
        """Compare a whole set of translations held in memory."""
        started_at = _now_ms()
        options = self.options
        flags = self._flags
        # Whatever produced the input may already have found problems (an
        # unreadable file, say); they belong in the same report.
        issues: list[Issue] = [*data.issues, *self.option_issues]
        groups = prepare_groups(data, options, issues)
        group_names = list(groups)
        # Collected before the comparison rather than during it: a group can only
        # be missing a language once every group has said which ones it has.
        all_locales: dict[str, None] = {}

        for group in group_names:
            for locale in groups[group]:
                all_locales.setdefault(locale)

        file_of = _build_file_lookup(data.files)
        # Supplied rather than worked out: whether a key is referenced is a fact
        # about the source tree, which the comparison never sees.
        unused_keys = set(data.unused_keys) if flags.unused_key and data.unused_keys else None

        if flags.undefined_key:
            for usage in data.undefined_keys:
                issues.append(
                    create_issue(
                        "UNDEFINED_KEY",
                        key=usage.key,
                        file=usage.file,
                        message=(
                            f"The scanned source asks for `{usage.key}` and no language file "
                            "defines it."
                        ),
                    )
                )

        key_count = 0

        for group in group_names:
            locale_maps = groups[group]
            locale_names = list(locale_maps)

            # Only worth asking with more than one group: with a single one,
            # every language that exists at all is in it by definition.
            if flags.no_locale and len(group_names) > 1:
                for locale in all_locales:
                    if locale in locale_maps:
                        continue

                    issues.append(
                        create_issue(
                            "NO_LOCALE",
                            locale=locale,
                            group=group,
                            message=(
                                f"`{group}` holds no translations for `{locale}`, so none of "
                                "its keys exist there."
                            ),
                        )
                    )

            target_index = (
                locale_names.index(options.target) if options.target in locale_names else -1
            )

            if target_index == -1:
                issues.append(
                    create_issue(
                        "INVALID_OPTIONS",
                        level="error",
                        group=group,
                        message=(
                            f"The target language `{options.target}` was not found"
                            f"{f' in `{group}`' if group else ''}. There is nothing to "
                            "compare against."
                        ),
                    )
                )
                continue

            maps = [locale_maps[locale] for locale in locale_names]
            keys = collect_keys(maps, target_index)
            values: list[Any] = [_MISSING] * len(maps)

            key_count += len(keys)

            for key in keys:
                # The shape of a key is the same in every language, so it is
                # judged once rather than once per locale.
                check_key_shape(issues, key, group, options)

                for index, one in enumerate(maps):
                    values[index] = one.get(key, _MISSING)

                _check_key_slots(
                    issues,
                    key,
                    group,
                    locale_names,
                    values,
                    target_index,
                    flags,
                    options,
                    file_of,
                )

                # Not locale-bound: the key is unreferenced, not one language's
                # translation of it.
                if unused_keys is not None and key in unused_keys:
                    issues.append(create_issue("UNUSED_KEY", key=key, group=group))

            if flags.duplicate_value:
                _check_duplicate_values(issues, group, locale_names, maps, target_index, file_of)

            if flags.no_plural_form:
                _check_plural_forms(issues, group, locale_names, maps, file_of)

            if flags.inconsistent_value:
                _check_inconsistent_values(
                    issues, group, locale_names, maps, target_index, options.target, file_of
                )

        apply_level_overrides(issues, options.levels)

        return build_result(
            issues,
            options,
            locales=list(all_locales),
            groups=group_names,
            key_count=key_count,
            files=data.files,
            file_format=data.file_format,
            elapsed_ms=_now_ms() - started_at,
        )

    def check_entry(self, entry: Entry) -> list[Issue]:
        """Compare a single key across locales.

        Cross-key checks (`DUPLICATE_VALUE` and the rest of
        `CROSS_KEY_CHECK_CODES`) cannot be answered from one key and are never
        reported here.
        """
        issues: list[Issue] = []
        locale_names = list(entry.locales) if entry.locales is not None else list(entry.values)
        values: list[Any] = [entry.values.get(locale, _MISSING) for locale in locale_names]

        check_key_shape(issues, entry.key, entry.group, self.options)
        _check_key_slots(
            issues,
            entry.key,
            entry.group,
            locale_names,
            values,
            (
                locale_names.index(self.options.target)
                if self.options.target in locale_names
                else -1
            ),
            self._flags,
            self.options,
            None,
        )

        return apply_level_overrides(issues, self.options.levels)


def create_analyzer(options: Options | None = None) -> Analyzer:
    """A reusable analyzer bound to one set of options."""
    return Analyzer(options)


def analyze_translations(data: Input, options: Options | None = None) -> Result:
    """Compare translations held in memory.

    Does no file system work at all, so this is the entry point to use when the
    strings are already loaded.
    """
    return Analyzer(options).analyze(data)
