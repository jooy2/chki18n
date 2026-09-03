"""A key defined twice, both in the text and after flattening."""

from __future__ import annotations

from chki18n import (
    Entry,
    Input,
    JsonDuplicateKey,
    Options,
    analyze_translations,
    check_translation_files,
    create_analyzer,
    find_duplicate_json_keys,
    find_duplicate_keys,
    flatten_translations,
)


def sample_path(name: str) -> str:
    return f"tests/samples/{name}"


def test_finds_a_nested_key_colliding_with_a_dotted_one() -> None:
    assert find_duplicate_keys({"a": {"b": 1}, "a.b": 2}) == ["a.b"]


def test_finds_an_array_index_colliding_with_a_dotted_key() -> None:
    assert find_duplicate_keys({"a": ["x"], "a.0": "y"}) == ["a.0"]


def test_says_nothing_about_translations_that_collide_with_nothing() -> None:
    assert find_duplicate_keys({"a": {"b": 1}, "c": 2}) == []
    assert find_duplicate_keys({"a": {}, "b": []}) == []


def test_treats_an_empty_object_as_a_leaf_the_way_flattening_does() -> None:
    assert find_duplicate_keys({"a": {"b": {}}, "a.b": 1}) == ["a.b"]


def test_flatten_joins_every_level_and_keeps_an_empty_branch_as_a_leaf() -> None:
    assert flatten_translations({"a": {"b": 1}, "c": ["x", "y"], "d": {}}) == {
        "a.b": 1,
        "c.0": "x",
        "c.1": "y",
        "d": {},
    }


def test_finds_a_key_written_twice_in_one_object() -> None:
    assert find_duplicate_json_keys('{"a": 1, "a": 2}') == [JsonDuplicateKey("a", 1)]


def test_reports_the_line_the_second_definition_is_on() -> None:
    assert find_duplicate_json_keys('{\n  "a": 1,\n\n  "a": 2\n}')[0].line == 4


def test_reports_the_path_of_a_nested_duplicate() -> None:
    assert find_duplicate_json_keys('{"x": {"a": 1, "a": 2}}') == [JsonDuplicateKey("x.a", 1)]


def test_does_not_confuse_the_same_key_in_two_different_objects() -> None:
    assert find_duplicate_json_keys('{"x": {"a": 1}, "y": {"a": 2}}') == []


def test_ignores_strings_that_only_look_like_keys() -> None:
    assert find_duplicate_json_keys('{"a": "b", "b": "b"}') == []
    assert find_duplicate_json_keys('{"a": ["k", "k"]}') == []


def test_reads_escaped_quotes_as_part_of_the_string() -> None:
    assert find_duplicate_json_keys(r'{"a\"b": 1, "c": 2}') == []
    assert len(find_duplicate_json_keys(r'{"a\"b": 1, "a\"b": 2}')) == 1


def test_reports_both_a_literal_duplicate_and_a_flatten_collision() -> None:
    result = check_translation_files(sample_path("locales-duplicate-key"), Options(target="en"))
    issues = result.of("DUPLICATE_KEY")

    assert result.success is False
    assert sorted(issue.key for issue in issues) == ["attr.folder", "desc.hello"]
    assert issues[0].level == "error"
    assert issues[0].locale == "en"
    assert any("line 4" in issue.message for issue in issues)


def test_strips_the_locale_prefix_in_a_nested_file() -> None:
    result = check_translation_files(sample_path("locales-nested-duplicate"), Options(target="en"))
    issue = result.of("DUPLICATE_KEY")[0]

    assert issue.key == "greeting"
    assert issue.locale == "en"


def test_finds_a_collision_in_translations_passed_in_directly() -> None:
    result = analyze_translations(
        Input(locales={"en": {"a": {"b": "x"}, "a.b": "y"}, "ko": {"a.b": "ㄱ"}}),
        Options(target="en"),
    )

    assert result.of("DUPLICATE_KEY")[0].key == "a.b"


def test_has_nothing_to_find_in_input_that_is_already_flattened() -> None:
    result = analyze_translations(
        Input(locales={"en": {"a.b": "x"}, "ko": {"a.b": "ㄱ"}}),
        Options(target="en", flattened=True),
    )

    assert "DUPLICATE_KEY" not in result.issues_by_code


def test_is_never_reported_by_check_entry_which_sees_one_key() -> None:
    issues = create_analyzer(Options(target="en")).check_entry(
        Entry(key="a.b", values={"en": "x", "ko": "ㄱ"})
    )

    assert all(issue.code != "DUPLICATE_KEY" for issue in issues)


def test_can_be_switched_off_like_any_other_check() -> None:
    result = check_translation_files(
        sample_path("locales-duplicate-key"),
        Options(target="en", ignore_checks="DUPLICATE_KEY"),
    )

    assert "DUPLICATE_KEY" not in result.issues_by_code
    assert result.success is True
