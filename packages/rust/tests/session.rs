use chki18n::types::TranslationGroups;
use chki18n::{
	create_session, load_translations, CheckCode, FileFormat, Input, Issue, Options, TranslationMap,
};
use indexmap::IndexMap;
use serde_json::{json, Value};

const FOLDER_KO: &str = "\u{d3f4}\u{b354}";

fn sample_path(name: &str) -> String {
	format!("tests/samples/{name}")
}

fn target(locale: &str) -> Options {
	Options {
		target: Some(locale.into()),
		..Options::default()
	}
}

/// `{ locale: { ... } }` written with `json!`, as the locales of an input.
fn locales(value: Value) -> IndexMap<String, TranslationMap> {
	value
		.as_object()
		.expect("locales are an object")
		.iter()
		.map(|(locale, map)| {
			(
				locale.clone(),
				map.as_object().expect("a locale is an object").clone(),
			)
		})
		.collect()
}

fn groups() -> TranslationGroups {
	TranslationGroups::from([
		(
			"common.json".to_string(),
			locales(json!({ "en": { "ok": "OK" }, "ko": { "ok": "\u{d655}\u{c778}" } })),
		),
		(
			"errors.json".to_string(),
			locales(json!({ "en": { "failed": "Failed" }, "ko": {} })),
		),
	])
}

fn groups_input() -> Input {
	Input {
		groups: Some(groups()),
		..Input::default()
	}
}

// loadTranslations

#[test]
fn scans_once_and_holds_what_it_read() {
	let loaded = load_translations(Some(&sample_path("locales-all-issues")), &target("en"));
	let session = loaded.session();
	let mut locales = session.locales().to_vec();

	locales.sort();

	assert_eq!(locales, ["en", "ko"]);
	assert_eq!(session.groups(), [""]);
	assert_eq!(session.file_format(), Some(FileFormat::Single));
	assert_eq!(session.files().len(), 2);
	assert_eq!(
		session.get("en", "greeting", None),
		Some(&json!("Hello {name}"))
	);
}

#[test]
fn flattens_on_load_so_keys_are_read_in_their_dotted_form() {
	let loaded = load_translations(Some(&sample_path("locales-no-issue")), &target("en"));
	let session = loaded.session();

	assert_eq!(
		session.get("ko", "attr.folder", None),
		Some(&json!(FOLDER_KO))
	);
	assert!(session.keys(None).iter().any(|key| key == "desc.hello"));
}

#[test]
fn analyses_without_reading_the_files_again() {
	let loaded = load_translations(Some(&sample_path("locales-all-issues")), &target("en"));
	let first = loaded.analyze();
	let second = loaded.analyze();

	assert!(!first.success);
	assert_eq!(first.issues.len(), second.issues.len());
	assert_eq!(first.file_format, Some(FileFormat::Single));
}

#[test]
fn re_checks_only_the_edited_key_and_reports_the_new_state() {
	let mut loaded = load_translations(Some(&sample_path("locales-all-issues")), &target("en"));
	let session = loaded.session_mut();
	let codes: Vec<CheckCode> = session
		.check_key("greeting", None)
		.iter()
		.map(|issue| issue.code)
		.collect();
	let edited = "{name}\u{b2d8} \u{c548}\u{b155}\u{d558}\u{c138}\u{c694}";

	assert_eq!(codes, [CheckCode::NoInterpolationKey]);
	assert_eq!(
		session.set("ko", "greeting", edited, None),
		Vec::<Issue>::new()
	);
	assert_eq!(session.get("ko", "greeting", None), Some(&json!(edited)));
}

#[test]
fn carries_an_edit_into_the_next_full_analysis() {
	let mut loaded = load_translations(Some(&sample_path("locales-issue-no-key")), &target("en"));

	assert_eq!(
		loaded.analyze().issues_by_code()[&CheckCode::NoKey].len(),
		1
	);

	loaded
		.session_mut()
		.set("ko", "attr.folder", FOLDER_KO, None);

	assert!(!loaded
		.analyze()
		.issues_by_code()
		.contains_key(&CheckCode::NoKey));
}

#[test]
fn drops_a_key_from_one_locale_or_from_all_of_them() {
	let mut loaded = load_translations(Some(&sample_path("locales-no-issue")), &target("en"));
	let session = loaded.session_mut();
	let codes: Vec<CheckCode> = session
		.remove("attr.folder", Some("ko"), None)
		.iter()
		.map(|issue| issue.code)
		.collect();

	assert_eq!(codes, [CheckCode::NoKey]);

	session.remove("attr.folder", None, None);

	assert_eq!(session.get("en", "attr.folder", None), None);
	assert_eq!(session.check_key("attr.folder", None), Vec::<Issue>::new());
}

#[test]
fn reload_throws_away_the_edits_and_reads_the_directory_again() {
	let mut loaded = load_translations(Some(&sample_path("locales-no-issue")), &target("en"));

	loaded
		.session_mut()
		.set("ko", "attr.folder", "edited", None);
	assert_eq!(
		loaded.session().get("ko", "attr.folder", None),
		Some(&json!("edited"))
	);

	loaded.reload();

	assert_eq!(
		loaded.session().get("ko", "attr.folder", None),
		Some(&json!(FOLDER_KO))
	);
}

#[test]
fn reports_a_missing_path_instead_of_throwing() {
	let loaded = load_translations(None, &Options::default());

	assert_eq!(loaded.path(), "");
	assert!(!loaded.analyze().success);
	assert_eq!(loaded.analyze().issues[0].code, CheckCode::InvalidOptions);
}

// createSession

#[test]
fn takes_translations_that_are_already_in_memory() {
	let session = create_session(groups_input(), &target("en"));

	assert_eq!(session.groups(), ["common.json", "errors.json"]);
	assert_eq!(
		session.analyze().issues_by_code()[&CheckCode::NoKey].len(),
		1
	);
}

#[test]
fn finds_the_group_a_key_lives_in_so_simple_calls_need_no_group() {
	let session = create_session(groups_input(), &target("en"));

	assert_eq!(
		session.get("ko", "ok", None),
		Some(&json!("\u{d655}\u{c778}"))
	);
	assert_eq!(session.get("en", "failed", None), Some(&json!("Failed")));
	assert_eq!(session.check_key("failed", None)[0].group, "errors.json");
}

#[test]
fn writes_into_the_named_group() {
	let failed_ko = "\u{c2e4}\u{d328}";
	let mut session = create_session(groups_input(), &target("en"));

	session.set("ko", "failed", failed_ko, None);

	assert_eq!(session.get("ko", "failed", None), Some(&json!(failed_ko)));
	assert_eq!(
		session.translations(Some("errors.json")).unwrap()["ko"]["failed"],
		json!(failed_ko)
	);
	assert!(!session
		.analyze()
		.issues_by_code()
		.contains_key(&CheckCode::NoKey));
}

#[test]
fn adds_a_locale_that_was_not_there_before() {
	let mut session = create_session(groups_input(), &target("en"));

	session.set("ja", "ok", "OK", Some("common.json"));

	assert!(session.locales().iter().any(|locale| locale == "ja"));
	assert_eq!(
		session.check_key("ok", Some("common.json"))[0].code,
		CheckCode::NotTranslatedValue
	);
}

#[test]
fn reset_replaces_the_data_but_keeps_the_options() {
	let mut session = create_session(groups_input(), &target("ko"));

	session.reset(Input {
		locales: Some(locales(
			json!({ "ko": { "a": "\u{ac00}" }, "en": { "a": "\u{ac00}" } }),
		)),
		..Input::default()
	});

	assert_eq!(session.groups(), [""]);
	assert_eq!(session.options().target, "ko");
	assert_eq!(
		session.analyze().issues_by_code()[&CheckCode::NotTranslatedValue].len(),
		1
	);
}
