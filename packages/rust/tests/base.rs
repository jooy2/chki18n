//! Reading a directory of translation files and checking it.

use chki18n::{check_translation_files, load_translations, CheckCode, FileFormat, Level, Options};

fn sample_path(name: &str) -> String {
	format!("tests/samples/{name}")
}

fn check_sample(name: &str) -> chki18n::CheckResult {
	check_translation_files(Some(&sample_path(name)), &Options::default())
}

#[test]
fn passes_a_directory_with_no_critical_issue() {
	let result = check_sample("locales-no-issue");
	let mut locales = result.locales.clone();

	locales.sort();

	assert!(result.success);
	assert_eq!(result.summary.error, 0);
	assert_eq!(result.file_format, Some(FileFormat::Single));
	assert_eq!(locales, ["en", "ko"]);
	assert_eq!(result.files.len(), 2);
}

#[test]
fn does_not_read_a_file_whose_path_names_no_locale() {
	let session = load_translations(Some(&sample_path("app-root")), &Options::default());
	let result = session.analyze();

	// The broken fixture was never parsed, so it cannot fail the run.
	assert!(result
		.issues_by_code()
		.get(&CheckCode::InvalidFile)
		.is_none());
	assert_eq!(
		session.skipped(),
		["data/settings.json", "fixtures/broken.json"]
	);
	assert!(result.success);
}

#[test]
fn reports_a_translation_file_that_is_not_an_object_instead_of_comparing_it() {
	let result = check_translation_files(
		Some(&sample_path("locales-not-an-object")),
		&Options {
			target: Some("en".into()),
			..Options::default()
		},
	);
	let by_code = result.issues_by_code();
	let messages: Option<Vec<&str>> = by_code
		.get(&CheckCode::InvalidFile)
		.map(|issues| issues.iter().map(|issue| issue.message.as_str()).collect());

	assert_eq!(
		messages,
		Some(vec![
			"The translations of `de` in 'de.json' are not an object.",
			"The translations of `ko` in 'ko.json' are not an object.",
		])
	);
	// An array read as keys `0` and `1` would have been compared, and missed.
	assert!(by_code.get(&CheckCode::DummyKey).is_none());
}

#[test]
fn reads_a_file_that_starts_with_a_byte_order_mark() {
	let result = check_sample("locales-byte-order-mark");
	let by_code = result.issues_by_code();

	assert!(by_code.get(&CheckCode::InvalidFile).is_none());
	assert_eq!(
		by_code
			.get(&CheckCode::NoKey)
			.map(|issues| issues[0].key.as_str()),
		Some("farewell")
	);
}

#[test]
fn reports_a_key_the_target_language_has_and_another_locale_does_not() {
	let result = check_sample("locales-issue-no-key");
	let by_code = result.issues_by_code();
	let no_key = by_code.get(&CheckCode::NoKey).cloned().unwrap_or_default();

	assert!(!result.success);
	assert_eq!(no_key.len(), 1);

	let issue = no_key[0];

	assert_eq!(issue.locale, "ko");
	assert_eq!(issue.key, "attr.folder");
	assert_eq!(issue.target_value.as_deref(), Some("Folder"));
	assert_eq!(issue.level, Level::Error);
	assert!(issue
		.file
		.as_deref()
		.is_some_and(|file| file.ends_with("ko.json")));
}

#[test]
fn reports_what_the_target_language_got_wrong_in_its_own_file() {
	let result = check_sample("locales-target-issue");
	// Sorted by spelling, as the JavaScript test sorts the code strings.
	let mut codes: Vec<&str> = result
		.issues
		.iter()
		.filter(|issue| issue.locale == "en")
		.map(|issue| issue.code.as_str())
		.collect();

	codes.sort();

	assert_eq!(
		codes,
		[
			CheckCode::EmptyValue.as_str(),
			CheckCode::InvalidValueType.as_str(),
			CheckCode::InvisibleCharacter.as_str(),
			CheckCode::SurroundingWhitespace.as_str(),
		]
	);
	// None of them is an error, so a source language nobody had checked
	// before does not start failing the build the day this arrives.
	assert!(result.success);
	assert!(result
		.issues
		.iter()
		.all(|issue| issue.locale.is_empty() || issue.locale == "en"));
}

#[test]
fn compares_a_folder_per_locale_layout() {
	let result = check_sample("multiple-translate-files");

	assert!(result.success);
	assert_eq!(result.file_format, Some(FileFormat::Folder));
	assert_eq!(result.groups, ["common.json"]);
}

#[test]
fn compares_a_single_file_holding_every_locale() {
	let result = check_sample("locales-nested");
	let by_code = result.issues_by_code();
	let no_key = by_code.get(&CheckCode::NoKey).cloned().unwrap_or_default();

	assert_eq!(result.file_format, Some(FileFormat::Nested));
	assert_eq!(result.groups, ["translation.json"]);
	assert_eq!(no_key.len(), 1);
	assert_eq!(no_key[0].key, "desc.bye");
}

#[test]
fn reports_every_comparison_check() {
	let result = check_sample("locales-all-issues");
	let reported: Vec<CheckCode> = result.issues_by_code().keys().copied().collect();

	assert!(!result.success);

	for code in [
		CheckCode::NoKey,
		CheckCode::DummyKey,
		CheckCode::EmptyValue,
		CheckCode::NoInterpolationKey,
		CheckCode::ExtraInterpolationKey,
		CheckCode::NotTranslatedValue,
		CheckCode::DuplicateValue,
		CheckCode::SurroundingWhitespace,
		CheckCode::MissingNumber,
		CheckCode::InvalidValueType,
	] {
		assert!(reported.contains(&code), "{code} was not reported");
	}
}

#[test]
fn summarizes_issues_by_level_locale_and_code() {
	let result = check_sample("locales-all-issues");
	let summary = &result.summary;

	assert_eq!(summary.total, result.issues.len());
	assert_eq!(summary.error + summary.warn + summary.info, summary.total);
	assert_eq!(summary.by_code.get(&CheckCode::NoKey), Some(&1));
	assert!(summary
		.by_locale
		.get("ko")
		.is_some_and(|counts| counts.error > 0));
}

#[test]
fn fails_when_no_path_is_given() {
	let result = check_translation_files(None, &Options::default());

	assert!(!result.success);
	assert_eq!(result.issues[0].code, CheckCode::InvalidOptions);
	assert_eq!(result.issues[0].level, Level::Error);
}

#[test]
fn fails_when_the_target_language_is_not_among_the_files() {
	let result = check_translation_files(
		Some(&sample_path("locales-no-issue")),
		&Options {
			target: Some("ja".into()),
			..Options::default()
		},
	);

	assert!(!result.success);
	assert_eq!(
		result
			.issues_by_code()
			.get(&CheckCode::InvalidOptions)
			.map(|issues| issues[0].level),
		Some(Level::Error)
	);
}

#[test]
fn fails_when_a_forced_format_matches_no_file() {
	let result = check_translation_files(
		Some(&sample_path("locales-no-issue")),
		&Options {
			format: Some(FileFormat::Folder.as_str().into()),
			..Options::default()
		},
	);

	assert!(!result.success);
	assert_eq!(
		result
			.issues_by_code()
			.get(&CheckCode::InvalidFile)
			.map(Vec::len),
		Some(1)
	);
}

#[test]
fn fails_when_the_directory_does_not_exist() {
	let result = check_sample("does-not-exist");

	assert!(!result.success);
	assert!(result
		.issues_by_code()
		.get(&CheckCode::InvalidFile)
		.is_some_and(|issues| !issues.is_empty()));
}

#[test]
fn only_runs_the_checks_it_was_asked_for() {
	let result = check_translation_files(
		Some(&sample_path("locales-all-issues")),
		&Options {
			target: Some("en".into()),
			checks: Some(vec![CheckCode::NoKey.as_str().into()]),
			..Options::default()
		},
	);
	let reported: Vec<CheckCode> = result.issues_by_code().keys().copied().collect();

	assert_eq!(reported, [CheckCode::NoKey]);
}
