"""One test per check, over the smallest pair of locales that can trigger it."""

from __future__ import annotations

from typing import Any

from chki18n import (
    CheckCode,
    Entry,
    Input,
    Issue,
    Options,
    analyze_translations,
    create_analyzer,
    extract_numbers,
    extract_tags,
    find_invisible_character,
    has_translatable_text,
    plural_base_of,
    plural_categories_of,
    plural_parts_of,
    script_of_locale,
)

#: Written as escapes: a test file holding one of these is unreviewable.
ZERO_WIDTH_INSIDE = "\uc900\u200b\ube44"

NON_BREAKING_INSIDE = "\uac00\u00a0\ub098"

ZERO_WIDTH_SPACE = "\u200b"


def check(
    code: CheckCode,
    locales: dict[str, dict[str, Any]],
    **options: Any,
) -> list[Issue]:
    """Run one check on one pair of locales, which is what most of these need."""
    return analyze_translations(
        Input(locales=locales),
        Options(target="en", flattened=True, checks=[code], **options),
    ).of(code)


def test_no_locale_finds_the_language_a_group_is_missing_entirely() -> None:
    result = analyze_translations(
        Input(
            groups={
                "common.json": {
                    "en": {"title": "Folder"},
                    "ko": {"title": "폴더"},
                    "ja": {"title": "フォルダ"},
                },
                "errors.json": {"en": {"missing": "Not found"}, "ko": {"missing": "없음"}},
            }
        ),
        Options(target="en", checks=["NO_LOCALE"]),
    )
    issues = result.of("NO_LOCALE")

    assert len(issues) == 1
    assert issues[0].locale == "ja"
    assert issues[0].group == "errors.json"
    assert issues[0].key == ""
    assert result.success is False


def test_no_locale_says_nothing_when_every_group_has_every_language() -> None:
    result = analyze_translations(
        Input(
            groups={
                "a": {"en": {"x": "X"}, "ko": {"x": "ㄱ"}},
                "b": {"en": {"y": "Y"}, "ko": {"y": "ㄴ"}},
            }
        ),
        Options(target="en", checks=["NO_LOCALE"]),
    )

    assert result.issues == []


def test_no_locale_cannot_fire_on_a_single_group() -> None:
    assert check("NO_LOCALE", {"en": {"a": "A"}, "ko": {"a": "ㄱ"}}) == []


def test_interpolation_count_finds_a_placeholder_used_fewer_times() -> None:
    issues = check(
        "INTERPOLATION_COUNT",
        {"en": {"a": "{name} invited {name}"}, "ko": {"a": "{name}님이 초대했습니다"}},
    )

    assert len(issues) == 1
    assert issues[0].interpolation == "name"
    assert "1 time here and 2 times" in issues[0].message


def test_interpolation_count_finds_one_used_more_times_as_well() -> None:
    assert (
        len(
            check(
                "INTERPOLATION_COUNT",
                {"en": {"a": "Hello {name}"}, "ko": {"a": "{name}님 안녕하세요 {name}님"}},
            )
        )
        == 1
    )


def test_interpolation_count_leaves_an_absent_placeholder_to_the_other_checks() -> None:
    assert (
        check("INTERPOLATION_COUNT", {"en": {"a": "Hello {name}"}, "ko": {"a": "안녕하세요"}}) == []
    )


def test_interpolation_count_says_nothing_when_the_counts_agree() -> None:
    assert (
        check(
            "INTERPOLATION_COUNT",
            {"en": {"a": "{a} and {a} and {b}"}, "ko": {"a": "{b}, {a}, {a}"}},
        )
        == []
    )


def test_tag_mismatch_reports_every_missing_tag_as_one_finding() -> None:
    issues = check(
        "TAG_MISMATCH",
        {"en": {"a": "Click <b>here</b> to continue"}, "ko": {"a": "계속하려면 여기를 누르세요"}},
    )

    assert len(issues) == 1
    assert "`<b>` and `</b>`" in issues[0].message


def test_tag_mismatch_reports_a_tag_the_target_does_not_have() -> None:
    issues = check("TAG_MISMATCH", {"en": {"a": "Plain text"}, "ko": {"a": "<i>기울임</i>"}})

    assert len(issues) == 1
    assert "not in the target language" in issues[0].message


def test_tag_mismatch_counts_the_tags_rather_than_only_looking_for_them() -> None:
    issues = check(
        "TAG_MISMATCH",
        {"en": {"a": "<b>one</b> and <b>two</b>"}, "ko": {"a": "<b>하나</b>와 둘"}},
    )

    assert len(issues) == 1
    assert "1 time of 2" in issues[0].message


def test_tag_mismatch_reads_a_tag_name_whatever_its_case() -> None:
    assert check("TAG_MISMATCH", {"en": {"a": "<B>Bold</B>"}, "ko": {"a": "<b>굵게</b>"}}) == []


def test_tag_mismatch_does_not_mistake_a_comparison_for_markup() -> None:
    assert (
        check(
            "TAG_MISMATCH",
            {"en": {"a": "Use a < b to compare"}, "ko": {"a": "비교하려면 a < b 를 쓰세요"}},
        )
        == []
    )


def test_untranslated_script_finds_a_korean_value_with_no_korean_character() -> None:
    issues = check("UNTRANSLATED_SCRIPT", {"en": {"a": "Hello"}, "ko": {"a": "Hello!"}})

    assert len(issues) == 1
    assert issues[0].locale == "ko"


def test_untranslated_script_leaves_an_identical_value_to_the_other_check() -> None:
    assert check("UNTRANSLATED_SCRIPT", {"en": {"a": "Hello"}, "ko": {"a": "Hello"}}) == []


def test_untranslated_script_says_nothing_about_a_latin_language() -> None:
    assert check("UNTRANSLATED_SCRIPT", {"en": {"a": "Hello"}, "fr": {"a": "Salut !"}}) == []


def test_untranslated_script_says_nothing_about_a_locale_naming_latin() -> None:
    assert check("UNTRANSLATED_SCRIPT", {"en": {"a": "Hello"}, "sr-Latn": {"a": "Zdravo"}}) == []


def test_untranslated_script_leaves_a_placeholder_or_a_number_alone() -> None:
    assert (
        check(
            "UNTRANSLATED_SCRIPT",
            {"en": {"a": "{count}", "b": "2026"}, "ko": {"a": "{count}", "b": "2026"}},
        )
        == []
    )


def test_inconsistent_value_finds_one_original_translated_two_ways() -> None:
    issues = check(
        "INCONSISTENT_VALUE",
        {
            "en": {"save-a": "Save", "save-b": "Save"},
            "ko": {"save-a": "저장", "save-b": "보관"},
        },
    )

    assert len(issues) == 1
    assert issues[0].key == "save-b"
    assert issues[0].related_key == "save-a"
    assert issues[0].locale == "ko"


def test_inconsistent_value_says_nothing_when_the_two_agree() -> None:
    assert (
        check(
            "INCONSISTENT_VALUE",
            {"en": {"a": "Save", "b": "Save"}, "ko": {"a": "저장", "b": "저장"}},
        )
        == []
    )


def test_inconsistent_value_leaves_an_unfilled_key_to_the_other_checks() -> None:
    assert (
        check("INCONSISTENT_VALUE", {"en": {"a": "Save", "b": "Save"}, "ko": {"a": "저장"}}) == []
    )


def test_invisible_character_finds_a_zero_width_space_and_names_it() -> None:
    issues = check("INVISIBLE_CHARACTER", {"en": {"a": "Ready"}, "ko": {"a": ZERO_WIDTH_INSIDE}})

    assert len(issues) == 1
    assert "zero width space" in issues[0].message
    assert "U+200B" in issues[0].message


def test_invisible_character_finds_a_non_breaking_space() -> None:
    assert (
        len(check("INVISIBLE_CHARACTER", {"en": {"a": "A B"}, "ko": {"a": NON_BREAKING_INSIDE}}))
        == 1
    )


def test_invisible_character_says_nothing_about_ordinary_text() -> None:
    assert check("INVISIBLE_CHARACTER", {"en": {"a": "Ready"}, "ko": {"a": "준비됨"}}) == []


def test_number_mismatch_finds_a_number_the_translation_changed() -> None:
    issues = check(
        "NUMBER_MISMATCH", {"en": {"a": "You have 3 items"}, "ko": {"a": "5개 있습니다"}}
    )

    assert len(issues) == 1
    assert "uses 3" in issues[0].message


def test_number_mismatch_accepts_numbers_the_translation_reordered() -> None:
    assert check("NUMBER_MISMATCH", {"en": {"a": "3 of 5"}, "ko": {"a": "5 중 3"}}) == []


def test_number_mismatch_leaves_a_digitless_translation_to_missing_number() -> None:
    assert (
        check(
            "NUMBER_MISMATCH",
            {"en": {"a": "You have 3 items"}, "ko": {"a": "여러 개 있습니다"}},
        )
        == []
    )


def test_number_mismatch_tells_a_padded_number_from_a_bare_one() -> None:
    assert len(check("NUMBER_MISMATCH", {"en": {"a": "Step 3"}, "ko": {"a": "03 단계"}})) == 1


LONG = "Please choose the folder you would like to upload"


def test_suspicious_length_reports_nothing_until_length_ratio_says_so() -> None:
    assert check("SUSPICIOUS_LENGTH", {"en": {"a": LONG}, "ko": {"a": "폴더"}}) == []


def test_suspicious_length_finds_a_translation_far_shorter() -> None:
    issues = check("SUSPICIOUS_LENGTH", {"en": {"a": LONG}, "ko": {"a": "폴더"}}, length_ratio=3)

    assert len(issues) == 1
    assert issues[0].level == "info"


def test_suspicious_length_finds_one_far_longer_as_well() -> None:
    assert (
        len(
            check(
                "SUSPICIOUS_LENGTH",
                {
                    "en": {"a": "Upload a file"},
                    "ko": {"a": "파일을 하나 올리는 방법에 대한 아주 긴 설명입니다"},
                },
                length_ratio=2,
            )
        )
        == 1
    )


def test_suspicious_length_counts_a_wide_character_as_two() -> None:
    assert (
        check(
            "SUSPICIOUS_LENGTH",
            {"en": {"a": "Shared folder"}, "ko": {"a": "공유 폴더"}},
            length_ratio=2,
        )
        == []
    )


def test_suspicious_length_leaves_a_short_original_alone() -> None:
    assert (
        check(
            "SUSPICIOUS_LENGTH",
            {"en": {"a": "OK"}, "ko": {"a": "확인했습니다"}},
            length_ratio=2,
        )
        == []
    )


FORMS: dict[str, dict[str, Any]] = {"en": {"item_one": "1 item", "item_other": "{count} items"}}


def test_no_plural_form_asks_a_language_only_for_the_forms_it_uses() -> None:
    assert check("NO_PLURAL_FORM", {**FORMS, "ko": {"item_other": "{count}개"}}) == []


def test_no_plural_form_finds_the_forms_a_language_needs_and_lacks() -> None:
    issues = check(
        "NO_PLURAL_FORM",
        {**FORMS, "ru": {"item_one": "1 элемент", "item_other": "{count} элементов"}},
    )

    assert len(issues) == 1
    assert issues[0].locale == "ru"
    assert issues[0].key == "item"
    assert "`item_few`" in issues[0].message
    assert "`item_many`" in issues[0].message


def test_no_plural_form_judges_the_target_language_too() -> None:
    issues = check(
        "NO_PLURAL_FORM",
        {"en": {"item_one": "1 item"}, "ko": {"item_other": "{count}개"}},
    )

    assert len(issues) == 1
    assert issues[0].locale == "en"


def test_no_plural_form_says_nothing_about_a_language_it_has_no_table_for() -> None:
    assert check("NO_PLURAL_FORM", {**FORMS, "mt": {"item_one": "1 oggett"}}) == []


def test_no_plural_form_leaves_the_older_convention_as_ordinary_keys() -> None:
    assert check("NO_PLURAL_FORM", {"en": {"item": "1 item", "item_plural": "{count} items"}}) == []


def test_no_key_does_not_ask_a_language_for_a_form_it_never_uses() -> None:
    assert (
        check(
            "NO_KEY",
            {
                "en": {"item_one": "1 item", "item_other": "{count} items"},
                "ko": {"item_other": "{count}개"},
            },
        )
        == []
    )


def test_no_key_still_asks_for_the_forms_the_language_does_use() -> None:
    issues = check(
        "NO_KEY",
        {
            "en": {"item_one": "1 item", "item_other": "{count} items"},
            "ko": {"item_one": "1개"},
        },
    )

    assert len(issues) == 1
    assert issues[0].key == "item_other"


def test_dummy_key_does_not_call_an_unused_form_a_stray_key() -> None:
    assert (
        check(
            "DUMMY_KEY",
            {
                "ko": {"item_other": "{count}개"},
                "ru": {"item_other": "{count}", "item_few": "{count} элемента"},
            },
        )
        == []
    )


def test_no_key_leaves_a_language_with_no_table_exactly_as_it_was() -> None:
    issues = check(
        "NO_KEY",
        {
            "en": {"item_one": "1 item", "item_other": "{count} items"},
            "mt": {"item_one": "1 oggett"},
        },
    )

    assert len(issues) == 1
    assert issues[0].key == "item_other"


def test_the_plural_primitives_read_the_form_a_suffixed_key_names() -> None:
    assert plural_parts_of("item_one") == ("item", "one")
    assert plural_parts_of("item") is None
    assert plural_parts_of("item_plural") is None
    assert plural_parts_of("_one") is None


def test_the_plural_primitives_read_the_base_of_either_convention() -> None:
    assert plural_base_of("item_one") == "item"
    assert plural_base_of("item_plural") == "item"
    assert plural_base_of("item") is None


def test_the_plural_primitives_know_what_each_language_needs() -> None:
    assert plural_categories_of("ko") == ("other",)
    assert plural_categories_of("en-GB") == ("one", "other")
    assert plural_categories_of("ru") == ("one", "few", "many", "other")
    assert plural_categories_of("mt") is None


KEY_NAMES: dict[str, dict[str, Any]] = {"en": {"attr-folder": "A", "badKey_Name": "B"}}


def test_key_naming_reports_nothing_until_key_case_says_what_is_used() -> None:
    assert check("KEY_NAMING", KEY_NAMES) == []


def test_key_naming_finds_the_key_not_written_in_the_chosen_case() -> None:
    issues = check("KEY_NAMING", KEY_NAMES, key_case="kebab")

    assert len(issues) == 1
    assert issues[0].key == "badKey_Name"
    assert issues[0].locale == ""


def test_key_naming_judges_every_level_of_a_nested_key() -> None:
    issues = check("KEY_NAMING", {"en": {"attr.badName": "A"}}, key_case="kebab")

    assert len(issues) == 1
    assert "`badName`" in issues[0].message


def test_key_naming_accepts_the_plural_suffix_a_library_appends() -> None:
    assert check("KEY_NAMING", {"en": {"item-count_one": "A"}}, key_case="kebab") == []


def test_key_naming_reports_a_key_once_however_many_parts_are_wrong() -> None:
    assert len(check("KEY_NAMING", {"en": {"Bad.Worse": "A"}}, key_case="kebab")) == 1


def test_key_naming_accepts_camel_case_when_that_is_what_was_asked_for() -> None:
    assert check("KEY_NAMING", {"en": {"attrFolder": "A"}}, key_case="camel") == []


def test_key_depth_reports_nothing_until_max_key_depth_says_how_deep() -> None:
    assert check("KEY_DEPTH", {"en": {"a.b.c.d": "A"}}) == []


def test_key_depth_finds_the_key_nested_past_the_limit() -> None:
    issues = check("KEY_DEPTH", {"en": {"a.b.c.d": "A", "a.b": "B"}}, max_key_depth=2)

    assert len(issues) == 1
    assert issues[0].key == "a.b.c.d"
    assert "4 levels deep" in issues[0].message


def test_check_entry_answers_the_checks_a_single_key_can_answer() -> None:
    issues = create_analyzer(Options(target="en", key_case="kebab", max_key_depth=1)).check_entry(
        Entry(key="badName", values={"en": "{a} and {a}", "ko": "{a}"})
    )
    codes = [issue.code for issue in issues]

    assert "KEY_NAMING" in codes
    assert "INTERPOLATION_COUNT" in codes


def test_the_value_primitives_read_markup_tags_as_they_were_written() -> None:
    assert extract_tags("a <b>c</b> <br/>") == ["<b>", "</b>", "<br/>"]
    assert extract_tags("no markup here") == []


def test_the_value_primitives_keep_a_padded_number_apart_from_a_bare_one() -> None:
    assert extract_numbers("Step 03 of 5") == ["03", "5"]


def test_the_value_primitives_find_the_first_undrawn_character() -> None:
    assert find_invisible_character(f"ab{ZERO_WIDTH_SPACE}c") == ZERO_WIDTH_SPACE
    assert find_invisible_character("plain") is None


def test_the_value_primitives_know_which_script_a_language_uses() -> None:
    korean = script_of_locale("ko")
    japanese = script_of_locale("ja-JP")

    assert korean is not None and korean.search("가")
    assert japanese is not None and japanese.search("あ")
    assert script_of_locale("en") is None
    assert script_of_locale("sr-Latn") is None


def test_the_value_primitives_do_not_count_a_placeholder_as_a_word() -> None:
    assert has_translatable_text("{name}", "{", "}") is False
    assert has_translatable_text("<br/>", "{", "}") is False
    assert has_translatable_text("Hi {name}", "{", "}") is True
