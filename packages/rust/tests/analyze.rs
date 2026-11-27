//! Comparing translations held in memory, as a whole or one key at a time.

use chki18n::{
	analyze_translations, create_analyzer, Analyzer, CheckCode, Entry, Input, Level, Options,
	TranslationMap,
};
use indexmap::IndexMap;
use serde_json::{json, Value};

/// `{ locale: { key: value } }` written with `json!`, as the input reads it.
fn locales_of(locales: Value) -> IndexMap<String, TranslationMap> {
	let Value::Object(locales) = locales else {
		panic!("the locales are not an object");
	};

	locales
		.into_iter()
		.map(|(locale, map)| match map {
			Value::Object(map) => (locale, map),
			other => panic!("the translations of `{locale}` are not an object: {other}"),
		})
		.collect()
}

fn locales_input(locales: Value) -> Input {
	Input {
		locales: Some(locales_of(locales)),
		..Input::default()
	}
}

fn target_en() -> Options {
	Options {
		target: Some("en".into()),
		..Options::default()
	}
}

/// `{ locale: value }` of one key, in the order written.
fn values_of(values: Value) -> IndexMap<String, Value> {
	let Value::Object(values) = values else {
		panic!("the values are not an object");
	};

	values.into_iter().collect()
}

fn entry(key: &str, values: Value) -> Entry {
	Entry {
		key: key.into(),
		values: values_of(values),
		..Entry::default()
	}
}

mod analyze_translations {
	use super::*;

	#[test]
	fn flattens_nested_translations_before_comparing_them() {
		let result = analyze_translations(
			&locales_input(json!({
				"en": { "desc": { "hello": "Hello", "bye": "Goodbye" } },
				"ko": { "desc": { "hello": "\u{c548}\u{b155}\u{d558}\u{c138}\u{c694}" } }
			})),
			&target_en(),
		);
		let by_code = result.issues_by_code();

		assert_eq!(result.key_count, 2);
		assert!(!result.success);
		assert_eq!(
			by_code
				.get(&CheckCode::NoKey)
				.map(|issues| issues[0].key.as_str()),
			Some("desc.bye")
		);
	}

	#[test]
	fn uses_already_flattened_translations_as_they_are() {
		let result = analyze_translations(
			&locales_input(json!({ "en": { "a.b": "Hi" }, "ko": { "a.b": "" } })),
			&Options {
				flattened: Some(true),
				..target_en()
			},
		);

		assert_eq!(result.key_count, 1);
		assert_eq!(
			result
				.issues_by_code()
				.get(&CheckCode::EmptyValue)
				.map(Vec::len),
			Some(1)
		);
	}

	#[test]
	fn does_no_file_system_work_so_it_reports_no_files() {
		let result = analyze_translations(
			&locales_input(json!({ "en": { "a": "A" }, "ko": { "a": "\u{3131}" } })),
			&target_en(),
		);

		assert!(result.files.is_empty());
		assert_eq!(result.file_format, None);
	}

	#[test]
	fn compares_each_group_on_its_own() {
		let Value::Object(groups) = json!({
			"common.json": { "en": { "a": "A" }, "ko": { "a": "\u{3131}" } },
			"errors.json": { "en": { "b": "B" }, "ko": {} }
		}) else {
			unreachable!();
		};
		let input = Input {
			groups: Some(
				groups
					.into_iter()
					.map(|(group, locales)| (group, locales_of(locales)))
					.collect(),
			),
			..Input::default()
		};
		let result = analyze_translations(&input, &target_en());
		let by_code = result.issues_by_code();
		let no_key = by_code.get(&CheckCode::NoKey).cloned().unwrap_or_default();

		assert_eq!(result.groups, ["common.json", "errors.json"]);
		assert_eq!(no_key.len(), 1);
		assert_eq!(no_key[0].group, "errors.json");
	}

	#[test]
	fn honours_custom_interpolation_delimiters() {
		let input = locales_input(
			json!({ "en": { "a": "Hello {{name}}" }, "ko": { "a": "\u{c548}\u{b155}\u{d558}\u{c138}\u{c694}" } }),
		);
		let custom = analyze_translations(
			&input,
			&Options {
				interpolation_prefix: Some("{{".into()),
				interpolation_suffix: Some("}}".into()),
				..target_en()
			},
		);

		assert_eq!(
			custom
				.issues_by_code()
				.get(&CheckCode::NoInterpolationKey)
				.map(Vec::len),
			Some(1)
		);

		// The default single-brace delimiters do not recognise `{{name}}`, so the
		// missing placeholder goes unnoticed.
		let default = analyze_translations(&input, &target_en());

		assert!(default
			.issues_by_code()
			.get(&CheckCode::NoInterpolationKey)
			.is_none());
	}

	#[test]
	fn skips_the_checks_named_by_ignore_checks() {
		let input = locales_input(json!({ "en": { "a": "Same" }, "ko": { "a": "Same" } }));
		let every = analyze_translations(&input, &target_en());
		let ignoring = analyze_translations(
			&input,
			&Options {
				ignore_checks: Some(vec!["NOT_TRANSLATED_VALUE".into()]),
				..target_en()
			},
		);

		assert_eq!(
			every
				.issues_by_code()
				.get(&CheckCode::NotTranslatedValue)
				.map(Vec::len),
			Some(1)
		);
		assert!(ignoring
			.issues_by_code()
			.get(&CheckCode::NotTranslatedValue)
			.is_none());
	}
}

mod create_analyzer_check_entry {
	use super::*;

	fn analyzer() -> Analyzer {
		create_analyzer(&target_en())
	}

	#[test]
	fn checks_a_single_key_across_locales() {
		let issues = analyzer().check_entry(&entry(
			"greeting",
			json!({ "en": "Hello {name}", "ko": "\u{c548}\u{b155}\u{d558}\u{c138}\u{c694}" }),
		));

		assert_eq!(issues.len(), 1);
		assert_eq!(issues[0].code, CheckCode::NoInterpolationKey);
		assert_eq!(issues[0].interpolation.as_deref(), Some("name"));
		assert_eq!(issues[0].key, "greeting");
	}

	#[test]
	fn returns_nothing_for_a_key_with_no_problem() {
		let issues = analyzer().check_entry(&entry(
			"a",
			json!({ "en": "Hello", "ko": "\u{c548}\u{b155}" }),
		));

		assert!(issues.is_empty(), "{issues:?}");
	}

	#[test]
	fn reports_a_missing_locale_when_told_which_locales_exist() {
		let issues = analyzer().check_entry(&Entry {
			locales: Some(vec!["en".into(), "ko".into()]),
			..entry("a", json!({ "en": "Hello" }))
		});

		assert_eq!(issues.len(), 1);
		assert_eq!(issues[0].code, CheckCode::NoKey);
		assert_eq!(issues[0].locale, "ko");
	}

	#[test]
	fn never_reports_checks_that_need_more_than_one_key() {
		let issues = analyzer().check_entry(&entry("a", json!({ "en": "Same", "ko": "Same" })));

		assert!(issues
			.iter()
			.all(|issue| issue.code != CheckCode::DuplicateValue));
	}

	#[test]
	fn carries_the_group_through_to_the_issue() {
		let issues = analyzer().check_entry(&Entry {
			group: Some("common.json".into()),
			..entry("a", json!({ "en": "Hello", "ko": "" }))
		});

		assert_eq!(issues[0].group, "common.json");
	}

	#[test]
	fn agrees_with_a_full_analysis_of_the_same_data() {
		let locales = locales_of(json!({
			"en": { "a": "Hello {name}", "b": "Bye" },
			"ko": { "a": "\u{c548}\u{b155}\u{d558}\u{c138}\u{c694}", "b": "" }
		}));
		let analyzed = analyze_translations(
			&Input {
				locales: Some(locales.clone()),
				..Input::default()
			},
			&Options {
				flattened: Some(true),
				..target_en()
			},
		);
		let analyzer = analyzer();
		let incremental: Vec<String> = locales["en"]
			.keys()
			.flat_map(|key| {
				analyzer.check_entry(&Entry {
					key: key.clone(),
					values: IndexMap::from([
						("en".to_string(), locales["en"][key].clone()),
						("ko".to_string(), locales["ko"][key].clone()),
					]),
					..Entry::default()
				})
			})
			.map(|issue| format!("{}:{}", issue.code, issue.key))
			.collect();
		let whole: Vec<String> = analyzed
			.issues
			.iter()
			.map(|issue| format!("{}:{}", issue.code, issue.key))
			.collect();

		assert_eq!(incremental, whole);
	}
}

// From `core-entry.test.ts`: the analysis API reached through the `core` module,
// which reads no files.
mod core_entry {
	use super::*;

	#[test]
	fn exports_the_analysis_api() {
		let result = chki18n::core::analyzer::analyze_translations(
			&locales_input(
				json!({ "en": { "a": "Hello {name}" }, "ko": { "a": "\u{c548}\u{b155}\u{d558}\u{c138}\u{c694}" } }),
			),
			&target_en(),
		);
		let issues = chki18n::core::analyzer::create_analyzer(&target_en())
			.check_entry(&entry("a", json!({ "en": "Hello", "ko": "" })));

		assert_eq!(
			result
				.issues_by_code()
				.get(&CheckCode::NoInterpolationKey)
				.map(Vec::len),
			Some(1)
		);
		assert_eq!(issues[0].code, CheckCode::EmptyValue);
	}
}

// From `core-entry.test.ts`. The JavaScript package takes `levels` as an object
// or as the command line's `CODE=level` text; Rust only takes the text.
mod level_overrides {
	use super::*;

	fn levels(levels: &str) -> Options {
		Options {
			levels: Some(vec![levels.into()]),
			..target_en()
		}
	}

	#[test]
	fn re_grades_a_check_and_changes_whether_the_run_passes() {
		let input = locales_input(json!({ "en": { "a": "Hello" }, "ko": { "a": "" } }));

		assert!(analyze_translations(&input, &target_en()).success);
		assert!(!analyze_translations(&input, &levels("EMPTY_VALUE=error")).success);
	}

	#[test]
	fn accepts_the_cli_form_of_the_same_override() {
		let input = locales_input(json!({ "en": { "a": "Hello" }, "ko": { "a": "" } }));
		let result = analyze_translations(&input, &levels("EMPTY_VALUE=error"));

		assert_eq!(
			result
				.issues_by_code()
				.get(&CheckCode::EmptyValue)
				.map(|issues| issues[0].level),
			Some(Level::Error)
		);
	}

	#[test]
	fn applies_to_a_single_key_check_as_well() {
		let analyzer = create_analyzer(&levels("EMPTY_VALUE=info"));
		let issues = analyzer.check_entry(&entry("a", json!({ "en": "Hello", "ko": "" })));

		assert_eq!(issues[0].level, Level::Info);
	}

	#[test]
	fn refuses_to_re_grade_a_check_that_reports_how_the_run_went() {
		let analyzer = create_analyzer(&Options {
			levels: Some(vec!["INVALID_FILE=info".into()]),
			..Options::default()
		});

		assert!(analyzer.options.levels.is_none());
		assert!(analyzer
			.option_issues
			.iter()
			.any(|issue| issue.message.contains("INVALID_FILE")));
	}
}
