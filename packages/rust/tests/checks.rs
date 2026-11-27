//! The comparison checks, one at a time.

use chki18n::core::plural::{
	plural_base_of, plural_categories_of, plural_parts_of, PluralCategory, PluralParts,
};
use chki18n::core::value::{
	extract_numbers, extract_tags, find_invisible_character, has_translatable_text, holds_script,
	script_of_locale,
};
use chki18n::{
	analyze_translations, create_analyzer, CheckCode, Entry, Input, Issue, Level, Options,
	TranslationMap,
};
use indexmap::IndexMap;
use serde_json::{json, Value};

const ZERO_WIDTH_SPACE: &str = "\u{200b}";

const NON_BREAKING_SPACE: &str = "\u{a0}";

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

fn groups_of(groups: Value) -> IndexMap<String, IndexMap<String, TranslationMap>> {
	let Value::Object(groups) = groups else {
		panic!("the groups are not an object");
	};

	groups
		.into_iter()
		.map(|(group, locales)| (group, locales_of(locales)))
		.collect()
}

/// `{ ...base, [locale]: map }`: an existing locale keeps its place.
fn with_locale(mut base: Value, locale: &str, map: Value) -> Value {
	base.as_object_mut()
		.expect("an object")
		.insert(locale.to_string(), map);
	base
}

/// Runs one check on one set of locales, which is what most of these need.
fn check_with(code: CheckCode, locales: Value, options: Options) -> Vec<Issue> {
	let options = Options {
		target: options.target.or(Some("en".into())),
		flattened: options.flattened.or(Some(true)),
		checks: options.checks.or(Some(vec![code.as_str().into()])),
		..options
	};
	let input = Input {
		locales: Some(locales_of(locales)),
		..Input::default()
	};

	analyze_translations(&input, &options)
		.issues_by_code()
		.get(&code)
		.map(|issues| issues.iter().map(|issue| (*issue).clone()).collect())
		.unwrap_or_default()
}

fn check(code: CheckCode, locales: Value) -> Vec<Issue> {
	check_with(code, locales, Options::default())
}

mod no_locale {
	use super::*;

	#[test]
	fn finds_the_language_a_group_is_missing_entirely() {
		let input = Input {
			groups: Some(groups_of(json!({
				"common.json": {
					"en": { "title": "Folder" },
					"ko": { "title": "\u{d3f4}\u{b354}" },
					"ja": { "title": "\u{30d5}\u{30a9}\u{30eb}\u{30c0}" }
				},
				"errors.json": { "en": { "missing": "Not found" }, "ko": { "missing": "\u{c5c6}\u{c74c}" } }
			}))),
			..Input::default()
		};
		let result = analyze_translations(
			&input,
			&Options {
				target: Some("en".into()),
				checks: Some(vec!["NO_LOCALE".into()]),
				..Options::default()
			},
		);
		let by_code = result.issues_by_code();
		let issues = by_code
			.get(&CheckCode::NoLocale)
			.cloned()
			.unwrap_or_default();

		assert_eq!(issues.len(), 1);
		assert_eq!(issues[0].locale, "ja");
		assert_eq!(issues[0].group, "errors.json");
		assert_eq!(issues[0].key, "");
		assert!(!result.success);
	}

	#[test]
	fn says_nothing_when_every_group_has_every_language() {
		let input = Input {
			groups: Some(groups_of(json!({
				"a": { "en": { "x": "X" }, "ko": { "x": "\u{3131}" } },
				"b": { "en": { "y": "Y" }, "ko": { "y": "\u{3134}" } }
			}))),
			..Input::default()
		};
		let result = analyze_translations(
			&input,
			&Options {
				target: Some("en".into()),
				checks: Some(vec!["NO_LOCALE".into()]),
				..Options::default()
			},
		);

		assert!(result.issues.is_empty(), "{:?}", result.issues);
	}

	#[test]
	fn cannot_fire_on_a_single_group_where_every_language_is_in_it() {
		let issues = check(
			CheckCode::NoLocale,
			json!({ "en": { "a": "A" }, "ko": { "a": "\u{3131}" } }),
		);

		assert_eq!(issues.len(), 0);
	}
}

mod interpolation_count {
	use super::*;

	#[test]
	fn finds_a_placeholder_used_fewer_times_than_the_target_language_uses_it() {
		let issues = check(
			CheckCode::InterpolationCount,
			json!({
				"en": { "a": "{name} invited {name}" },
				"ko": { "a": "{name}\u{b2d8}\u{c774} \u{cd08}\u{b300}\u{d588}\u{c2b5}\u{b2c8}\u{b2e4}" }
			}),
		);

		assert_eq!(issues.len(), 1);
		assert_eq!(issues[0].interpolation.as_deref(), Some("name"));
		assert!(issues[0].message.contains("1 time here and 2 times"));
	}

	#[test]
	fn finds_one_used_more_times_as_well() {
		let issues = check(
			CheckCode::InterpolationCount,
			json!({
				"en": { "a": "Hello {name}" },
				"ko": { "a": "{name}\u{b2d8} \u{c548}\u{b155}\u{d558}\u{c138}\u{c694} {name}\u{b2d8}" }
			}),
		);

		assert_eq!(issues.len(), 1);
	}

	#[test]
	fn leaves_a_placeholder_that_is_simply_absent_to_the_other_checks() {
		let issues = check(
			CheckCode::InterpolationCount,
			json!({ "en": { "a": "Hello {name}" }, "ko": { "a": "\u{c548}\u{b155}\u{d558}\u{c138}\u{c694}" } }),
		);

		assert_eq!(issues.len(), 0);
	}

	#[test]
	fn says_nothing_when_the_counts_agree() {
		let issues = check(
			CheckCode::InterpolationCount,
			json!({ "en": { "a": "{a} and {a} and {b}" }, "ko": { "a": "{b}, {a}, {a}" } }),
		);

		assert_eq!(issues.len(), 0);
	}
}

mod tag_mismatch {
	use super::*;

	#[test]
	fn reports_every_missing_tag_as_one_finding() {
		let issues = check(
			CheckCode::TagMismatch,
			json!({
				"en": { "a": "Click <b>here</b> to continue" },
				"ko": { "a": "\u{acc4}\u{c18d}\u{d558}\u{b824}\u{ba74} \u{c5ec}\u{ae30}\u{b97c} \u{b204}\u{b974}\u{c138}\u{c694}" }
			}),
		);

		assert_eq!(issues.len(), 1);
		assert!(issues[0].message.contains("`<b>` and `</b>`"));
	}

	#[test]
	fn reports_a_tag_the_target_language_does_not_have() {
		let issues = check(
			CheckCode::TagMismatch,
			json!({ "en": { "a": "Plain text" }, "ko": { "a": "<i>\u{ae30}\u{c6b8}\u{c784}</i>" } }),
		);

		assert_eq!(issues.len(), 1);
		assert!(issues[0].message.contains("not in the target language"));
	}

	#[test]
	fn counts_the_tags_rather_than_only_looking_for_them() {
		let issues = check(
			CheckCode::TagMismatch,
			json!({ "en": { "a": "<b>one</b> and <b>two</b>" }, "ko": { "a": "<b>\u{d558}\u{b098}</b>\u{c640} \u{b458}" } }),
		);

		assert_eq!(issues.len(), 1);
		assert!(issues[0].message.contains("1 time of 2"));
	}

	#[test]
	fn reads_a_tag_name_whatever_its_case() {
		let issues = check(
			CheckCode::TagMismatch,
			json!({ "en": { "a": "<B>Bold</B>" }, "ko": { "a": "<b>\u{ad75}\u{ac8c}</b>" } }),
		);

		assert_eq!(issues.len(), 0);
	}

	#[test]
	fn does_not_mistake_a_comparison_for_markup() {
		let issues = check(
			CheckCode::TagMismatch,
			json!({
				"en": { "a": "Use a < b to compare" },
				"ko": { "a": "\u{be44}\u{ad50}\u{d558}\u{b824}\u{ba74} a < b \u{b97c} \u{c4f0}\u{c138}\u{c694}" }
			}),
		);

		assert_eq!(issues.len(), 0);
	}
}

mod untranslated_script {
	use super::*;

	#[test]
	fn finds_a_korean_value_written_without_a_korean_character() {
		let issues = check(
			CheckCode::UntranslatedScript,
			json!({ "en": { "a": "Hello" }, "ko": { "a": "Hello!" } }),
		);

		assert_eq!(issues.len(), 1);
		assert_eq!(issues[0].locale, "ko");
	}

	#[test]
	fn leaves_a_value_identical_to_the_target_to_the_untranslated_check() {
		let issues = check(
			CheckCode::UntranslatedScript,
			json!({ "en": { "a": "Hello" }, "ko": { "a": "Hello" } }),
		);

		assert_eq!(issues.len(), 0);
	}

	#[test]
	fn says_nothing_about_a_language_written_in_the_latin_alphabet() {
		let issues = check(
			CheckCode::UntranslatedScript,
			json!({ "en": { "a": "Hello" }, "fr": { "a": "Salut !" } }),
		);

		assert_eq!(issues.len(), 0);
	}

	#[test]
	fn says_nothing_about_a_locale_that_names_the_latin_script_itself() {
		let issues = check(
			CheckCode::UntranslatedScript,
			json!({ "en": { "a": "Hello" }, "sr-Latn": { "a": "Zdravo" } }),
		);

		assert_eq!(issues.len(), 0);
	}

	#[test]
	fn leaves_a_value_that_is_only_a_placeholder_or_a_number_alone() {
		let issues = check(
			CheckCode::UntranslatedScript,
			json!({
				"en": { "a": "{count}", "b": "2026" },
				"ko": { "a": "{count}", "b": "2026" }
			}),
		);

		assert_eq!(issues.len(), 0);
	}
}

mod inconsistent_value {
	use super::*;

	#[test]
	fn finds_two_keys_with_one_original_translated_two_ways() {
		let issues = check(
			CheckCode::InconsistentValue,
			json!({
				"en": { "save-a": "Save", "save-b": "Save" },
				"ko": { "save-a": "\u{c800}\u{c7a5}", "save-b": "\u{bcf4}\u{ad00}" }
			}),
		);

		assert_eq!(issues.len(), 1);
		assert_eq!(issues[0].key, "save-b");
		assert_eq!(issues[0].related_key.as_deref(), Some("save-a"));
		assert_eq!(issues[0].locale, "ko");
	}

	#[test]
	fn says_nothing_when_the_two_agree() {
		let issues = check(
			CheckCode::InconsistentValue,
			json!({ "en": { "a": "Save", "b": "Save" }, "ko": { "a": "\u{c800}\u{c7a5}", "b": "\u{c800}\u{c7a5}" } }),
		);

		assert_eq!(issues.len(), 0);
	}

	#[test]
	fn leaves_a_key_the_locale_has_not_filled_in_to_the_other_checks() {
		let issues = check(
			CheckCode::InconsistentValue,
			json!({ "en": { "a": "Save", "b": "Save" }, "ko": { "a": "\u{c800}\u{c7a5}" } }),
		);

		assert_eq!(issues.len(), 0);
	}
}

mod invisible_character {
	use super::*;

	#[test]
	fn finds_a_zero_width_space_and_names_it() {
		let issues = check(
			CheckCode::InvisibleCharacter,
			json!({ "en": { "a": "Ready" }, "ko": { "a": format!("\u{c900}{ZERO_WIDTH_SPACE}\u{be44}") } }),
		);

		assert_eq!(issues.len(), 1);
		assert!(issues[0].message.contains("zero width space"));
		assert!(issues[0].message.contains("U+200B"));
	}

	#[test]
	fn finds_a_non_breaking_space_which_looks_like_an_ordinary_one() {
		let issues = check(
			CheckCode::InvisibleCharacter,
			json!({ "en": { "a": "A B" }, "ko": { "a": format!("\u{ac00}{NON_BREAKING_SPACE}\u{b098}") } }),
		);

		assert_eq!(issues.len(), 1);
	}

	#[test]
	fn says_nothing_about_ordinary_text() {
		let issues = check(
			CheckCode::InvisibleCharacter,
			json!({ "en": { "a": "Ready" }, "ko": { "a": "\u{c900}\u{be44}\u{b428}" } }),
		);

		assert_eq!(issues.len(), 0);
	}
}

mod not_translated_value {
	use super::*;

	#[test]
	fn reports_a_value_left_in_the_target_language() {
		let issues = check(
			CheckCode::NotTranslatedValue,
			json!({ "en": { "a": "Save" }, "ko": { "a": "Save" } }),
		);

		assert_eq!(issues.len(), 1);
	}

	#[test]
	fn says_nothing_about_a_value_with_no_word_to_translate() {
		let issues = check(
			CheckCode::NotTranslatedValue,
			json!({
				"en": { "count": "{count}", "percent": "100%", "code": "12345", "link": "<b>{name}</b>" },
				"ko": { "count": "{count}", "percent": "100%", "code": "12345", "link": "<b>{name}</b>" }
			}),
		);

		assert!(issues.is_empty(), "{issues:?}");
	}
}

mod number_mismatch {
	use super::*;

	#[test]
	fn finds_a_number_the_translation_changed() {
		let issues = check(
			CheckCode::NumberMismatch,
			json!({ "en": { "a": "You have 3 items" }, "ko": { "a": "5\u{ac1c} \u{c788}\u{c2b5}\u{b2c8}\u{b2e4}" } }),
		);

		assert_eq!(issues.len(), 1);
		assert!(issues[0].message.contains("uses 3"));
	}

	#[test]
	fn accepts_numbers_the_translation_reordered() {
		let issues = check(
			CheckCode::NumberMismatch,
			json!({ "en": { "a": "3 of 5" }, "ko": { "a": "5 \u{c911} 3" } }),
		);

		assert_eq!(issues.len(), 0);
	}

	#[test]
	fn leaves_a_translation_with_no_digits_at_all_to_missing_number() {
		let issues = check(
			CheckCode::NumberMismatch,
			json!({ "en": { "a": "You have 3 items" }, "ko": { "a": "\u{c5ec}\u{b7ec} \u{ac1c} \u{c788}\u{c2b5}\u{b2c8}\u{b2e4}" } }),
		);

		assert_eq!(issues.len(), 0);
	}

	#[test]
	fn tells_a_padded_number_from_a_bare_one() {
		let issues = check(
			CheckCode::NumberMismatch,
			json!({ "en": { "a": "Step 3" }, "ko": { "a": "03 \u{b2e8}\u{acc4}" } }),
		);

		assert_eq!(issues.len(), 1);
	}

	#[test]
	fn reads_the_same_number_in_the_digits_of_the_translations_own_script() {
		let locales = json!({
			"en": { "a": "Step 3 of 5" },
			"ar": { "a": "\u{627}\u{644}\u{62e}\u{637}\u{648}\u{629} \u{663} \u{645}\u{646} \u{665}" },
			"ja": { "a": "\u{30b9}\u{30c6}\u{30c3}\u{30d7}\u{ff13}\u{ff0f}\u{ff15}" },
			"hi": { "a": "\u{91a}\u{930}\u{923} \u{969} / \u{96b}" }
		});

		assert_eq!(check(CheckCode::NumberMismatch, locales.clone()).len(), 0);
		assert_eq!(check(CheckCode::MissingNumber, locales).len(), 0);
	}

	#[test]
	fn quotes_a_changed_number_the_way_the_translation_writes_it() {
		let issues = check(
			CheckCode::NumberMismatch,
			json!({ "en": { "a": "Step 3" }, "ar": { "a": "\u{627}\u{644}\u{62e}\u{637}\u{648}\u{629} \u{664}" } }),
		);

		assert_eq!(
			issues[0].message,
			"The target language uses 3 and this value uses \u{664}."
		);
	}
}

mod suspicious_length {
	use super::*;

	const LONG: &str = "Please choose the folder you would like to upload";

	fn ratio(ratio: &str) -> Options {
		Options {
			length_ratio: Some(ratio.into()),
			..Options::default()
		}
	}

	#[test]
	fn reports_nothing_until_length_ratio_says_what_is_too_far() {
		let issues = check(
			CheckCode::SuspiciousLength,
			json!({ "en": { "a": LONG }, "ko": { "a": "\u{d3f4}\u{b354}" } }),
		);

		assert_eq!(issues.len(), 0);
	}

	#[test]
	fn finds_a_translation_far_shorter_than_its_original() {
		let issues = check_with(
			CheckCode::SuspiciousLength,
			json!({ "en": { "a": LONG }, "ko": { "a": "\u{d3f4}\u{b354}" } }),
			ratio("3"),
		);

		assert_eq!(issues.len(), 1);
		assert_eq!(issues[0].level, Level::Info);
	}

	#[test]
	fn finds_one_far_longer_as_well() {
		let issues = check_with(
			CheckCode::SuspiciousLength,
			json!({
				"en": { "a": "Upload a file" },
				"ko": { "a": "\u{d30c}\u{c77c}\u{c744} \u{d558}\u{b098} \u{c62c}\u{b9ac}\u{b294} \u{bc29}\u{bc95}\u{c5d0} \u{b300}\u{d55c} \u{c544}\u{c8fc} \u{ae34} \u{c124}\u{ba85}\u{c785}\u{b2c8}\u{b2e4}" }
			}),
			ratio("2"),
		);

		assert_eq!(issues.len(), 1);
	}

	#[test]
	fn counts_a_wide_character_as_two_so_korean_is_not_short_by_default() {
		let issues = check_with(
			CheckCode::SuspiciousLength,
			json!({ "en": { "a": "Shared folder" }, "ko": { "a": "\u{acf5}\u{c720} \u{d3f4}\u{b354}" } }),
			ratio("2"),
		);

		assert_eq!(issues.len(), 0);
	}

	#[test]
	fn leaves_a_short_original_alone_where_a_ratio_says_nothing() {
		let issues = check_with(
			CheckCode::SuspiciousLength,
			json!({ "en": { "a": "OK" }, "ko": { "a": "\u{d655}\u{c778}\u{d588}\u{c2b5}\u{b2c8}\u{b2e4}" } }),
			ratio("2"),
		);

		assert_eq!(issues.len(), 0);
	}
}

mod no_plural_form {
	use super::*;

	fn forms() -> Value {
		json!({ "en": { "item_one": "1 item", "item_other": "{count} items" } })
	}

	#[test]
	fn asks_a_language_only_for_the_forms_it_uses() {
		let issues = check(
			CheckCode::NoPluralForm,
			with_locale(forms(), "ko", json!({ "item_other": "{count}\u{ac1c}" })),
		);

		assert!(issues.is_empty(), "{issues:?}");
	}

	#[test]
	fn finds_the_forms_a_language_needs_and_does_not_have() {
		let issues = check(
			CheckCode::NoPluralForm,
			with_locale(
				forms(),
				"ru",
				json!({ "item_one": "1 \u{44d}\u{43b}\u{435}\u{43c}\u{435}\u{43d}\u{442}", "item_other": "{count} \u{44d}\u{43b}\u{435}\u{43c}\u{435}\u{43d}\u{442}\u{43e}\u{432}" }),
			),
		);

		assert_eq!(issues.len(), 1);
		assert_eq!(issues[0].locale, "ru");
		assert_eq!(issues[0].key, "item");
		assert!(issues[0].message.contains("`item_few`"));
		assert!(issues[0].message.contains("`item_many`"));
	}

	#[test]
	fn judges_the_target_language_too() {
		let issues = check(
			CheckCode::NoPluralForm,
			json!({ "en": { "item_one": "1 item" }, "ko": { "item_other": "{count}\u{ac1c}" } }),
		);

		assert_eq!(issues.len(), 1);
		assert_eq!(issues[0].locale, "en");
	}

	#[test]
	fn says_nothing_about_a_language_it_has_no_table_for() {
		let issues = check(
			CheckCode::NoPluralForm,
			with_locale(forms(), "mt", json!({ "item_one": "1 oggett" })),
		);

		assert!(issues.is_empty(), "{issues:?}");
	}

	#[test]
	fn leaves_the_older_plural_convention_as_ordinary_keys() {
		let issues = check(
			CheckCode::NoPluralForm,
			json!({ "en": { "item": "1 item", "item_plural": "{count} items" } }),
		);

		assert!(issues.is_empty(), "{issues:?}");
	}
}

mod plural_forms_and_the_keys_they_excuse {
	use super::*;

	fn ordinals() -> Value {
		json!({
			"en": {
				"place_ordinal_one": "{count}st",
				"place_ordinal_two": "{count}nd",
				"place_ordinal_few": "{count}rd",
				"place_ordinal_other": "{count}th"
			},
			"de": { "place_ordinal_other": "{count}." },
			"ru": { "place_ordinal_other": "{count}-\u{439}" }
		})
	}

	#[test]
	fn asks_a_language_for_no_ordinal_form_but_other() {
		let no_key = check(CheckCode::NoKey, ordinals());
		let no_plural_form = check(CheckCode::NoPluralForm, ordinals());
		let dummy_key = check(
			CheckCode::DummyKey,
			json!({
				"en": { "place_ordinal_other": "{count}th" },
				"ru": { "place_ordinal_other": "{count}-\u{439}", "place_ordinal_few": "{count}-\u{439}" }
			}),
		);

		assert!(no_key.is_empty(), "{no_key:?}");
		assert!(no_plural_form.is_empty(), "{no_plural_form:?}");
		assert!(dummy_key.is_empty(), "{dummy_key:?}");
	}

	#[test]
	fn still_asks_for_the_ordinal_other() {
		let issues = check(
			CheckCode::NoKey,
			with_locale(ordinals(), "de", json!({ "place_ordinal_one": "{count}." })),
		);
		let found: Vec<(&str, &str)> = issues
			.iter()
			.map(|issue| (issue.locale.as_str(), issue.key.as_str()))
			.collect();

		assert_eq!(found, [("de", "place_ordinal_other")]);
	}

	#[test]
	fn does_not_ask_a_language_for_a_form_it_never_uses() {
		let issues = check(
			CheckCode::NoKey,
			json!({
				"en": { "item_one": "1 item", "item_other": "{count} items" },
				"ko": { "item_other": "{count}\u{ac1c}" }
			}),
		);

		assert!(issues.is_empty(), "{issues:?}");
	}

	#[test]
	fn still_asks_for_the_forms_the_language_does_use() {
		let issues = check(
			CheckCode::NoKey,
			json!({
				"en": { "item_one": "1 item", "item_other": "{count} items" },
				"ko": { "item_one": "1\u{ac1c}" }
			}),
		);

		assert_eq!(issues.len(), 1);
		assert_eq!(issues[0].key, "item_other");
	}

	#[test]
	fn does_not_call_a_form_the_target_has_no_use_for_a_stray_key() {
		let issues = check(
			CheckCode::DummyKey,
			json!({
				"ko": { "item_other": "{count}\u{ac1c}" },
				"ru": { "item_other": "{count}", "item_few": "{count} \u{44d}\u{43b}\u{435}\u{43c}\u{435}\u{43d}\u{442}\u{430}" }
			}),
		);

		assert!(issues.is_empty(), "{issues:?}");
	}

	#[test]
	fn leaves_a_language_it_has_no_table_for_exactly_as_it_was() {
		let issues = check(
			CheckCode::NoKey,
			json!({
				"en": { "item_one": "1 item", "item_other": "{count} items" },
				"mt": { "item_one": "1 oggett" }
			}),
		);

		assert_eq!(issues.len(), 1);
		assert_eq!(issues[0].key, "item_other");
	}
}

mod the_plural_primitives {
	use super::*;

	#[test]
	fn reads_the_form_a_suffixed_key_names() {
		assert_eq!(
			plural_parts_of("item_one"),
			Some(PluralParts {
				base: "item",
				category: PluralCategory::One
			})
		);
		assert_eq!(plural_parts_of("item"), None);
		assert_eq!(plural_parts_of("item_plural"), None);
		assert_eq!(plural_parts_of("_one"), None);
	}

	#[test]
	fn reads_the_base_of_either_plural_convention() {
		assert_eq!(plural_base_of("item_one"), Some("item"));
		assert_eq!(plural_base_of("item_plural"), Some("item"));
		assert_eq!(plural_base_of("item"), None);
	}

	#[test]
	fn knows_what_each_language_needs_and_admits_what_it_does_not_know() {
		use PluralCategory::{Few, Many, One, Other};

		assert_eq!(plural_categories_of("ko"), Some(&[Other][..]));
		assert_eq!(plural_categories_of("en-GB"), Some(&[One, Other][..]));
		assert_eq!(
			plural_categories_of("ru"),
			Some(&[One, Few, Many, Other][..])
		);
		assert_eq!(plural_categories_of("mt"), None);
	}
}

mod key_naming {
	use super::*;

	fn keys(options: Options) -> Vec<Issue> {
		check_with(
			CheckCode::KeyNaming,
			json!({ "en": { "attr-folder": "A", "badKey_Name": "B" } }),
			options,
		)
	}

	fn kebab() -> Options {
		Options {
			key_case: Some("kebab".into()),
			..Options::default()
		}
	}

	#[test]
	fn reports_nothing_until_key_case_says_what_the_project_uses() {
		assert_eq!(keys(Options::default()).len(), 0);
	}

	#[test]
	fn finds_the_key_that_is_not_written_in_the_chosen_case() {
		let issues = keys(kebab());

		assert_eq!(issues.len(), 1);
		assert_eq!(issues[0].key, "badKey_Name");
		assert_eq!(issues[0].locale, "");
	}

	#[test]
	fn judges_every_level_of_a_nested_key() {
		let issues = check_with(
			CheckCode::KeyNaming,
			json!({ "en": { "attr.badName": "A" } }),
			kebab(),
		);

		assert_eq!(issues.len(), 1);
		assert!(issues[0].message.contains("`badName`"));
	}

	#[test]
	fn accepts_the_plural_suffix_an_i18n_library_appends() {
		let issues = check_with(
			CheckCode::KeyNaming,
			json!({ "en": { "item-count_one": "A" } }),
			kebab(),
		);

		assert_eq!(issues.len(), 0);
	}

	#[test]
	fn reports_a_key_once_however_many_parts_of_it_are_wrong() {
		let issues = check_with(
			CheckCode::KeyNaming,
			json!({ "en": { "Bad.Worse": "A" } }),
			kebab(),
		);

		assert_eq!(issues.len(), 1);
	}

	#[test]
	fn accepts_camel_case_when_that_is_what_was_asked_for() {
		let issues = check_with(
			CheckCode::KeyNaming,
			json!({ "en": { "attrFolder": "A" } }),
			Options {
				key_case: Some("camel".into()),
				..Options::default()
			},
		);

		assert_eq!(issues.len(), 0);
	}
}

mod key_depth {
	use super::*;

	#[test]
	fn reports_nothing_until_max_key_depth_says_how_deep_is_too_deep() {
		assert_eq!(
			check(CheckCode::KeyDepth, json!({ "en": { "a.b.c.d": "A" } })).len(),
			0
		);
	}

	#[test]
	fn finds_the_key_nested_past_the_limit() {
		let issues = check_with(
			CheckCode::KeyDepth,
			json!({ "en": { "a.b.c.d": "A", "a.b": "B" } }),
			Options {
				max_key_depth: Some("2".into()),
				..Options::default()
			},
		);

		assert_eq!(issues.len(), 1);
		assert_eq!(issues[0].key, "a.b.c.d");
		assert!(issues[0].message.contains("4 levels deep"));
	}
}

mod check_entry {
	use super::*;

	#[test]
	fn answers_the_checks_a_single_key_can_answer() {
		let analyzer = create_analyzer(&Options {
			target: Some("en".into()),
			key_case: Some("kebab".into()),
			max_key_depth: Some("1".into()),
			..Options::default()
		});
		let issues = analyzer.check_entry(&Entry {
			key: "badName".into(),
			values: IndexMap::from([
				("en".to_string(), json!("{a} and {a}")),
				("ko".to_string(), json!("{a}")),
			]),
			..Entry::default()
		});
		let codes: Vec<CheckCode> = issues.iter().map(|issue| issue.code).collect();

		assert!(codes.contains(&CheckCode::KeyNaming));
		assert!(codes.contains(&CheckCode::InterpolationCount));
	}
}

mod the_value_primitives {
	use super::*;

	#[test]
	fn reads_markup_tags_as_they_were_written() {
		assert_eq!(extract_tags("a <b>c</b> <br/>"), ["<b>", "</b>", "<br/>"]);
		assert!(extract_tags("no markup here").is_empty());
	}

	#[test]
	fn keeps_a_padded_number_apart_from_a_bare_one() {
		assert_eq!(extract_numbers("Step 03 of 5"), ["03", "5"]);
	}

	#[test]
	fn finds_the_first_character_nothing_will_draw() {
		assert_eq!(
			find_invisible_character(&format!("ab{ZERO_WIDTH_SPACE}c")),
			ZERO_WIDTH_SPACE.chars().next()
		);
		assert_eq!(find_invisible_character("plain"), None);
	}

	#[test]
	fn knows_which_script_a_language_is_written_in() {
		assert!(script_of_locale("ko").is_some_and(|script| holds_script("\u{ac00}", script)));
		assert!(script_of_locale("ja-JP").is_some_and(|script| holds_script("\u{3042}", script)));
		assert!(script_of_locale("en").is_none());
		assert!(script_of_locale("sr-Latn").is_none());
	}

	#[test]
	fn does_not_count_a_placeholder_or_a_tag_as_words_of_its_own() {
		assert!(!has_translatable_text("{name}", "{", "}"));
		assert!(!has_translatable_text("<br/>", "{", "}"));
		assert!(has_translatable_text("Hi {name}", "{", "}"));
	}
}

mod the_target_language {
	use super::*;

	/// Every check, so the ones that must stay quiet are given the chance to fire.
	fn check_all_with(locales: Value, options: Options) -> Vec<Issue> {
		let options = Options {
			target: Some("en".into()),
			flattened: Some(true),
			..options
		};
		let input = Input {
			locales: Some(locales_of(locales)),
			..Input::default()
		};

		analyze_translations(&input, &options)
			.issues
			.into_iter()
			.filter(|issue| issue.locale == "en")
			.collect()
	}

	fn check_all(locales: Value) -> Vec<Issue> {
		check_all_with(locales, Options::default())
	}

	#[test]
	fn reports_an_empty_value_of_its_own() {
		let issues = check_all(
			json!({ "en": { "a": "" }, "ko": { "a": "\u{be44}\u{c5b4} \u{c788}\u{c74c}" } }),
		);

		assert_eq!(issues.len(), 1);
		assert_eq!(issues[0].code, CheckCode::EmptyValue);
	}

	#[test]
	fn reports_the_whitespace_around_a_value_of_its_own() {
		let issues =
			check_all(json!({ "en": { "a": "Save " }, "ko": { "a": "\u{c800}\u{c7a5}" } }));

		assert_eq!(issues.len(), 1);
		assert_eq!(issues[0].code, CheckCode::SurroundingWhitespace);
	}

	#[test]
	fn reports_a_character_of_its_own_that_nothing_will_draw() {
		let issues = check_all(
			json!({ "en": { "a": format!("Sign{ZERO_WIDTH_SPACE}in") }, "ko": { "a": "\u{b85c}\u{adf8}\u{c778}" } }),
		);

		assert_eq!(issues.len(), 1);
		assert_eq!(issues[0].code, CheckCode::InvisibleCharacter);
		assert!(issues[0].message.contains("zero width space"));
	}

	#[test]
	fn reports_a_value_of_its_own_that_is_not_a_string() {
		let issues = check_all(json!({ "en": { "a": 42 }, "ko": { "a": "42" } }));

		assert_eq!(issues.len(), 1);
		assert_eq!(issues[0].code, CheckCode::InvalidValueType);
	}

	#[test]
	fn quotes_a_value_that_is_not_a_string_the_way_json_writes_it() {
		let issues = check_all(json!({ "en": { "a": {}, "b": [] }, "ko": { "a": "A", "b": "B" } }));
		let found: Vec<(Option<&str>, &str)> = issues
			.iter()
			.map(|issue| (issue.value.as_deref(), issue.message.as_str()))
			.collect();

		assert_eq!(
			found,
			[
				(
					Some("{}"),
					"The value is an `object`, not a translatable string."
				),
				(
					Some("[]"),
					"The value is an `object`, not a translatable string."
				),
			]
		);
	}

	#[test]
	fn reports_a_value_of_its_own_written_in_the_wrong_script() {
		let input = Input {
			locales: Some(locales_of(
				json!({ "ko": { "a": "Hello" }, "en": { "a": "Hello" } }),
			)),
			..Input::default()
		};
		let issues = analyze_translations(
			&input,
			&Options {
				target: Some("ko".into()),
				flattened: Some(true),
				checks: Some(vec!["UNTRANSLATED_SCRIPT".into()]),
				..Options::default()
			},
		)
		.issues;

		assert_eq!(issues.len(), 1);
		assert_eq!(issues[0].locale, "ko");
		assert_eq!(issues[0].code, CheckCode::UntranslatedScript);
	}

	#[test]
	fn quotes_nothing_beside_a_finding_of_its_own_having_nothing_to_compare_it_to() {
		let issues =
			check_all(json!({ "en": { "a": "Save " }, "ko": { "a": "\u{c800}\u{c7a5}" } }));

		assert_eq!(issues[0].target_value, None);
		assert_eq!(issues[0].value.as_deref(), Some("Save "));
	}

	#[test]
	fn never_disagrees_with_itself_whatever_the_value_holds() {
		let issues = check_all_with(
			json!({
				"en": { "a": "Hello <b>{name}</b>, you have 3 of {count}" },
				"ko": { "a": "\u{c548}\u{b155}\u{d558}\u{c138}\u{c694} <b>{name}</b>\u{b2d8}, {count} \u{c911} 3\u{ac1c}\u{ac00} \u{c788}\u{c2b5}\u{b2c8}\u{b2e4}" }
			}),
			Options {
				length_ratio: Some("2".into()),
				..Options::default()
			},
		);

		assert!(issues.is_empty(), "{issues:?}");
	}

	#[test]
	fn is_still_what_the_other_locales_are_compared_against() {
		let input = Input {
			locales: Some(locales_of(
				json!({ "en": { "a": "Save " }, "ko": { "a": "Save " } }),
			)),
			..Input::default()
		};
		let result = analyze_translations(
			&input,
			&Options {
				target: Some("en".into()),
				flattened: Some(true),
				..Options::default()
			},
		);
		let locales: Vec<&str> = result
			.issues
			.iter()
			.filter(|issue| issue.code == CheckCode::SurroundingWhitespace)
			.map(|issue| issue.locale.as_str())
			.collect();

		assert_eq!(locales, ["en", "ko"]);
		assert!(result
			.issues
			.iter()
			.any(|issue| issue.code == CheckCode::NotTranslatedValue && issue.locale == "ko"));
	}

	#[test]
	fn can_be_silenced_like_any_other_locale_by_switching_the_check_off() {
		let issues = check_all_with(
			json!({ "en": { "a": "" }, "ko": { "a": "\u{be44}\u{c5b4} \u{c788}\u{c74c}" } }),
			Options {
				ignore_checks: Some(vec!["EMPTY_VALUE".into()]),
				..Options::default()
			},
		);

		assert!(issues.is_empty(), "{issues:?}");
	}
}
