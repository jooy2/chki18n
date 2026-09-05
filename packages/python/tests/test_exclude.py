"""What a scan does not look at: directories by path, and files by name."""

from __future__ import annotations

from typing import Any

from chki18n import (
    DEFAULT_EXCLUDE_FILES,
    Options,
    ScanResult,
    create_file_excluder,
    create_path_excluder,
    find_unused_keys,
    matches_name_pattern,
    path_segments,
    resolve_options,
    scan_translation_directory,
)

SAMPLE_PATH = "tests/samples/excluded-files"


def scan(**options: Any) -> ScanResult:
    resolved, _ = resolve_options(Options(target="en", **options))

    return scan_translation_directory(SAMPLE_PATH, resolved)


def test_path_segments_reads_a_path_written_either_way() -> None:
    assert path_segments("src/legacy") == ["src", "legacy"]
    assert path_segments("src\\legacy") == ["src", "legacy"]


def test_path_segments_drops_what_carries_no_meaning() -> None:
    assert path_segments("./src//legacy/") == ["src", "legacy"]
    assert path_segments("") == []


def test_matches_a_name_with_no_wildcard_exactly() -> None:
    assert matches_name_pattern("package.json", "package.json")
    assert not matches_name_pattern("my-package.json", "package.json")


def test_lets_a_star_stand_for_any_run_of_characters() -> None:
    assert matches_name_pattern("pnpm-lock.json", "*-lock.json")
    assert matches_name_pattern("tsconfig.build.json", "tsconfig.*.json")
    assert not matches_name_pattern("tsconfig.json", "tsconfig.*.json")


def test_ignores_case_the_way_the_file_systems_do() -> None:
    assert matches_name_pattern("Package.json", "package.json")


def test_does_not_let_the_ends_of_a_pattern_claim_the_same_characters() -> None:
    assert matches_name_pattern("ab", "a*b")
    assert not matches_name_pattern("ab", "a*b*b")


def test_one_segment_is_a_name_at_any_depth() -> None:
    excluded = create_path_excluder(["node_modules"])

    assert excluded(["node_modules"])
    assert excluded(["src", "node_modules"])
    assert not excluded(["src"])


def test_two_segments_are_a_path_from_the_root() -> None:
    excluded = create_path_excluder(["src/legacy"])

    assert excluded(["src", "legacy"])
    assert excluded(["src", "legacy", "ui"])
    assert not excluded(["legacy"])
    assert not excluded(["app", "src", "legacy"])


def test_the_default_file_list_answers_for_a_configuration_file() -> None:
    excluded = create_file_excluder(DEFAULT_EXCLUDE_FILES)

    assert excluded("package-lock.json")
    assert excluded("tsconfig.base.json")
    assert excluded("vite.config.json")
    assert not excluded("en.json")
    assert not excluded("common.json")


def test_leaves_a_configuration_file_out_of_the_scan_entirely() -> None:
    result = scan()

    assert sorted(result.groups) == ["admin/common.json", "common.json"]
    # Not merely skipped: an excluded file is never read, which is the point.
    assert result.skipped == []
    assert result.issues == []


def test_reads_what_it_was_told_to_instead_of_the_default_list() -> None:
    result = scan(exclude_files="nothing-matches-this")

    assert "en/app.config.json" in [file.relative_path for file in result.files]
    assert result.skipped == ["package-lock.json", "tsconfig.json"]


def test_exclude_files_is_reported_on_the_resolved_options() -> None:
    options, _ = resolve_options(Options(exclude_files="*.tmp.json, notes.json"))

    assert options.exclude_files == frozenset({"*.tmp.json", "notes.json"})


def test_skips_one_directory_named_by_its_path() -> None:
    result = scan(exclude=["admin/ko"])

    assert [file.relative_path for file in result.files] == [
        "admin/en/common.json",
        "en/common.json",
        "ko/common.json",
    ]


def test_still_skips_a_bare_name_wherever_it_appears() -> None:
    result = scan(exclude=["ko"])

    assert [file.relative_path for file in result.files] == [
        "admin/en/common.json",
        "en/common.json",
    ]


def test_the_excludes_apply_to_the_source_scan_as_well() -> None:
    # A key nothing holds, so the walk cannot stop early and the count is the
    # number of files the excludes actually left it.
    def read_of(exclude: list[str]) -> int:
        options, _ = resolve_options(Options(target="en", exclude=exclude))

        return find_unused_keys(SAMPLE_PATH, ["nothing.at.all"], options).scanned_file_count

    # Four translation files; the lock file, the `tsconfig.json` and the
    # `app.config.json` are excluded by name.
    assert read_of(["node_modules"]) == 4
    assert read_of(["node_modules", "admin/ko"]) == 3
    assert read_of(["node_modules", "ko"]) == 2
