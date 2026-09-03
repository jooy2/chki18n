"""How the loose forms an option may take are resolved, and how the CLI reads them."""

from __future__ import annotations

from chki18n import (
    ANALYZE_CHECK_CODES,
    DEFAULT_TARGET_LOCALE,
    OPTION_DEFINITIONS,
    Options,
    build_usage_text,
    options_from_args,
    resolve_options,
)


def test_fills_in_the_defaults() -> None:
    options, _ = resolve_options()

    assert options.target == DEFAULT_TARGET_LOCALE
    assert options.format == "auto"
    assert options.interpolation_prefix == "{"
    assert len(options.enabled_checks) == len(ANALYZE_CHECK_CODES)


def test_does_not_treat_a_missing_target_as_a_fault() -> None:
    _, issues = resolve_options()

    assert len(issues) == 1
    assert issues[0].level == "info"


def test_accepts_a_comma_separated_list_of_check_codes() -> None:
    options, _ = resolve_options(Options(checks="NO_KEY, EMPTY_VALUE"))

    assert options.enabled_checks == frozenset({"NO_KEY", "EMPTY_VALUE"})


def test_removes_the_ignored_checks_from_the_full_set() -> None:
    options, _ = resolve_options(Options(ignore_checks=["DUPLICATE_VALUE"]))

    assert "DUPLICATE_VALUE" not in options.enabled_checks
    assert len(options.enabled_checks) == len(ANALYZE_CHECK_CODES) - 1


def test_reports_an_unknown_check_code_and_keeps_going() -> None:
    options, issues = resolve_options(Options(checks="NO_KEY,NOPE"))

    assert options.enabled_checks == frozenset({"NO_KEY"})
    assert any("NOPE" in issue.message for issue in issues)


def test_refuses_to_combine_checks_with_ignore_checks() -> None:
    options, issues = resolve_options(Options(checks="NO_KEY", ignore_checks="EMPTY_VALUE"))

    assert options.enabled_checks == frozenset({"NO_KEY"})
    assert any("ignore_checks" in issue.message for issue in issues)


def test_falls_back_to_auto_for_an_unknown_format() -> None:
    options, issues = resolve_options(Options(format="nope"))

    assert options.format == "auto"
    assert any("nope" in issue.message for issue in issues)


def test_reads_a_code_level_pair_the_way_the_cli_writes_it() -> None:
    options, _ = resolve_options(Options(levels="EMPTY_VALUE=error"))

    assert options.levels == {"EMPTY_VALUE": "error"}


def test_refuses_to_re_grade_a_check_that_reports_how_the_run_went() -> None:
    options, issues = resolve_options(Options(levels={"INVALID_FILE": "info"}))

    assert options.levels is None
    assert any("INVALID_FILE" in issue.message for issue in issues)


def test_maps_every_cli_flag_onto_its_option() -> None:
    options = options_from_args(
        {
            "_": [],
            "path": "locales",
            "target": "ko",
            "format": "folder",
            "ignore-checks": "NO_KEY",
            "interpolation-prefix": "{{",
            "interpolation-suffix": "}}",
            "exclude": "tmp",
            "warn": False,
            "debug": True,
        }
    )

    assert options == Options(
        path="locales",
        target="ko",
        format="folder",
        ignore_checks="NO_KEY",
        interpolation_prefix="{{",
        interpolation_suffix="}}",
        exclude="tmp",
        warn=False,
        debug=True,
    )


def test_reads_a_bare_positional_argument_as_the_path() -> None:
    assert options_from_args({"_": ["locales"]}).path == "locales"


def test_prefers_an_explicit_path_over_the_positional_argument() -> None:
    assert options_from_args({"_": ["ignored"], "path": "locales"}).path == "locales"


def test_resolves_the_cli_form_of_an_option_exactly_like_the_api_form() -> None:
    from_cli, _ = resolve_options(
        options_from_args({"_": [], "target": "ko", "ignore-checks": "NO_KEY"})
    )
    from_api, _ = resolve_options(Options(target="ko", ignore_checks=["NO_KEY"]))

    assert from_cli == from_api


def test_build_usage_text_documents_every_option() -> None:
    usage = build_usage_text("chki18n")

    for definition in OPTION_DEFINITIONS:
        assert f"--{definition.flag}" in usage, f"{definition.flag} is undocumented"
