"""What `analyze_translations` and `Analyzer.check_entry` report over values in memory."""

from __future__ import annotations

from typing import Any

from chki18n import Entry, Input, Options, analyze_translations, create_analyzer


def test_flattens_nested_translations_before_comparing_them() -> None:
    result = analyze_translations(
        Input(
            locales={
                "en": {"desc": {"hello": "Hello", "bye": "Goodbye"}},
                "ko": {"desc": {"hello": "안녕하세요"}},
            }
        ),
        Options(target="en"),
    )

    assert result.key_count == 2
    assert result.success is False
    assert result.of("NO_KEY")[0].key == "desc.bye"


def test_uses_already_flattened_translations_as_they_are() -> None:
    result = analyze_translations(
        Input(locales={"en": {"a.b": "Hi"}, "ko": {"a.b": ""}}),
        Options(target="en", flattened=True),
    )

    assert result.key_count == 1
    assert len(result.of("EMPTY_VALUE")) == 1


def test_does_no_file_system_work_so_it_reports_no_files() -> None:
    result = analyze_translations(
        Input(locales={"en": {"a": "A"}, "ko": {"a": "ㄱ"}}),
        Options(target="en"),
    )

    assert result.files == []
    assert result.file_format is None


def test_compares_each_group_on_its_own() -> None:
    result = analyze_translations(
        Input(
            groups={
                "common.json": {"en": {"a": "A"}, "ko": {"a": "ㄱ"}},
                "errors.json": {"en": {"b": "B"}, "ko": {}},
            }
        ),
        Options(target="en"),
    )

    assert result.groups == ["common.json", "errors.json"]
    assert len(result.of("NO_KEY")) == 1
    assert result.of("NO_KEY")[0].group == "errors.json"


def test_honours_custom_interpolation_delimiters() -> None:
    data = Input(locales={"en": {"a": "Hello {{name}}"}, "ko": {"a": "안녕하세요"}})

    assert (
        len(
            analyze_translations(
                data,
                Options(target="en", interpolation_prefix="{{", interpolation_suffix="}}"),
            ).of("NO_INTERPOLATION_KEY")
        )
        == 1
    )

    # The default single-brace delimiters do not recognise `{{name}}`, so the
    # missing placeholder goes unnoticed.
    assert (
        "NO_INTERPOLATION_KEY"
        not in analyze_translations(data, Options(target="en")).issues_by_code
    )


def test_skips_the_checks_named_by_ignore_checks() -> None:
    data = Input(locales={"en": {"a": "Same"}, "ko": {"a": "Same"}})

    assert len(analyze_translations(data, Options(target="en")).of("NOT_TRANSLATED_VALUE")) == 1
    assert (
        "NOT_TRANSLATED_VALUE"
        not in analyze_translations(
            data, Options(target="en", ignore_checks="NOT_TRANSLATED_VALUE")
        ).issues_by_code
    )


def test_reports_an_unusable_locale_as_an_invalid_file() -> None:
    result = analyze_translations(
        Input(locales={"en": {"a": "A"}, "ko": None}),  # type: ignore[dict-item]
        Options(target="en"),
    )

    assert len(result.of("INVALID_FILE")) == 1


def test_check_entry_checks_a_single_key_across_locales() -> None:
    issues = create_analyzer(Options(target="en")).check_entry(
        Entry(key="greeting", values={"en": "Hello {name}", "ko": "안녕하세요"})
    )

    assert len(issues) == 1
    assert issues[0].code == "NO_INTERPOLATION_KEY"
    assert issues[0].interpolation == "name"
    assert issues[0].key == "greeting"


def test_check_entry_returns_nothing_for_a_key_with_no_problem() -> None:
    assert (
        create_analyzer(Options(target="en")).check_entry(
            Entry(key="a", values={"en": "Hello", "ko": "안녕"})
        )
        == []
    )


def test_check_entry_reports_a_missing_locale_when_told_which_exist() -> None:
    issues = create_analyzer(Options(target="en")).check_entry(
        Entry(key="a", values={"en": "Hello"}, locales=["en", "ko"])
    )

    assert len(issues) == 1
    assert issues[0].code == "NO_KEY"
    assert issues[0].locale == "ko"


def test_check_entry_never_reports_checks_that_need_more_than_one_key() -> None:
    issues = create_analyzer(Options(target="en")).check_entry(
        Entry(key="a", values={"en": "Same", "ko": "Same"})
    )

    assert all(issue.code != "DUPLICATE_VALUE" for issue in issues)


def test_check_entry_carries_the_group_through_to_the_issue() -> None:
    issues = create_analyzer(Options(target="en")).check_entry(
        Entry(key="a", values={"en": "Hello", "ko": ""}, group="common.json")
    )

    assert issues[0].group == "common.json"


def test_check_entry_agrees_with_a_full_analysis_of_the_same_data() -> None:
    locales: dict[str, dict[str, Any]] = {
        "en": {"a": "Hello {name}", "b": "Bye"},
        "ko": {"a": "안녕하세요", "b": ""},
    }
    analyzer = create_analyzer(Options(target="en"))
    analyzed = analyze_translations(Input(locales=locales), Options(target="en", flattened=True))
    incremental = [
        issue
        for key in locales["en"]
        for issue in analyzer.check_entry(
            Entry(key=key, values={"en": locales["en"][key], "ko": locales["ko"][key]})
        )
    ]

    assert [f"{issue.code}:{issue.key}" for issue in incremental] == [
        f"{issue.code}:{issue.key}" for issue in analyzed.issues
    ]


def test_level_overrides_change_whether_the_run_passes() -> None:
    data = Input(locales={"en": {"a": "Hello"}, "ko": {"a": ""}})

    assert analyze_translations(data, Options(target="en")).success is True
    assert (
        analyze_translations(data, Options(target="en", levels={"EMPTY_VALUE": "error"})).success
        is False
    )


def test_level_overrides_accept_the_cli_form() -> None:
    result = analyze_translations(
        Input(locales={"en": {"a": "Hello"}, "ko": {"a": ""}}),
        Options(target="en", levels="EMPTY_VALUE=error"),
    )

    assert result.of("EMPTY_VALUE")[0].level == "error"


def test_level_overrides_apply_to_a_single_key_check_as_well() -> None:
    analyzer = create_analyzer(Options(target="en", levels={"EMPTY_VALUE": "info"}))

    assert analyzer.check_entry(Entry(key="a", values={"en": "Hello", "ko": ""}))[0].level == (
        "info"
    )


def test_level_overrides_refuse_a_check_that_reports_how_the_run_went() -> None:
    analyzer = create_analyzer(Options(levels={"INVALID_FILE": "info"}))

    assert analyzer.options.levels is None
    assert any("INVALID_FILE" in issue.message for issue in analyzer.option_issues)
