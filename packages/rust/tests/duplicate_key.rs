use chki18n::loader::json_duplicates::{find_duplicate_json_keys, JsonDuplicateKey};
use chki18n::{
	analyze_translations, check_translation_files, create_analyzer, find_duplicate_keys,
	flatten_translations, CheckCode, Entry, Input, Level, Options, TranslationMap,
};
use indexmap::IndexMap;
use serde_json::{json, Value};

fn sample_path(name: &str) -> String {
	format!("tests/samples/{name}")
}

fn target_en() -> Options {
	Options {
		target: Some("en".into()),
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

fn duplicate(path: &str, line: usize) -> JsonDuplicateKey {
	JsonDuplicateKey {
		path: path.into(),
		line,
	}
}

// flattenTranslations

#[test]
fn writes_nested_keys_and_array_positions_as_dotted_keys() {
	let flat =
		flatten_translations(&json!({ "a": { "b": "B" }, "list": ["x", { "y": "Y" }], "e": {} }));
	let expected = json!({ "a.b": "B", "list.0": "x", "list.1.y": "Y", "e": {} });

	assert_eq!(&flat, expected.as_object().unwrap());
}

#[test]
fn keeps_a_key_with_no_name_and_one_named_proto() {
	let parsed: Value = serde_json::from_str(r#"{"": "Empty", "__proto__": "Proto"}"#).unwrap();
	let flat = flatten_translations(&parsed);
	let keys: Vec<&str> = flat.keys().map(String::as_str).collect();

	assert_eq!(keys, ["", "__proto__"]);
}

// findDuplicateKeys

#[test]
fn finds_a_nested_key_colliding_with_a_dotted_one() {
	assert_eq!(
		find_duplicate_keys(&json!({ "a": { "b": 1 }, "a.b": 2 })),
		["a.b"]
	);
}

#[test]
fn finds_an_array_index_colliding_with_a_dotted_key() {
	assert_eq!(
		find_duplicate_keys(&json!({ "a": ["x"], "a.0": "y" })),
		["a.0"]
	);
}

#[test]
fn says_nothing_about_translations_that_collide_with_nothing() {
	assert!(find_duplicate_keys(&json!({ "a": { "b": 1 }, "c": 2 })).is_empty());
	assert!(find_duplicate_keys(&json!({ "a": {}, "b": [] })).is_empty());
}

#[test]
fn treats_an_empty_object_as_a_leaf_the_way_flattening_does() {
	assert_eq!(
		find_duplicate_keys(&json!({ "a": { "b": {} }, "a.b": 1 })),
		["a.b"]
	);
}

// findDuplicateJsonKeys

#[test]
fn finds_a_key_written_twice_in_one_object() {
	assert_eq!(
		find_duplicate_json_keys(r#"{"a": 1, "a": 2}"#),
		[duplicate("a", 1)]
	);
}

#[test]
fn reports_the_line_the_second_definition_is_on() {
	let found = find_duplicate_json_keys("{\n  \"a\": 1,\n\n  \"a\": 2\n}");

	assert_eq!(found[0].line, 4);
}

#[test]
fn reports_the_path_of_a_nested_duplicate() {
	assert_eq!(
		find_duplicate_json_keys(r#"{"x": {"a": 1, "a": 2}}"#),
		[duplicate("x.a", 1)]
	);
}

#[test]
fn addresses_an_object_inside_an_array_by_its_position_as_flattening_does() {
	assert_eq!(
		find_duplicate_json_keys(r#"{"list": [{"y": 1}, {"x": 1, "x": 2}]}"#),
		[duplicate("list.1.x", 1)]
	);
}

#[test]
fn does_not_confuse_the_same_key_in_two_different_objects() {
	assert!(find_duplicate_json_keys(r#"{"x": {"a": 1}, "y": {"a": 2}}"#).is_empty());
}

#[test]
fn ignores_strings_that_only_look_like_keys() {
	assert!(find_duplicate_json_keys(r#"{"a": "b", "b": "b"}"#).is_empty());
	assert!(find_duplicate_json_keys(r#"{"a": ["k", "k"]}"#).is_empty());
}

#[test]
fn reads_escaped_quotes_as_part_of_the_string() {
	assert!(find_duplicate_json_keys(r#"{"a\"b": 1, "c": 2}"#).is_empty());
	assert_eq!(
		find_duplicate_json_keys(r#"{"a\"b": 1, "a\"b": 2}"#).len(),
		1
	);
}

#[test]
fn keeps_an_escape_in_the_key_as_it_is_written() {
	assert_eq!(
		find_duplicate_json_keys(r#"{"a\nb": 1, "a\nb": 2}"#),
		[duplicate(r"a\nb", 1)]
	);
	assert_eq!(
		find_duplicate_json_keys(r#"{"a\\": 1, "a\\": 2}"#),
		[duplicate(r"a\\", 1)]
	);
}

#[test]
fn counts_the_line_breaks_a_value_swallows_towards_the_next_key() {
	// Not valid JSON, but the scanner runs on what it is given and must not lose
	// count of where it is.
	assert_eq!(
		find_duplicate_json_keys("{\"a\": \"one\ntwo\",\n\"a\": 2}")[0].line,
		3
	);
	assert_eq!(
		find_duplicate_json_keys("{\"a\": \"one\\\ntwo\",\n\"a\": 2}")[0].line,
		3
	);
}

#[test]
fn stops_at_the_end_of_a_string_that_never_closes() {
	assert_eq!(
		find_duplicate_json_keys(r#"{"a": 1, "a"#),
		[duplicate("a", 1)]
	);
	assert!(find_duplicate_json_keys(r#"{"a": "b\"#).is_empty());
}

// DUPLICATE_KEY

#[test]
fn reports_both_a_literal_duplicate_and_a_flatten_collision() {
	let result = check_translation_files(Some(&sample_path("locales-duplicate-key")), &target_en());
	let by_code = result.issues_by_code();
	let issues = by_code
		.get(&CheckCode::DuplicateKey)
		.cloned()
		.unwrap_or_default();
	let mut keys: Vec<&str> = issues.iter().map(|issue| issue.key.as_str()).collect();

	keys.sort();

	assert!(!result.success);
	assert_eq!(keys, ["attr.folder", "desc.hello"]);
	assert_eq!(issues[0].level, Level::Error);
	assert_eq!(issues[0].locale, "en");
	assert!(issues.iter().any(|issue| issue.message.contains("line 4")));
}

#[test]
fn strips_the_locale_prefix_in_a_nested_file() {
	let result =
		check_translation_files(Some(&sample_path("locales-nested-duplicate")), &target_en());
	let by_code = result.issues_by_code();
	let issue = by_code[&CheckCode::DuplicateKey][0];

	assert_eq!(issue.key, "greeting");
	assert_eq!(issue.locale, "en");
}

#[test]
fn finds_a_collision_in_translations_passed_in_directly() {
	let result = analyze_translations(
		&Input {
			locales: Some(locales(
				json!({ "en": { "a": { "b": "x" }, "a.b": "y" }, "ko": { "a.b": "\u{3131}" } }),
			)),
			..Input::default()
		},
		&target_en(),
	);

	assert_eq!(
		result.issues_by_code()[&CheckCode::DuplicateKey][0].key,
		"a.b"
	);
}

#[test]
fn has_nothing_to_find_in_input_that_is_already_flattened() {
	let result = analyze_translations(
		&Input {
			locales: Some(locales(
				json!({ "en": { "a.b": "x" }, "ko": { "a.b": "\u{3131}" } }),
			)),
			..Input::default()
		},
		&Options {
			target: Some("en".into()),
			flattened: Some(true),
			..Options::default()
		},
	);

	assert!(!result
		.issues_by_code()
		.contains_key(&CheckCode::DuplicateKey));
}

#[test]
fn is_never_reported_by_check_entry_which_sees_one_key() {
	let issues = create_analyzer(&target_en()).check_entry(&Entry {
		key: "a.b".into(),
		values: IndexMap::from([
			("en".to_string(), json!("x")),
			("ko".to_string(), json!("\u{3131}")),
		]),
		..Entry::default()
	});

	assert!(issues
		.iter()
		.all(|issue| issue.code != CheckCode::DuplicateKey));
}

#[test]
fn can_be_switched_off_like_any_other_check() {
	let result = check_translation_files(
		Some(&sample_path("locales-duplicate-key")),
		&Options {
			target: Some("en".into()),
			ignore_checks: Some(vec!["DUPLICATE_KEY".into()]),
			..Options::default()
		},
	);

	assert!(!result
		.issues_by_code()
		.contains_key(&CheckCode::DuplicateKey));
	assert!(result.success);
}
