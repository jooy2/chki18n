"""Keys the scanned source asks for that no language file defines."""

from __future__ import annotations

from typing import Any

from chki18n import (
    Input,
    KeyUsage,
    Options,
    UsageScan,
    analyze_translations,
    check_translation_files,
    find_unused_keys,
    resolve_options,
)

LOCALES_PATH = "tests/samples/undefined-key/locales"

SOURCE_PATH = "tests/samples/undefined-key/src"

KEYS = ["desc.hello", "attr.folder", "item_one", "item_other"]


def scan(**options: Any) -> UsageScan:
    resolved, _ = resolve_options(Options(target="en", **options))

    return find_unused_keys(SOURCE_PATH, KEYS, resolved)


def test_reports_a_key_no_language_file_defines() -> None:
    found = scan()

    assert [usage.key for usage in found.undefined_keys] == ["attr.missing"]
    assert found.undefined_keys[0].file is not None
    assert found.undefined_keys[0].file.endswith("app.ts")


def test_reads_a_key_through_the_namespace_written_in_front_of_it() -> None:
    # `t('common:desc.hello')` names a namespace and a key that does exist.
    assert not any("common" in usage.key for usage in scan().undefined_keys)


def test_leaves_a_key_built_at_run_time_alone() -> None:
    assert not any(usage.key.startswith("error.") for usage in scan().undefined_keys)


def test_counts_a_key_reached_through_a_prefix_as_defined() -> None:
    # `t('folder')` resolves to `attr.folder` through a bound prefix.
    assert not any(usage.key == "folder" for usage in scan().undefined_keys)


def test_counts_a_plural_key_asked_for_by_its_base_as_defined() -> None:
    found = scan()

    # The source writes `t('item')`; the runtime picks `item_one`.
    assert not any(usage.key == "item" for usage in found.undefined_keys)
    assert found.unused_keys == []


def test_reads_the_call_names_the_project_actually_uses() -> None:
    assert scan(translate_functions=["nothing"]).undefined_keys == []


def test_does_the_work_only_for_the_check_that_needs_it() -> None:
    assert scan(ignore_checks=["UNDEFINED_KEY"]).undefined_keys == []


def test_reports_what_the_source_asks_for_and_the_files_do_not_have() -> None:
    result = check_translation_files(
        LOCALES_PATH,
        Options(target="en", source=SOURCE_PATH, checks=["UNDEFINED_KEY"]),
    )

    assert len(result.of("UNDEFINED_KEY")) == 1
    assert result.of("UNDEFINED_KEY")[0].key == "attr.missing"
    # Not a locale's fault: no language file defines it.
    assert result.of("UNDEFINED_KEY")[0].locale == ""


def test_reports_nothing_without_a_source_directory_to_read() -> None:
    result = check_translation_files(LOCALES_PATH, Options(target="en", checks=["UNDEFINED_KEY"]))

    assert result.issues == []


def test_accepts_an_answer_worked_out_elsewhere() -> None:
    result = analyze_translations(
        Input(
            locales={"en": {"a": "A"}},
            undefined_keys=[KeyUsage(key="b.c", file="app.ts")],
        ),
        Options(target="en", checks=["UNDEFINED_KEY"]),
    )

    assert result.of("UNDEFINED_KEY")[0].key == "b.c"
    assert result.of("UNDEFINED_KEY")[0].file == "app.ts"


def test_never_fails_a_run_on_its_own() -> None:
    result = check_translation_files(
        LOCALES_PATH,
        Options(target="en", source=SOURCE_PATH, checks=["UNDEFINED_KEY"]),
    )

    assert result.success is True
    assert result.summary.warn == 1
