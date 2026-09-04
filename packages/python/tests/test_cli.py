"""What the command line accepts, and what it leaves behind."""

from __future__ import annotations

import os
import subprocess
import sys

import pytest

from chki18n._version import PACKAGE_VERSION
from chki18n.cli import main, parse_arguments


def run(*arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "chki18n.cli", *arguments],
        capture_output=True,
        text=True,
        check=False,
    )


def test_prints_the_report_whatever_the_console_encoding_is() -> None:
    # A console that cannot encode a box rule or a Korean value is the normal
    # case on Windows, where stdout defaults to the ANSI code page. Asking for
    # one here reproduces that anywhere.
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "chki18n.cli",
            "tests/samples/locales-issue-no-key",
            "--target",
            "en",
        ],
        capture_output=True,
        env={**os.environ, "PYTHONIOENCODING": "cp1252"},
        check=False,
    )

    assert result.returncode == 1
    assert b"NO_KEY" in result.stdout
    assert b"UnicodeEncodeError" not in result.stderr


def test_reads_a_flag_and_the_word_after_it() -> None:
    assert parse_arguments(["--target", "ko"])["target"] == "ko"


def test_reads_flag_equals_value_as_the_same_thing() -> None:
    assert parse_arguments(["--target=ko"])["target"] == "ko"


def test_reads_a_boolean_flag_as_true_and_no_x_as_false() -> None:
    assert parse_arguments(["--debug"])["debug"] is True
    assert parse_arguments(["--no-warn"])["warn"] is False


def test_collects_everything_that_is_not_a_flag() -> None:
    assert parse_arguments(["locales", "--target", "ko"])["_"] == ["locales"]


def test_does_not_swallow_the_next_word_for_a_valueless_flag() -> None:
    args = parse_arguments(["--debug", "locales"])

    assert args["debug"] is True
    assert args["_"] == ["locales"]


def test_prints_the_usage_text_for_help(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["--help"]) == 0

    printed = capsys.readouterr().out

    assert "--target <locale>" in printed
    assert "Check codes:" in printed


def test_prints_the_version(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["--version"]) == 0
    assert capsys.readouterr().out.strip() == PACKAGE_VERSION


def test_exits_0_on_a_directory_with_nothing_wrong() -> None:
    result = run("tests/samples/locales-no-issue", "--target", "en")

    assert result.returncode == 0
    assert "PASS" in result.stdout


def test_exits_1_when_an_error_level_issue_was_found() -> None:
    result = run("tests/samples/locales-issue-no-key", "--target", "en")

    assert result.returncode == 1
    assert "NO_KEY" in result.stdout


def test_leaves_the_banner_off_a_report_meant_for_another_program() -> None:
    result = run("tests/samples/locales-no-issue", "--target", "en", "--reporter", "json")

    assert result.stdout.lstrip().startswith("{")
