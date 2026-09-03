"""What a session holds, and what it reports after an edit."""

from __future__ import annotations

import copy
from typing import Any

from chki18n import Input, Options, TranslationGroups, create_session, load_translations


def sample_path(name: str) -> str:
    return f"tests/samples/{name}"


GROUPS: TranslationGroups = {
    "common.json": {"en": {"ok": "OK"}, "ko": {"ok": "확인"}},
    "errors.json": {"en": {"failed": "Failed"}, "ko": {}},
}


def sample_groups() -> dict[str, dict[str, dict[str, Any]]]:
    return copy.deepcopy(GROUPS)


def test_scans_once_and_holds_what_it_read() -> None:
    session = load_translations(sample_path("locales-all-issues"), Options(target="en"))

    assert sorted(session.locales) == ["en", "ko"]
    assert session.groups == [""]
    assert session.file_format == "single"
    assert len(session.files) == 2
    assert session.get("en", "greeting") == "Hello {name}"


def test_flattens_on_load_so_keys_are_read_in_their_dotted_form() -> None:
    session = load_translations(sample_path("locales-no-issue"), Options(target="en"))

    assert session.get("ko", "attr.folder") == "폴더"
    keys = session.keys()

    assert "desc.hello" in keys


def test_analyses_without_reading_the_files_again() -> None:
    session = load_translations(sample_path("locales-all-issues"), Options(target="en"))
    first = session.analyze()
    second = session.analyze()

    assert first.success is False
    assert len(first.issues) == len(second.issues)
    assert first.file_format == "single"


def test_re_checks_only_the_edited_key_and_reports_the_new_state() -> None:
    session = load_translations(sample_path("locales-all-issues"), Options(target="en"))

    assert [issue.code for issue in session.check_key("greeting")] == ["NO_INTERPOLATION_KEY"]
    assert session.set("ko", "greeting", "{name}님 안녕하세요") == []
    assert session.get("ko", "greeting") == "{name}님 안녕하세요"


def test_carries_an_edit_into_the_next_full_analysis() -> None:
    session = load_translations(sample_path("locales-issue-no-key"), Options(target="en"))

    assert len(session.analyze().of("NO_KEY")) == 1

    session.set("ko", "attr.folder", "폴더")

    assert "NO_KEY" not in session.analyze().issues_by_code


def test_drops_a_key_from_one_locale_or_from_all_of_them() -> None:
    session = load_translations(sample_path("locales-no-issue"), Options(target="en"))

    assert [issue.code for issue in session.remove("attr.folder", locale="ko")] == ["NO_KEY"]

    session.remove("attr.folder")

    assert session.get("en", "attr.folder") is None
    assert session.check_key("attr.folder") == []


def test_reload_throws_away_the_edits_and_reads_the_directory_again() -> None:
    session = load_translations(sample_path("locales-no-issue"), Options(target="en"))

    session.set("ko", "attr.folder", "edited")
    assert session.get("ko", "attr.folder") == "edited"

    session.reload()

    assert session.get("ko", "attr.folder") == "폴더"


def test_reports_a_missing_path_instead_of_raising() -> None:
    session = load_translations()

    assert session.path == ""
    assert session.analyze().success is False
    assert session.analyze().issues[0].code == "INVALID_OPTIONS"


def test_create_session_takes_translations_that_are_already_in_memory() -> None:
    session = create_session(Input(groups=sample_groups()), Options(target="en"))

    assert session.groups == ["common.json", "errors.json"]
    assert len(session.analyze().of("NO_KEY")) == 1


def test_create_session_finds_the_group_a_key_lives_in() -> None:
    session = create_session(Input(groups=sample_groups()), Options(target="en"))

    assert session.get("ko", "ok") == "확인"
    assert session.get("en", "failed") == "Failed"
    assert session.check_key("failed")[0].group == "errors.json"


def test_create_session_writes_into_the_named_group() -> None:
    session = create_session(Input(groups=sample_groups()), Options(target="en"))

    session.set("ko", "failed", "실패")

    assert session.get("ko", "failed") == "실패"
    assert session.translations("errors.json")["ko"]["failed"] == "실패"
    assert "NO_KEY" not in session.analyze().issues_by_code


def test_create_session_adds_a_locale_that_was_not_there_before() -> None:
    session = create_session(Input(groups=sample_groups()), Options(target="en"))

    session.set("ja", "ok", "OK", "common.json")

    assert "ja" in session.locales
    assert session.check_key("ok", "common.json")[0].code == "NOT_TRANSLATED_VALUE"


def test_create_session_reset_replaces_the_data_but_keeps_the_options() -> None:
    session = create_session(Input(groups=sample_groups()), Options(target="ko"))

    session.reset(Input(locales={"ko": {"a": "가"}, "en": {"a": "가"}}))

    assert session.groups == [""]
    assert session.options.target == "ko"
    assert len(session.analyze().of("NOT_TRANSLATED_VALUE")) == 1
