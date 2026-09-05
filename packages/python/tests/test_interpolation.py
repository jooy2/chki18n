"""Guessing the delimiters a project writes its placeholders with."""

from __future__ import annotations

from chki18n import (
    INTERPOLATION_DELIMITERS,
    Delimiters,
    detect_interpolation_delimiters,
    load_translations,
)


def test_reads_each_pair_it_knows() -> None:
    assert detect_interpolation_delimiters("Hello {name}") == Delimiters("{", "}")
    assert detect_interpolation_delimiters("Hello [[name]]") == Delimiters("[[", "]]")
    assert detect_interpolation_delimiters("Hello ((name))") == Delimiters("((", "))")
    assert detect_interpolation_delimiters("Hello <name>") == Delimiters("<", ">")


def test_reads_a_doubled_pair_as_itself_not_as_its_single_form() -> None:
    assert detect_interpolation_delimiters("Hello {{name}}") == Delimiters("{{", "}}")


def test_allows_the_spacing_a_style_may_put_inside_the_delimiters() -> None:
    assert detect_interpolation_delimiters("Hello {{ name }}") == Delimiters("{{", "}}")


def test_is_not_fooled_by_the_punctuation_of_the_json_holding_the_text() -> None:
    assert detect_interpolation_delimiters('{"desc":{"hello":"Hello"}}') is None
    assert detect_interpolation_delimiters('{\n\t"list": ["a", "b"]\n}') is None


def test_answers_with_the_first_pair_it_believes_when_a_text_mixes_two() -> None:
    assert detect_interpolation_delimiters("{{a}} and [[b]]") == Delimiters("{{", "}}")


def test_has_nothing_to_say_about_a_text_with_no_placeholder() -> None:
    assert detect_interpolation_delimiters("Hello there") is None
    assert detect_interpolation_delimiters("") is None


def test_answers_with_one_of_the_pairs_it_publishes() -> None:
    assert detect_interpolation_delimiters("Hello {name}") in INTERPOLATION_DELIMITERS


def test_a_scan_reports_what_the_files_it_read_are_written_with() -> None:
    session = load_translations("tests/samples/locales-no-issue")

    assert session.detected_interpolation == Delimiters("{", "}")
    # A guess about the files, not the setting the checks ran with.
    assert session.options.interpolation_prefix == "{"


def test_a_scan_says_nothing_about_files_that_hold_no_placeholder() -> None:
    session = load_translations("tests/samples/excluded-files")

    assert session.detected_interpolation is None


def test_a_scan_says_nothing_when_there_was_no_directory_to_read() -> None:
    session = load_translations()

    assert session.detected_interpolation is None
