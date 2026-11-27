use chki18n::constants::{ANALYZE_CHECK_CODES, DEFAULT_TARGET_LOCALE};
use chki18n::options::{build_usage_text, options_from_args, ParsedArgs, OPTION_DEFINITIONS};
use chki18n::{resolve_options, CheckCode, FileFormat, Level, Options};
use indexmap::IndexMap;

fn strings(items: &[&str]) -> Vec<String> {
	items.iter().map(|item| item.to_string()).collect()
}

/// Flags as the command line parser leaves them, each with the values written
/// after it.
fn values(entries: &[(&str, &str)]) -> IndexMap<String, Vec<String>> {
	entries
		.iter()
		.map(|(flag, value)| (flag.to_string(), vec![value.to_string()]))
		.collect()
}

fn checks_of(options: &Options) -> Vec<CheckCode> {
	resolve_options(options)
		.0
		.enabled_checks
		.into_iter()
		.collect()
}

// resolveOptions

#[test]
fn fills_in_the_defaults() {
	let (options, _) = resolve_options(&Options::default());

	assert_eq!(options.target, DEFAULT_TARGET_LOCALE);
	assert_eq!(options.format, FileFormat::Auto);
	assert_eq!(options.interpolation_prefix, "{");
	assert_eq!(options.enabled_checks.len(), ANALYZE_CHECK_CODES.len());
}

#[test]
fn says_so_when_both_interpolation_delimiters_are_the_same() {
	let (_, issues) = resolve_options(&Options {
		target: Some("en".into()),
		interpolation_prefix: Some("__".into()),
		interpolation_suffix: Some("__".into()),
		..Options::default()
	});

	assert_eq!(issues.len(), 1);
	assert!(issues[0]
		.message
		.contains("Interpolation keys were not checked"));
}

#[test]
fn does_not_treat_a_missing_target_as_a_fault() {
	let (_, issues) = resolve_options(&Options::default());

	assert_eq!(issues.len(), 1);
	assert_eq!(issues[0].level, Level::Info);
}

#[test]
fn accepts_a_comma_separated_list_of_check_codes() {
	let options = Options {
		checks: Some(strings(&["NO_KEY, EMPTY_VALUE"])),
		..Options::default()
	};

	assert_eq!(
		checks_of(&options),
		[CheckCode::NoKey, CheckCode::EmptyValue]
	);
}

#[test]
fn removes_the_ignored_checks_from_the_full_set() {
	let (options, _) = resolve_options(&Options {
		ignore_checks: Some(strings(&["DUPLICATE_VALUE"])),
		..Options::default()
	});

	assert!(!options.enabled_checks.contains(&CheckCode::DuplicateValue));
	assert_eq!(options.enabled_checks.len(), ANALYZE_CHECK_CODES.len() - 1);
}

#[test]
fn reports_an_unknown_check_code_and_keeps_going() {
	let (options, issues) = resolve_options(&Options {
		checks: Some(strings(&["NO_KEY,NOPE"])),
		..Options::default()
	});
	let enabled: Vec<CheckCode> = options.enabled_checks.into_iter().collect();

	assert_eq!(enabled, [CheckCode::NoKey]);
	assert!(issues.iter().any(|issue| issue.message.contains("NOPE")));
}

#[test]
fn refuses_to_combine_checks_with_ignore_checks() {
	let (options, issues) = resolve_options(&Options {
		checks: Some(strings(&["NO_KEY"])),
		ignore_checks: Some(strings(&["EMPTY_VALUE"])),
		..Options::default()
	});
	let enabled: Vec<CheckCode> = options.enabled_checks.into_iter().collect();

	assert_eq!(enabled, [CheckCode::NoKey]);
	assert!(issues
		.iter()
		.any(|issue| issue.message.contains("ignoreChecks")));
}

#[test]
fn falls_back_to_auto_for_an_unknown_format() {
	let (options, issues) = resolve_options(&Options {
		format: Some("nope".into()),
		..Options::default()
	});

	assert_eq!(options.format, FileFormat::Auto);
	assert!(issues.iter().any(|issue| issue.message.contains("nope")));
}

// argsToOptions, fed the parsed flags directly as the JavaScript test feeds it
// a parsed argument object.

#[test]
fn maps_every_cli_flag_onto_its_option() {
	let options = options_from_args(&ParsedArgs {
		values: values(&[
			("path", "locales"),
			("target", "ko"),
			("format", "folder"),
			("ignore-checks", "NO_KEY"),
			("interpolation-prefix", "{{"),
			("interpolation-suffix", "}}"),
			("exclude", "tmp"),
		]),
		flags: IndexMap::from([("warn".to_string(), false), ("debug".to_string(), true)]),
		positional: Vec::new(),
	});
	let expected = Options {
		path: Some("locales".into()),
		target: Some("ko".into()),
		format: Some("folder".into()),
		ignore_checks: Some(strings(&["NO_KEY"])),
		interpolation_prefix: Some("{{".into()),
		interpolation_suffix: Some("}}".into()),
		exclude: Some(strings(&["tmp"])),
		warn: Some(false),
		debug: Some(true),
		..Options::default()
	};

	// `Options` has no `PartialEq`; its debug form shows every field.
	assert_eq!(format!("{options:?}"), format!("{expected:?}"));
}

#[test]
fn reads_a_bare_positional_argument_as_the_path() {
	let options = options_from_args(&ParsedArgs {
		positional: strings(&["locales"]),
		..ParsedArgs::default()
	});

	assert_eq!(options.path.as_deref(), Some("locales"));
}

#[test]
fn prefers_an_explicit_path_over_the_positional_argument() {
	let options = options_from_args(&ParsedArgs {
		values: values(&[("path", "locales")]),
		positional: strings(&["ignored"]),
		..ParsedArgs::default()
	});

	assert_eq!(options.path.as_deref(), Some("locales"));
}

#[test]
fn resolves_the_cli_form_of_an_option_exactly_like_the_api_form() {
	let (from_cli, _) = resolve_options(&options_from_args(&ParsedArgs {
		values: values(&[("target", "ko"), ("ignore-checks", "NO_KEY")]),
		..ParsedArgs::default()
	}));
	let (from_api, _) = resolve_options(&Options {
		target: Some("ko".into()),
		ignore_checks: Some(strings(&["NO_KEY"])),
		..Options::default()
	});

	// `ResolvedOptions` has no `PartialEq`; its debug form shows every field.
	assert_eq!(format!("{from_cli:?}"), format!("{from_api:?}"));
}

// buildUsageText

#[test]
fn documents_every_option() {
	let usage = build_usage_text("chki18n");

	for definition in OPTION_DEFINITIONS {
		assert!(
			usage.contains(&format!("--{}", definition.flag)),
			"{} is undocumented",
			definition.flag
		);
	}
}
