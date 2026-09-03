"""What `check_translation_files` reports over a directory of sample files."""

from __future__ import annotations

from chki18n import Options, check_translation_files


def sample_path(name: str) -> str:
    return f"tests/samples/{name}"


def test_passes_a_directory_with_no_critical_issue() -> None:
    result = check_translation_files(sample_path("locales-no-issue"))

    assert result.success is True
    assert result.summary.error == 0
    assert result.file_format == "single"
    assert sorted(result.locales) == ["en", "ko"]
    assert len(result.files) == 2


def test_reports_a_key_the_target_has_and_another_locale_does_not() -> None:
    result = check_translation_files(sample_path("locales-issue-no-key"))

    assert result.success is False
    assert len(result.of("NO_KEY")) == 1

    issue = result.of("NO_KEY")[0]

    assert issue.locale == "ko"
    assert issue.key == "attr.folder"
    assert issue.target_value == "Folder"
    assert issue.level == "error"
    assert issue.file is not None
    assert issue.file.endswith("ko.json")


def test_compares_a_folder_per_locale_layout() -> None:
    result = check_translation_files(sample_path("multiple-translate-files"))

    assert result.success is True
    assert result.file_format == "folder"
    assert result.groups == ["common.json"]


def test_compares_a_single_file_holding_every_locale() -> None:
    result = check_translation_files(sample_path("locales-nested"))

    assert result.file_format == "nested"
    assert result.groups == ["translation.json"]
    assert len(result.of("NO_KEY")) == 1
    assert result.of("NO_KEY")[0].key == "desc.bye"


def test_reports_every_comparison_check() -> None:
    result = check_translation_files(sample_path("locales-all-issues"))

    assert result.success is False

    for code in (
        "NO_KEY",
        "DUMMY_KEY",
        "EMPTY_VALUE",
        "NO_INTERPOLATION_KEY",
        "EXTRA_INTERPOLATION_KEY",
        "NOT_TRANSLATED_VALUE",
        "DUPLICATE_VALUE",
        "SURROUNDING_WHITESPACE",
        "MISSING_NUMBER",
        "INVALID_VALUE_TYPE",
    ):
        assert code in result.issues_by_code, f"{code} was not reported"


def test_summarizes_issues_by_level_locale_and_code() -> None:
    result = check_translation_files(sample_path("locales-all-issues"))

    assert result.summary.total == len(result.issues)
    assert result.summary.error + result.summary.warn + result.summary.info == result.summary.total
    assert result.summary.by_code["NO_KEY"] == 1
    assert result.summary.by_locale["ko"].error > 0


def test_fails_when_no_path_is_given() -> None:
    result = check_translation_files()

    assert result.success is False
    assert result.issues[0].code == "INVALID_OPTIONS"
    assert result.issues[0].level == "error"


def test_fails_when_the_target_language_is_not_among_the_files() -> None:
    result = check_translation_files(sample_path("locales-no-issue"), Options(target="ja"))

    assert result.success is False
    assert result.of("INVALID_OPTIONS")[0].level == "error"


def test_fails_when_a_forced_format_matches_no_file() -> None:
    result = check_translation_files(sample_path("locales-no-issue"), Options(format="folder"))

    assert result.success is False
    assert len(result.of("INVALID_FILE")) == 1


def test_fails_when_the_directory_does_not_exist() -> None:
    result = check_translation_files(sample_path("does-not-exist"))

    assert result.success is False
    assert result.of("INVALID_FILE")


def test_only_runs_the_checks_it_was_asked_for() -> None:
    result = check_translation_files(
        sample_path("locales-all-issues"),
        Options(target="en", checks=["NO_KEY"]),
    )

    assert list(result.issues_by_code) == ["NO_KEY"]
