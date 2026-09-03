"""What each reporter writes, and what the report options do to it."""

from __future__ import annotations

import json
import os
import re
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest

from chki18n import (
    DEFAULT_GROUP_BY,
    DEFAULT_REPORTER,
    Issue,
    Options,
    ReportInit,
    Result,
    build_result,
    check_translation_files,
    display_width,
    format_result,
    group_issues,
    pad_to,
    reporter_of_file_name,
    resolve_options,
    truncate,
)

ANSI = re.compile("\x1b\\[")


def sample_path(name: str) -> str:
    return f"tests/samples/{name}"


@pytest.fixture
def output_dir(tmp_path: Path) -> Iterator[Path]:
    """Somewhere outside the project, so a failed run leaves nothing behind in it."""
    yield tmp_path


def analyze() -> Result:
    """The sample every reporter is measured against: one of nearly every check."""
    return check_translation_files(sample_path("locales-all-issues"), Options(target="en"))


def render(result: Result, **options: Any) -> str:
    width = options.pop("width", None)
    cwd = options.pop("cwd", "")
    resolved, _ = resolve_options(Options(target="en", color=False, **options))

    return format_result(result, resolved, ReportInit(width=width, cwd=cwd))


def test_defaults_to_a_grouped_coloured_report_and_no_file() -> None:
    options, _ = resolve_options()

    assert options.reporter == DEFAULT_REPORTER
    assert options.group_by == DEFAULT_GROUP_BY
    assert options.output is None
    assert options.output_reporter is None
    assert options.color is True


def test_falls_back_and_says_so_when_a_reporter_is_not_one_it_knows() -> None:
    options, issues = resolve_options(Options(reporter="fancy"))

    assert options.reporter == DEFAULT_REPORTER
    assert any("fancy" in issue.message for issue in issues)


def test_reads_a_reporter_name_whatever_its_case() -> None:
    options, _ = resolve_options(Options(reporter="JSON"))

    assert options.reporter == "json"


def test_takes_the_file_reporter_from_the_extension() -> None:
    assert reporter_of_file_name("report.json") == "json"
    assert reporter_of_file_name("report.md") == "markdown"
    assert reporter_of_file_name("report.txt") == DEFAULT_REPORTER
    assert reporter_of_file_name("report") == DEFAULT_REPORTER


def test_lets_an_explicit_reporter_override_what_the_extension_implies() -> None:
    options, _ = resolve_options(Options(output="report.json", reporter="list"))

    assert options.output_reporter == "list"


def test_uses_the_extension_when_no_reporter_was_named() -> None:
    options, _ = resolve_options(Options(output="report.md"))

    assert options.reporter == DEFAULT_REPORTER
    assert options.output_reporter == "markdown"


def test_reads_a_width_from_a_number_or_the_string_a_flag_gives_it() -> None:
    assert resolve_options(Options(width=80))[0].width == 80
    assert resolve_options(Options(width="80"))[0].width == 80


def test_measures_the_terminal_when_the_width_is_not_a_column_count() -> None:
    for value in ("abc", 0, -10):
        options, issues = resolve_options(Options(width=value))

        assert options.width is None
        assert any("not a usable `width`" in issue.message for issue in issues)


def test_leaves_the_width_unset_when_nothing_asked_for_one() -> None:
    assert resolve_options()[0].width is None


def test_renders_one_section_per_locale_by_default() -> None:
    report = render(analyze())

    assert " ko " in report
    assert "NO_KEY" in report
    assert "only-en" in report
    assert "FAIL" in report
    # The locale nothing is wrong with is still worth naming.
    assert "Clean: en" in report


def test_renders_one_section_per_check_when_asked_to() -> None:
    report = render(analyze(), group_by="code")

    assert " NO_KEY " in report
    assert "By locale" in report


def test_leaves_out_the_colours_when_they_are_turned_off() -> None:
    assert ANSI.search(render(analyze())) is None


def test_writes_one_line_per_issue_as_a_list() -> None:
    result = analyze()
    lines = [line for line in render(result, reporter="list").split("\n") if line.startswith("ko")]

    assert len(lines) == len(result.issues)
    assert "error" in lines[0]
    assert "NO_KEY" in lines[0]


def test_writes_a_table_per_section_as_markdown() -> None:
    report = render(analyze(), reporter="markdown")

    assert report.startswith("# Translation check")
    assert "## ko" in report
    assert "| Level | Check" in report


def test_pads_a_markdown_table_to_one_width() -> None:
    report = render(analyze(), reporter="markdown")
    rows = [line for line in report.split("\n") if line.startswith("|")]
    widths = {display_width(row) for row in rows}

    # The sample holds a Korean value, so equal widths here can only come from
    # counting columns rather than characters.
    assert any(re.search("[가-힣]", row) for row in rows)
    assert len(widths) == 1


def test_hands_back_the_whole_result_as_json_unfiltered() -> None:
    result = analyze()
    parsed = json.loads(render(result, reporter="json", warn=False))

    assert len(parsed["issues"]) == len(result.issues)
    assert parsed["summary"] == result.summary.to_json()


def test_drops_the_warnings_and_their_lines_with_them_on_no_warn() -> None:
    result = analyze()
    report = render(result, warn=False)

    assert "EMPTY_VALUE" not in report
    assert f"{result.summary.warn} issues not shown" in report
    assert "NO_KEY" in report


def test_leaves_out_the_heading_block_and_the_summary_on_no_info() -> None:
    report = render(analyze(), info=False)

    assert "Compared 11 keys" not in report
    assert "NO_KEY" in report


def test_lays_the_report_out_to_the_width_it_is_given() -> None:
    report = render(analyze(), width=60)
    rules = [line for line in report.split("\n") if "─" in line]

    assert rules

    for rule in rules:
        assert display_width(rule) == 60


def test_wraps_a_description_rather_than_cutting_it_short() -> None:
    report = render(analyze(), width=56)

    assert "The key exists in the target language but is" in report
    assert "..." not in report


def test_says_so_rather_than_printing_nothing_when_a_run_is_clean() -> None:
    result = check_translation_files(sample_path("multiple-translate-files"), Options(target="en"))

    assert "PASS" in render(result)


def awkward() -> Result:
    """One issue, so a property can carry the characters a command breaks on."""
    options, _ = resolve_options(Options(target="en"))

    return build_result(
        [
            Issue(
                code="NO_KEY",
                level="error",
                locale="ko",
                key="attr.folder",
                group="",
                target_value="Folder",
                file="/repo/lo,cales/ko.json",
                message="Missing: here, and there.",
            )
        ],
        options,
        locales=["en", "ko"],
        groups=[""],
        key_count=1,
    )


def test_writes_one_workflow_command_per_issue() -> None:
    result = analyze()
    report = render(result, reporter="github", cwd=os.getcwd())
    commands = [line for line in report.split("\n") if line.startswith("::")]

    assert len(commands) == len(result.issues)
    assert commands[0].startswith("::error ")
    assert "title=chki18n NO_KEY" in commands[0]
    # The path is relative to the working directory, which is what GitHub
    # resolves an annotation against.
    assert "file=tests/samples/locales-all-issues/ko.json" in commands[0]


def test_names_each_severity_the_way_github_does() -> None:
    report = render(analyze(), reporter="github")

    assert "::warning " in report
    assert "::warn " not in report


def test_escapes_what_would_otherwise_end_a_command_or_a_property() -> None:
    command = render(awkward(), reporter="github", cwd="/repo").split("\n")[0]

    assert "file=lo%2Ccales/ko.json" in command
    # The message keeps its punctuation; only a property value may not.
    assert "Missing: here, and there." in command


def test_leaves_out_what_the_level_options_hid() -> None:
    report = render(analyze(), reporter="github", warn=False)

    assert "::warning " not in report
    assert "::error " in report


def test_group_issues_puts_the_sections_that_fail_the_run_first() -> None:
    result = analyze()
    sections = group_issues(result.issues, "code")

    assert len(sections) > 1
    assert sections[0].counts.error > 0
    assert sum(len(section.issues) for section in sections) == len(result.issues)


def test_group_issues_collects_what_the_axis_cannot_name_into_one_section() -> None:
    sections = group_issues([Issue(code="INVALID_OPTIONS", level="warn", message="bad")], "locale")

    assert sections[0].label == "(general)"


def test_counts_a_korean_or_japanese_character_as_two_columns() -> None:
    assert display_width("abc") == 3
    assert display_width("한국어") == 6
    assert display_width("日本語") == 6


def test_pads_to_a_column_count_rather_than_a_character_count() -> None:
    assert display_width(pad_to("한국어", 10)) == 10
    assert display_width(pad_to("abc", 10)) == 10


def test_cuts_to_a_column_count_and_marks_the_cut() -> None:
    assert truncate("abcdefghij", 5) == "ab..."
    assert truncate("abc", 5) == "abc"
    assert display_width(truncate("한국어입니다", 7)) <= 7


def test_creates_the_directory_and_writes_what_the_extension_asked_for(
    output_dir: Path,
) -> None:
    file = output_dir / "nested" / "report.json"
    result = check_translation_files(
        sample_path("locales-all-issues"), Options(target="en", output=str(file))
    )
    written = json.loads(file.read_text(encoding="utf-8"))

    assert written["summary"]["error"] == result.summary.error
    assert len(written["issues"]) == len(result.issues)


def test_never_writes_escape_codes_into_a_file(output_dir: Path) -> None:
    file = output_dir / "report.txt"

    check_translation_files(
        sample_path("locales-all-issues"),
        Options(target="en", output=str(file), color=True),
    )

    assert ANSI.search(file.read_text(encoding="utf-8")) is None


def test_fails_the_run_when_the_report_cannot_be_written() -> None:
    result = check_translation_files(
        sample_path("locales-no-issue"),
        # A path whose parent is a file cannot be created.
        Options(
            target="en",
            output=os.path.join(sample_path("locales-no-issue"), "en.json", "report.txt"),
        ),
    )

    assert result.success is False
    assert any("could not be written" in issue.message for issue in result.issues)
