use std::path::Path;

use chki18n::loader::unused_keys::leaf_of_key;
use chki18n::{
	analyze_translations, check_translation_files, find_unused_keys, load_translations,
	resolve_options, CheckCode, CheckResult, Input, Level, Options, ResolvedOptions,
};
use indexmap::IndexMap;
use serde_json::{json, Map, Value};

const LOCALES_PATH: &str = "tests/samples/unused-key/locales";

const SOURCE_PATH: &str = "tests/samples/unused-key/src";

fn keys(keys: &[&str]) -> Vec<String> {
	keys.iter().map(|key| key.to_string()).collect()
}

fn options_en() -> Options {
	Options {
		target: Some("en".into()),
		..Options::default()
	}
}

fn resolved() -> ResolvedOptions {
	resolve_options(&options_en()).0
}

fn with_source(source: &str) -> Options {
	Options {
		source: Some(source.into()),
		..options_en()
	}
}

fn unused_count(result: &CheckResult) -> Option<usize> {
	result
		.issues_by_code()
		.get(&CheckCode::UnusedKey)
		.map(Vec::len)
}

fn object(value: Value) -> Map<String, Value> {
	value.as_object().cloned().unwrap_or_default()
}

// leafOfKey

#[test]
fn takes_the_last_segment() {
	assert_eq!(leaf_of_key("desc.hello"), "hello");
	assert_eq!(leaf_of_key("hello"), "hello");
	assert_eq!(leaf_of_key(""), "");
}

#[test]
fn takes_the_plural_suffix_off_since_no_source_file_writes_one() {
	assert_eq!(leaf_of_key("desc.item_one"), "item");
	assert_eq!(leaf_of_key("item_plural"), "item");
}

#[test]
fn takes_the_ordinal_infix_off_with_it() {
	assert_eq!(leaf_of_key("desc.place_ordinal_two"), "place");
}

// findUnusedKeys

#[test]
fn finds_the_key_no_source_file_mentions() {
	let scan = find_unused_keys(
		Path::new(SOURCE_PATH),
		&keys(&["desc.hello", "desc.orphan", "attr.folder"]),
		&resolved(),
		&[],
	);

	assert_eq!(scan.unused_keys, ["desc.orphan"]);
	assert_eq!(scan.scanned_file_count, 1);
}

#[test]
fn counts_a_key_referenced_by_its_leaf_alone_as_used() {
	// The source calls `t('folder')`, not `t('attr.folder')`.
	let scan = find_unused_keys(
		Path::new(SOURCE_PATH),
		&keys(&["attr.folder"]),
		&resolved(),
		&[],
	);

	assert!(scan.unused_keys.is_empty(), "{:?}", scan.unused_keys);
}

#[test]
fn reports_every_key_that_shares_an_unreferenced_leaf() {
	let mut scan = find_unused_keys(
		Path::new(SOURCE_PATH),
		&keys(&["a.orphan", "b.orphan"]),
		&resolved(),
		&[],
	);

	scan.unused_keys.sort();

	assert_eq!(scan.unused_keys, ["a.orphan", "b.orphan"]);
}

#[test]
fn does_not_read_the_files_it_was_told_to_skip() {
	let skipped = std::env::current_dir()
		.unwrap()
		.join(SOURCE_PATH)
		.join("app.ts");
	let scan = find_unused_keys(
		Path::new(SOURCE_PATH),
		&keys(&["desc.hello"]),
		&resolved(),
		&[skipped.to_string_lossy().into_owned()],
	);

	assert_eq!(scan.unused_keys, ["desc.hello"]);
	assert_eq!(scan.scanned_file_count, 0);
}

#[test]
fn returns_nothing_rather_than_failing_on_a_missing_directory() {
	let scan = find_unused_keys(
		&Path::new(SOURCE_PATH).join("nope"),
		&keys(&["a"]),
		&resolved(),
		&[],
	);

	assert_eq!(scan.unused_keys, ["a"]);
	assert_eq!(scan.scanned_file_count, 0);
}

// UNUSED_KEY

#[test]
fn reports_a_key_nothing_in_the_source_refers_to() {
	let result = check_translation_files(Some(LOCALES_PATH), &with_source(SOURCE_PATH));
	let grouped = result.issues_by_code();
	let issues = grouped
		.get(&CheckCode::UnusedKey)
		.cloned()
		.unwrap_or_default();

	assert_eq!(issues.len(), 1);
	assert_eq!(issues[0].key, "desc.orphan");
	assert_eq!(issues[0].level, Level::Info);
	// A fact about the source tree, not about one language's translation.
	assert_eq!(issues[0].locale, "");
}

#[test]
fn never_fails_a_run_on_its_own() {
	let result = check_translation_files(Some(LOCALES_PATH), &with_source(SOURCE_PATH));

	assert!(result.success);
	assert!(result.summary.info > 0);
}

#[test]
fn reports_nothing_without_a_source_directory() {
	let result = check_translation_files(Some(LOCALES_PATH), &options_en());

	assert_eq!(unused_count(&result), None);
}

#[test]
fn does_not_count_the_translation_files_themselves_as_usages() {
	// Every key appears verbatim in the file that defines it, so a scan that
	// read them would report nothing at all.
	let result =
		check_translation_files(Some(LOCALES_PATH), &with_source("tests/samples/unused-key"));

	assert_eq!(unused_count(&result), Some(1));
}

#[test]
fn accepts_an_answer_worked_out_elsewhere() {
	let mut locales: IndexMap<String, Map<String, Value>> = IndexMap::new();

	locales.insert("en".into(), object(json!({ "a": "A", "b": "B" })));
	locales.insert(
		"ko".into(),
		object(json!({ "a": "\u{3131}", "b": "\u{3134}" })),
	);

	let result = analyze_translations(
		&Input {
			locales: Some(locales),
			unused_keys: Some(keys(&["b"])),
			..Input::default()
		},
		&options_en(),
	);
	let grouped = result.issues_by_code();
	let issues = grouped
		.get(&CheckCode::UnusedKey)
		.cloned()
		.unwrap_or_default();

	assert_eq!(issues.len(), 1);
	assert_eq!(issues[0].key, "b");
}

#[test]
fn survives_a_session_reload() {
	let mut session = load_translations(Some(LOCALES_PATH), &with_source(SOURCE_PATH));

	assert_eq!(unused_count(&session.analyze()), Some(1));

	session.reload();

	assert_eq!(unused_count(&session.analyze()), Some(1));
}

#[test]
fn can_be_switched_off_like_any_other_check() {
	let result = check_translation_files(
		Some(LOCALES_PATH),
		&Options {
			ignore_checks: Some(vec!["UNUSED_KEY".into()]),
			..with_source(SOURCE_PATH)
		},
	);

	assert_eq!(unused_count(&result), None);
}
