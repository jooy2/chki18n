"""Keys nothing in a scanned source tree refers to."""

from __future__ import annotations

import os

from chki18n import (
    Input,
    Options,
    analyze_translations,
    check_translation_files,
    find_unused_keys,
    leaf_of_key,
    load_translations,
    resolve_options,
)

LOCALES_PATH = "tests/samples/unused-key/locales"

SOURCE_PATH = "tests/samples/unused-key/src"


def test_leaf_of_key_takes_the_last_segment() -> None:
    assert leaf_of_key("desc.hello") == "hello"
    assert leaf_of_key("hello") == "hello"
    assert leaf_of_key("") == ""


def test_leaf_of_key_takes_the_plural_suffix_off() -> None:
    assert leaf_of_key("desc.item_one") == "item"
    assert leaf_of_key("item_plural") == "item"


def test_finds_the_key_no_source_file_mentions() -> None:
    options, _ = resolve_options(Options(target="en"))
    scan = find_unused_keys(SOURCE_PATH, ["desc.hello", "desc.orphan", "attr.folder"], options)

    assert scan.unused_keys == ["desc.orphan"]
    assert scan.scanned_file_count == 1


def test_counts_a_key_referenced_by_its_leaf_alone_as_used() -> None:
    options, _ = resolve_options(Options(target="en"))
    # The source calls `t('folder')`, not `t('attr.folder')`.
    scan = find_unused_keys(SOURCE_PATH, ["attr.folder"], options)

    assert scan.unused_keys == []


def test_reports_every_key_that_shares_an_unreferenced_leaf() -> None:
    options, _ = resolve_options(Options(target="en"))
    scan = find_unused_keys(SOURCE_PATH, ["a.orphan", "b.orphan"], options)

    assert sorted(scan.unused_keys) == ["a.orphan", "b.orphan"]


def test_does_not_read_the_files_it_was_told_to_skip() -> None:
    options, _ = resolve_options(Options(target="en"))
    scan = find_unused_keys(
        SOURCE_PATH,
        ["desc.hello"],
        options,
        skip_files=[os.path.abspath(os.path.join(SOURCE_PATH, "app.ts"))],
    )

    assert scan.unused_keys == ["desc.hello"]
    assert scan.scanned_file_count == 0


def test_returns_nothing_rather_than_failing_on_a_missing_directory() -> None:
    options, _ = resolve_options(Options(target="en"))
    scan = find_unused_keys(os.path.join(SOURCE_PATH, "nope"), ["a"], options)

    assert scan.unused_keys == ["a"]
    assert scan.scanned_file_count == 0


def test_reports_a_key_nothing_in_the_source_refers_to() -> None:
    result = check_translation_files(LOCALES_PATH, Options(target="en", source=SOURCE_PATH))
    issues = result.of("UNUSED_KEY")

    assert len(issues) == 1
    assert issues[0].key == "desc.orphan"
    assert issues[0].level == "info"
    # A fact about the source tree, not about one language's translation.
    assert issues[0].locale == ""


def test_never_fails_a_run_on_its_own() -> None:
    result = check_translation_files(LOCALES_PATH, Options(target="en", source=SOURCE_PATH))

    assert result.success is True
    assert result.summary.info > 0


def test_reports_nothing_without_a_source_directory() -> None:
    result = check_translation_files(LOCALES_PATH, Options(target="en"))

    assert "UNUSED_KEY" not in result.issues_by_code


def test_does_not_count_the_translation_files_themselves_as_usages() -> None:
    # Every key appears verbatim in the file that defines it, so a scan that read
    # them would report nothing at all.
    result = check_translation_files(
        LOCALES_PATH, Options(target="en", source="tests/samples/unused-key")
    )

    assert len(result.of("UNUSED_KEY")) == 1


def test_accepts_an_answer_worked_out_elsewhere() -> None:
    result = analyze_translations(
        Input(
            locales={"en": {"a": "A", "b": "B"}, "ko": {"a": "ㄱ", "b": "ㄴ"}},
            unused_keys=["b"],
        ),
        Options(target="en"),
    )

    assert len(result.of("UNUSED_KEY")) == 1
    assert result.of("UNUSED_KEY")[0].key == "b"


def test_survives_a_session_reload() -> None:
    session = load_translations(LOCALES_PATH, Options(target="en", source=SOURCE_PATH))

    assert len(session.analyze().of("UNUSED_KEY")) == 1

    session.reload()

    assert len(session.analyze().of("UNUSED_KEY")) == 1


def test_can_be_switched_off_like_any_other_check() -> None:
    result = check_translation_files(
        LOCALES_PATH,
        Options(target="en", source=SOURCE_PATH, ignore_checks="UNUSED_KEY"),
    )

    assert "UNUSED_KEY" not in result.issues_by_code
