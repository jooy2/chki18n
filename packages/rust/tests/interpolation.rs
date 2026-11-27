use chki18n::core::interpolation::{
	detect_interpolation_delimiters, extract_interpolation_keys, Delimiters,
	INTERPOLATION_DELIMITERS,
};
use chki18n::{analyze_translations, load_translations, CheckCode, Input, Options, TranslationMap};
use indexmap::IndexMap;
use serde_json::{json, Value};

fn pair(prefix: &'static str, suffix: &'static str) -> Option<Delimiters> {
	Some(Delimiters { prefix, suffix })
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

// extractInterpolationKeys

#[test]
fn reads_the_keys_between_the_delimiters() {
	assert_eq!(
		extract_interpolation_keys("Hi {name}, {count} left", "{", "}"),
		["name", "count"]
	);
}

#[test]
fn takes_delimiters_of_different_lengths() {
	assert_eq!(
		extract_interpolation_keys("Hi %{name}", "%{", "}"),
		["name"]
	);
}

#[test]
fn finds_nothing_when_both_delimiters_are_the_same_string() {
	assert!(extract_interpolation_keys("Hi __name__", "__", "__").is_empty());
}

#[test]
fn skips_an_escaped_delimiter_and_a_doubled_one_character_delimiter() {
	assert!(extract_interpolation_keys(r"\{name} {{count}}", "{", "}").is_empty());
}

#[test]
fn skips_prose_that_only_happens_to_sit_between_the_delimiters() {
	assert_eq!(extract_interpolation_keys("{a b} {ok}", "{", "}"), ["ok"]);
}

#[test]
fn compares_translations_written_with_delimiters_of_different_lengths() {
	let result = analyze_translations(
		&Input {
			locales: Some(locales(
				json!({ "en": { "a": "Hi %{name}" }, "ko": { "a": "\u{c548}\u{b155} %{nmae}" } }),
			)),
			..Input::default()
		},
		&Options {
			target: Some("en".into()),
			interpolation_prefix: Some("%{".into()),
			interpolation_suffix: Some("}".into()),
			..Options::default()
		},
	);
	let by_code = result.issues_by_code();

	assert_eq!(
		by_code[&CheckCode::NoInterpolationKey][0]
			.interpolation
			.as_deref(),
		Some("name")
	);
}

// detectInterpolationDelimiters

#[test]
fn reads_each_pair_it_knows() {
	assert_eq!(
		detect_interpolation_delimiters("Hello {name}"),
		pair("{", "}")
	);
	assert_eq!(
		detect_interpolation_delimiters("Hello [[name]]"),
		pair("[[", "]]")
	);
	assert_eq!(
		detect_interpolation_delimiters("Hello ((name))"),
		pair("((", "))")
	);
	assert_eq!(
		detect_interpolation_delimiters("Hello <name>"),
		pair("<", ">")
	);
}

#[test]
fn reads_a_doubled_pair_as_itself_not_as_its_single_form() {
	assert_eq!(
		detect_interpolation_delimiters("Hello {{name}}"),
		pair("{{", "}}")
	);
}

#[test]
fn allows_the_spacing_a_style_may_put_inside_the_delimiters() {
	assert_eq!(
		detect_interpolation_delimiters("Hello {{ name }}"),
		pair("{{", "}}")
	);
}

#[test]
fn is_not_fooled_by_the_punctuation_of_the_json_holding_the_text() {
	assert_eq!(
		detect_interpolation_delimiters(r#"{"desc":{"hello":"Hello"}}"#),
		None
	);
	assert_eq!(
		detect_interpolation_delimiters("{\n\t\"list\": [\"a\", \"b\"]\n}"),
		None
	);
}

#[test]
fn answers_with_the_first_pair_it_believes_when_a_text_mixes_two() {
	assert_eq!(
		detect_interpolation_delimiters("{{a}} and [[b]]"),
		pair("{{", "}}")
	);
}

#[test]
fn has_nothing_to_say_about_a_text_with_no_placeholder() {
	assert_eq!(detect_interpolation_delimiters("Hello there"), None);
	assert_eq!(detect_interpolation_delimiters(""), None);
}

#[test]
fn answers_with_one_of_the_pairs_it_publishes() {
	let found = detect_interpolation_delimiters("Hello {name}");

	assert!(INTERPOLATION_DELIMITERS
		.iter()
		.any(|candidate| Some(*candidate) == found));
}

// The delimiters a scan saw

#[test]
fn reports_what_the_files_it_read_are_written_with() {
	let session = load_translations(Some("tests/samples/locales-no-issue"), &Options::default());

	assert_eq!(session.detected_interpolation(), pair("{", "}"));
	// A guess about the files, not the setting the checks ran with.
	assert_eq!(session.options().interpolation_prefix, "{");
}

#[test]
fn says_nothing_about_files_that_hold_no_placeholder() {
	let session = load_translations(Some("tests/samples/excluded-files"), &Options::default());

	assert_eq!(session.detected_interpolation(), None);
}

#[test]
fn says_nothing_when_there_was_no_directory_to_read() {
	let session = load_translations(None, &Options::default());

	assert_eq!(session.detected_interpolation(), None);
}
