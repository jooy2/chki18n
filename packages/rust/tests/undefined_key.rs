use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use chki18n::{
	analyze_translations, check_translation_files, find_unused_keys, resolve_options, CheckCode,
	CheckResult, Input, KeyUsage, Options, UsageScan,
};
use indexmap::IndexMap;
use serde_json::{json, Map, Value};

const LOCALES_PATH: &str = "tests/samples/undefined-key/locales";

const SOURCE_PATH: &str = "tests/samples/undefined-key/src";

const KEYS: [&str; 4] = ["desc.hello", "attr.folder", "item_one", "item_other"];

fn strings(items: &[&str]) -> Vec<String> {
	items.iter().map(|item| item.to_string()).collect()
}

fn options_en() -> Options {
	Options {
		target: Some("en".into()),
		..Options::default()
	}
}

fn scan_in(source: &Path, keys: &[&str], options: Options) -> UsageScan {
	let (resolved, _) = resolve_options(&Options {
		target: Some("en".into()),
		..options
	});

	find_unused_keys(source, &strings(keys), &resolved, &[])
}

fn scan(options: Options) -> UsageScan {
	scan_in(Path::new(SOURCE_PATH), &KEYS, options)
}

fn asked_for(undefined_keys: &[KeyUsage]) -> Vec<&str> {
	undefined_keys
		.iter()
		.map(|usage| usage.key.as_str())
		.collect()
}

fn ends_with(usage: &KeyUsage, name: &str) -> bool {
	usage
		.file
		.as_deref()
		.is_some_and(|file| file.ends_with(name))
}

static NEXT_DIR: AtomicUsize = AtomicUsize::new(0);

/// A directory of its own under the system's, removed when the test ends
/// however it ends.
struct TempDir(PathBuf);

impl TempDir {
	fn new(prefix: &str) -> TempDir {
		let nanos = SystemTime::now()
			.duration_since(UNIX_EPOCH)
			.map_or(0, |elapsed| elapsed.as_nanos());
		let path = std::env::temp_dir().join(format!(
			"{prefix}{}-{nanos}-{}",
			std::process::id(),
			NEXT_DIR.fetch_add(1, Ordering::Relaxed)
		));

		fs::create_dir_all(&path).unwrap();

		TempDir(path)
	}
}

impl Drop for TempDir {
	fn drop(&mut self) {
		fs::remove_dir_all(&self.0).ok();
	}
}

fn checked(options: Options) -> CheckResult {
	check_translation_files(
		Some(LOCALES_PATH),
		&Options {
			checks: Some(vec![CheckCode::UndefinedKey.as_str().into()]),
			..options
		},
	)
}

fn undefined_issues(result: &CheckResult) -> Vec<chki18n::Issue> {
	result
		.issues_by_code()
		.get(&CheckCode::UndefinedKey)
		.map(|issues| issues.iter().map(|issue| (*issue).clone()).collect())
		.unwrap_or_default()
}

// findUnusedKeys, on the keys the source asks for

#[test]
fn reports_a_key_no_language_file_defines() {
	let UsageScan { undefined_keys, .. } = scan(Options::default());

	assert_eq!(asked_for(&undefined_keys), ["attr.missing"]);
	assert!(ends_with(&undefined_keys[0], "app.ts"));
}

#[test]
fn names_the_first_file_in_name_order_that_asks_for_a_key() {
	let dir = TempDir::new("chki18n-order-");

	for name in ["b.ts", "c.ts", "a.ts"] {
		fs::write(dir.0.join(name), "t('nowhere.defined');").unwrap();
	}

	let UsageScan { undefined_keys, .. } = scan_in(&dir.0, &KEYS, Options::default());

	assert_eq!(undefined_keys.len(), 1);
	assert!(ends_with(&undefined_keys[0], "a.ts"), "{undefined_keys:?}");
}

#[test]
fn reads_a_key_through_the_namespace_written_in_front_of_it() {
	let UsageScan { undefined_keys, .. } = scan(Options::default());

	// `t('common:desc.hello')` names a namespace and a key that does exist.
	assert!(!undefined_keys
		.iter()
		.any(|usage| usage.key.contains("common")));
}

#[test]
fn leaves_a_key_built_at_run_time_alone() {
	let UsageScan { undefined_keys, .. } = scan(Options::default());

	assert!(!undefined_keys
		.iter()
		.any(|usage| usage.key.starts_with("error.")));
}

#[test]
fn counts_a_key_reached_through_a_prefix_as_defined() {
	let UsageScan { undefined_keys, .. } = scan(Options::default());

	// `t('folder')` resolves to `attr.folder` through a bound prefix.
	assert!(!undefined_keys.iter().any(|usage| usage.key == "folder"));
}

#[test]
fn counts_a_run_of_whole_segments_as_defined_and_nothing_shorter() {
	// An ordinal key is asked for by the base in front of its `_ordinal` infix,
	// so `place` is defined and `list.place_ordinal` is not.
	let dir = TempDir::new("chki18n-address-");
	let asked = [
		"menu.file.save",
		"file.save",
		"save",
		"le.save",
		"ile.save",
		"menu.file",
		".save",
		"menu.file.save.more",
		"place",
		"list.place_ordinal",
		"page.item",
	];
	let defined = [
		"menu.file.save",
		"top.list.place_ordinal_one",
		"top.list.place_ordinal_other",
		"page.item_one",
	];
	let source: Vec<String> = asked.iter().map(|key| format!("t('{key}');")).collect();

	fs::write(dir.0.join("app.ts"), source.join("\n")).unwrap();

	let UsageScan { undefined_keys, .. } = scan_in(&dir.0, &defined, Options::default());

	assert_eq!(
		asked_for(&undefined_keys),
		[
			"le.save",
			"ile.save",
			"menu.file",
			".save",
			"menu.file.save.more",
			"list.place_ordinal"
		]
	);
}

#[test]
fn counts_a_plural_key_asked_for_by_its_base_as_defined() {
	let UsageScan {
		undefined_keys,
		unused_keys,
		..
	} = scan(Options::default());

	// The source writes `t('item')`; the runtime picks `item_one`.
	assert!(!undefined_keys.iter().any(|usage| usage.key == "item"));
	assert!(unused_keys.is_empty(), "{unused_keys:?}");
}

#[test]
fn reads_the_call_names_the_project_actually_uses() {
	let UsageScan { undefined_keys, .. } = scan(Options {
		translate_functions: Some(strings(&["nothing"])),
		..Options::default()
	});

	assert!(undefined_keys.is_empty(), "{undefined_keys:?}");
}

#[test]
fn does_the_work_only_for_the_check_that_needs_it() {
	let UsageScan { undefined_keys, .. } = scan(Options {
		ignore_checks: Some(vec![CheckCode::UndefinedKey.as_str().into()]),
		..Options::default()
	});

	assert!(undefined_keys.is_empty(), "{undefined_keys:?}");
}

// UNDEFINED_KEY

#[test]
fn reports_what_the_source_asks_for_and_the_files_do_not_have() {
	let result = checked(Options {
		source: Some(SOURCE_PATH.into()),
		..options_en()
	});
	let issues = undefined_issues(&result);

	assert_eq!(issues.len(), 1);
	assert_eq!(issues[0].key, "attr.missing");
	// Not a locale's fault: no language file defines it.
	assert_eq!(issues[0].locale, "");
}

#[test]
fn reports_nothing_without_a_source_directory_to_read() {
	let result = checked(options_en());

	assert_eq!(result.issues.len(), 0, "{:?}", result.issues);
}

#[test]
fn accepts_an_answer_worked_out_elsewhere() {
	let mut locales: IndexMap<String, Map<String, Value>> = IndexMap::new();

	locales.insert(
		"en".into(),
		json!({ "a": "A" }).as_object().cloned().unwrap_or_default(),
	);

	let result = analyze_translations(
		&Input {
			locales: Some(locales),
			undefined_keys: Some(vec![KeyUsage {
				key: "b.c".into(),
				file: Some("app.ts".into()),
			}]),
			..Input::default()
		},
		&Options {
			checks: Some(vec![CheckCode::UndefinedKey.as_str().into()]),
			..options_en()
		},
	);
	let issues = undefined_issues(&result);

	assert_eq!(issues[0].key, "b.c");
	assert_eq!(issues[0].file.as_deref(), Some("app.ts"));
}

#[test]
fn never_fails_a_run_on_its_own() {
	let result = checked(Options {
		source: Some(SOURCE_PATH.into()),
		..options_en()
	});

	assert!(result.success);
	assert_eq!(result.summary.warn, 1);
}
