//! The comparison itself: every check that reads translation data.

use std::collections::{HashMap, HashSet};
use std::time::Instant;

use indexmap::{IndexMap, IndexSet};
use serde_json::Value;

use crate::constants::CheckCode;
use crate::core::chars::is_space;
use crate::core::duplicate::flatten_object;
use crate::core::interpolation::extract_interpolation_keys;
use crate::core::issue::{apply_level_overrides, create_issue, IssueInit};
use crate::core::js::{display_value, names_in_object_order, object_keys, to_fixed};
use crate::core::key::check_key_shape;
use crate::core::order::compare_text;
use crate::core::plural::{
	plural_categories_of, plural_forms_needed, plural_parts_of, uses_plural_form, PluralCategory,
};
use crate::core::result::{build_result, ResultFacts};
use crate::core::value::{
	ascii_digits_of, extract_numbers, extract_tags, find_invisible_character, has_digit,
	has_translatable_text, holds_script, name_of_invisible_character, script_of_locale,
};
use crate::core::width::display_width;
use crate::options::{resolve_options, Options, ResolvedOptions};
use crate::types::{
	CheckResult, Entry, Input, Issue, SourceFile, TranslationGroups, TranslationMap,
};

/// Below this many columns a length ratio says nothing: `OK` and its four
/// character translation are four times apart and both are correct.
const MIN_MEASURED_LENGTH: usize = 8;

fn times(count: usize) -> String {
	format!("{count} time{}", if count == 1 { "" } else { "s" })
}

/// `a`, `a and b`, `a, b and c`: a list as a sentence reads it.
fn list_of(items: &[String]) -> String {
	if items.len() < 3 {
		return items.join(" and ");
	}

	format!(
		"{} and {}",
		items[..items.len() - 1].join(", "),
		items[items.len() - 1]
	)
}

/// How often each item appears, in the order the items are first met.
fn count_of<'a>(items: &[&'a str]) -> IndexMap<&'a str, usize> {
	let mut counts = IndexMap::new();

	for item in items {
		*counts.entry(*item).or_insert(0) += 1;
	}

	counts
}

/// The same items in the same numbers, whatever order they appear in.
fn same_items(a: &[String], b: &[String]) -> bool {
	if a.len() != b.len() {
		return false;
	}

	// A translation almost always keeps the numbers in the order it found them,
	// so the answer is usually one walk.
	if a == b {
		return true;
	}

	let mut left: Vec<&String> = a.iter().collect();
	let mut right: Vec<&String> = b.iter().collect();

	left.sort_by(|x, y| compare_text(x, y));
	right.sort_by(|x, y| compare_text(x, y));

	left == right
}

/// Markup tags by their lower case spelling, keeping the first spelling seen so
/// a message can quote the tag as it was written. HTML tag names are case
/// insensitive, so `<B>` and `<b>` are the same tag.
fn count_tags<'a>(tags: &[&'a str]) -> IndexMap<String, (usize, &'a str)> {
	let mut counts: IndexMap<String, (usize, &'a str)> = IndexMap::new();

	for tag in tags {
		counts
			.entry(tag.to_lowercase())
			.and_modify(|found| found.0 += 1)
			.or_insert((1, tag));
	}

	counts
}

/// Whether a value, which is not empty, starts or ends with whitespace: what
/// `^\s|\s$` asks, answered from its two ends.
fn has_surrounding_whitespace(value: &str) -> bool {
	value.chars().next().is_some_and(is_space) || value.chars().next_back().is_some_and(is_space)
}

/// Whether each comparison check is enabled, resolved once instead of asking
/// the enabled set again for every key of every locale.
#[derive(Clone, Copy, Debug)]
struct CheckFlags {
	invalid_value_type: bool,
	no_locale: bool,
	no_key: bool,
	dummy_key: bool,
	unused_key: bool,
	undefined_key: bool,
	no_plural_form: bool,
	empty_value: bool,
	no_interpolation_key: bool,
	extra_interpolation_key: bool,
	interpolation_count: bool,
	tag_mismatch: bool,
	not_translated_value: bool,
	untranslated_script: bool,
	duplicate_value: bool,
	inconsistent_value: bool,
	surrounding_whitespace: bool,
	invisible_character: bool,
	missing_number: bool,
	number_mismatch: bool,
	suspicious_length: bool,
}

impl CheckFlags {
	fn of(enabled: &IndexSet<CheckCode>) -> CheckFlags {
		let has = |code| enabled.contains(&code);

		CheckFlags {
			invalid_value_type: has(CheckCode::InvalidValueType),
			no_locale: has(CheckCode::NoLocale),
			no_key: has(CheckCode::NoKey),
			dummy_key: has(CheckCode::DummyKey),
			unused_key: has(CheckCode::UnusedKey),
			undefined_key: has(CheckCode::UndefinedKey),
			no_plural_form: has(CheckCode::NoPluralForm),
			empty_value: has(CheckCode::EmptyValue),
			no_interpolation_key: has(CheckCode::NoInterpolationKey),
			extra_interpolation_key: has(CheckCode::ExtraInterpolationKey),
			interpolation_count: has(CheckCode::InterpolationCount),
			tag_mismatch: has(CheckCode::TagMismatch),
			not_translated_value: has(CheckCode::NotTranslatedValue),
			untranslated_script: has(CheckCode::UntranslatedScript),
			duplicate_value: has(CheckCode::DuplicateValue),
			inconsistent_value: has(CheckCode::InconsistentValue),
			surrounding_whitespace: has(CheckCode::SurroundingWhitespace),
			invisible_character: has(CheckCode::InvisibleCharacter),
			missing_number: has(CheckCode::MissingNumber),
			number_mismatch: has(CheckCode::NumberMismatch),
			suspicious_length: has(CheckCode::SuspiciousLength),
		}
	}
}

/// Fields every issue about one locale's value carries.
#[derive(Clone)]
struct IssueBase<'a> {
	locale: &'a str,
	key: &'a str,
	group: &'a str,
	file: Option<&'a String>,
	target_value: Option<&'a String>,
}

impl IssueBase<'_> {
	/// An issue of [code] about this value.
	fn issue(&self, code: CheckCode, value: Option<&str>, message: Option<String>) -> Issue {
		self.issue_with(code, value, None, message)
	}

	fn issue_with(
		&self,
		code: CheckCode,
		value: Option<&str>,
		interpolation: Option<&str>,
		message: Option<String>,
	) -> Issue {
		create_issue(
			code,
			IssueInit {
				locale: Some(self.locale.to_string()),
				key: Some(self.key.to_string()),
				group: Some(self.group.to_string()),
				file: self.file.cloned(),
				target_value: self.target_value.cloned(),
				value: value.map(str::to_string),
				interpolation: interpolation.map(str::to_string),
				message,
				..IssueInit::default()
			},
		)
	}
}

/// The file each `group locale` pair was read from.
fn build_file_paths(files: Option<&Vec<SourceFile>>) -> Option<HashMap<String, String>> {
	let files = files.filter(|files| !files.is_empty())?;

	Some(
		files
			.iter()
			.map(|file| (format!("{} {}", file.group, file.locale), file.path.clone()))
			.collect(),
	)
}

/// The file each of [locale_names] was read from in [group], in that order.
/// Resolved once per group rather than once per value.
fn files_of(
	paths: Option<&HashMap<String, String>>,
	group: &str,
	locale_names: &[String],
) -> Option<Vec<Option<String>>> {
	let paths = paths?;

	Some(
		locale_names
			.iter()
			.map(|locale| paths.get(&format!("{group} {locale}")).cloned())
			.collect(),
	)
}

/// Reports the markup a value does not carry the way the target language does.
/// Counts rather than presence: a value that opens `<b>` twice and closes it
/// once renders as broken as one that dropped the tag altogether.
fn report_tag_mismatch(
	issues: &mut Vec<Issue>,
	base: &IssueBase<'_>,
	value: &str,
	expected: &IndexMap<String, (usize, &str)>,
) {
	let found = count_tags(&extract_tags(value));

	if found.is_empty() && expected.is_empty() {
		return;
	}

	let mut missing = Vec::new();
	let mut extra = Vec::new();

	// One finding per direction rather than per tag: a dropped `<b>...</b>` is a
	// single mistake.
	for (id, (count, text)) in expected {
		let have = found.get(id).map_or(0, |found| found.0);

		if have < *count {
			missing.push(if have < 1 {
				format!("`{text}`")
			} else {
				format!("`{text}` ({} of {count})", times(have))
			});
		}
	}

	for (id, (count, text)) in &found {
		let wanted = expected.get(id).map_or(0, |expected| expected.0);

		if *count > wanted {
			extra.push(if wanted < 1 {
				format!("`{text}`")
			} else {
				format!("`{text}` ({} of {wanted})", times(*count))
			});
		}
	}

	if !missing.is_empty() {
		let one = missing.len() == 1;

		issues.push(base.issue(
			CheckCode::TagMismatch,
			Some(value),
			Some(format!(
				"The {} {} of the target language {} missing from this value.",
				if one { "tag" } else { "tags" },
				list_of(&missing),
				if one { "is" } else { "are" }
			)),
		));
	}

	if !extra.is_empty() {
		let one = extra.len() == 1;

		issues.push(base.issue(
			CheckCode::TagMismatch,
			Some(value),
			Some(format!(
				"The {} {} {} not in the target language.",
				if one { "tag" } else { "tags" },
				list_of(&extra),
				if one { "is" } else { "are" }
			)),
		));
	}
}

/// What JavaScript's `typeof` calls a value that is not a string.
fn type_name_of(value: &Value) -> &'static str {
	match value {
		Value::Number(_) => "number",
		Value::Bool(_) => "boolean",
		_ => "object",
	}
}

/// Compares one key across every locale, the target language included. What
/// that language is compared against is itself, so only the checks that read a
/// single value have anything to say about it.
#[allow(clippy::too_many_arguments)]
fn check_key_slots(
	issues: &mut Vec<Issue>,
	key: &str,
	group: &str,
	locale_names: &[String],
	values: &[Option<&Value>],
	target_index: Option<usize>,
	flags: &CheckFlags,
	options: &ResolvedOptions,
	files: Option<&[Option<String>]>,
) {
	let prefix = options.interpolation_prefix.as_str();
	let suffix = options.interpolation_suffix.as_str();
	let target_value = target_index.and_then(|index| values[index]);
	let has_target_key = target_value.is_some();
	let target_string = target_value.and_then(Value::as_str);
	let target_text = target_value.map(display_value);
	let target_interpolations: Vec<&str> = target_string.map_or_else(Vec::new, |text| {
		extract_interpolation_keys(text, prefix, suffix)
	});
	let target_has_digit = target_string.is_some_and(has_digit);
	let target_numbers: Vec<&str> = match target_string {
		Some(text) if flags.number_mismatch && target_has_digit => extract_numbers(text),
		_ => Vec::new(),
	};
	// Compared in ASCII, quoted as written.
	let target_digits: Vec<String> = target_numbers
		.iter()
		.map(|digits| ascii_digits_of(digits))
		.collect();
	// Counted once per key rather than once per locale.
	let target_tag_counts = match target_string {
		Some(text) if flags.tag_mismatch => Some(count_tags(&extract_tags(text))),
		_ => None,
	};
	let target_width = match target_string {
		Some(text) if flags.suspicious_length && options.length_ratio.is_some() => {
			display_width(text)
		}
		_ => 0,
	};
	let target_interpolation_counts = (flags.interpolation_count
		&& !target_interpolations.is_empty())
	.then(|| count_of(&target_interpolations));
	let check_interpolation =
		flags.no_interpolation_key || flags.extra_interpolation_key || flags.interpolation_count;
	// A plural key belongs to one language's grammar. Korean needs only `other`,
	// so `item_one` being absent from it is correct rather than missing.
	let plural = plural_parts_of(key);
	let mut target_has_text: Option<bool> = None;

	for (index, locale) in locale_names.iter().enumerate() {
		let is_target = Some(index) == target_index;
		let value = values[index];
		let file = files.and_then(|files| files[index].as_ref());
		// Nothing is quoted beside a finding of the target language's own: the
		// value the report already shows is the value it would be compared to.
		let base = IssueBase {
			locale,
			key,
			group,
			file,
			target_value: if is_target {
				None
			} else {
				target_text.as_ref()
			},
		};

		let Some(value) = value else {
			if has_target_key
				&& flags.no_key
				&& plural
					.as_ref()
					.is_none_or(|parts| uses_plural_form(locale, parts))
			{
				issues.push(base.issue(CheckCode::NoKey, None, None));
			}

			continue;
		};

		let text = display_value(value);

		if !has_target_key
			&& flags.dummy_key
			// The target language may simply have no use for this plural form.
			&& plural.as_ref().is_none_or(|parts| uses_plural_form(&options.target, parts))
		{
			issues.push(base.issue(CheckCode::DummyKey, Some(&text), None));
		}

		let Some(value) = value.as_str() else {
			if flags.invalid_value_type {
				let described = if value.is_null() {
					"`null`".to_string()
				} else {
					let name = type_name_of(value);

					format!("{} `{name}`", if name == "object" { "an" } else { "a" })
				};

				issues.push(base.issue(
					CheckCode::InvalidValueType,
					Some(&text),
					Some(format!(
						"The value is {described}, not a translatable string."
					)),
				));
			}

			continue;
		};

		if value.is_empty() {
			if flags.empty_value {
				issues.push(base.issue(CheckCode::EmptyValue, Some(value), None));
			}

			continue;
		}

		if flags.surrounding_whitespace && has_surrounding_whitespace(value) {
			issues.push(base.issue(CheckCode::SurroundingWhitespace, Some(value), None));
		}

		if flags.invisible_character {
			if let Some(invisible) = find_invisible_character(value) {
				issues.push(base.issue(
					CheckCode::InvisibleCharacter,
					Some(value),
					Some(format!(
						"The value holds {}, which nothing will draw.",
						name_of_invisible_character(invisible)
					)),
				));
			}
		}

		if let Some(target) = target_string {
			if !is_target {
				// A value with no word in it reads the same in every language, so
				// being the same says nothing about whether anybody translated it.
				if flags.not_translated_value
					&& value == target
					&& *target_has_text
						.get_or_insert_with(|| has_translatable_text(value, prefix, suffix))
				{
					issues.push(base.issue(CheckCode::NotTranslatedValue, Some(value), None));
				}

				if flags.missing_number && target_has_digit && !has_digit(value) {
					issues.push(base.issue(CheckCode::MissingNumber, Some(value), None));
				}

				if flags.number_mismatch && target_has_digit && has_digit(value) {
					let numbers = extract_numbers(value);
					let digits: Vec<String> = numbers
						.iter()
						.map(|digits| ascii_digits_of(digits))
						.collect();

					if !same_items(&target_digits, &digits) {
						issues.push(base.issue(
							CheckCode::NumberMismatch,
							Some(value),
							Some(format!(
								"The target language uses {} and this value uses {}.",
								target_numbers.join(", "),
								numbers.join(", ")
							)),
						));
					}
				}

				if let Some(counts) = &target_tag_counts {
					if !counts.is_empty() || value.contains('<') {
						report_tag_mismatch(issues, &base, value, counts);
					}
				}
			}

			// Which script a value is written in is a fact about that one value,
			// so the target language is asked it too.
			if flags.untranslated_script && (is_target || value != target) {
				if let Some(script) = script_of_locale(locale) {
					if !holds_script(value, script) && has_translatable_text(value, prefix, suffix)
					{
						issues.push(base.issue(CheckCode::UntranslatedScript, Some(value), None));
					}
				}
			}

			if let Some(ratio_limit) = options.length_ratio {
				if !is_target && target_width >= MIN_MEASURED_LENGTH {
					let ratio = display_width(value) as f64 / target_width as f64;

					if ratio > ratio_limit || ratio * ratio_limit < 1.0 {
						issues.push(base.issue(
							CheckCode::SuspiciousLength,
							Some(value),
							Some(format!(
								"The value is {} times the length of the target language value.",
								to_fixed(ratio, 1)
							)),
						));
					}
				}
			}
		}

		// Placeholders are compared against the target language's, so its own are
		// the reference rather than a finding.
		if is_target || !has_target_key || !check_interpolation {
			continue;
		}

		let current = extract_interpolation_keys(value, prefix, suffix);

		if flags.no_interpolation_key {
			for interpolation in &target_interpolations {
				if current.contains(interpolation) {
					continue;
				}

				issues.push(base.issue_with(
					CheckCode::NoInterpolationKey,
					Some(value),
					Some(interpolation),
					Some(format!(
						"The interpolation key `{prefix}{interpolation}{suffix}` of the target language is missing from this value."
					)),
				));
			}
		}

		if flags.extra_interpolation_key {
			for interpolation in &current {
				if target_interpolations.contains(interpolation) {
					continue;
				}

				issues.push(base.issue_with(
					CheckCode::ExtraInterpolationKey,
					Some(value),
					Some(interpolation),
					Some(format!(
						"The interpolation key `{prefix}{interpolation}{suffix}` is not defined by the target language."
					)),
				));
			}
		}

		// Only a repeated placeholder can differ in number, and the two checks
		// above already report one that is missing or unknown outright.
		let Some(expected_counts) = &target_interpolation_counts else {
			continue;
		};

		if target_interpolations.len() < 2 && current.len() < 2 {
			continue;
		}

		let current_counts = count_of(&current);

		for (interpolation, expected) in expected_counts {
			let Some(found) = current_counts.get(interpolation) else {
				continue;
			};

			if found == expected {
				continue;
			}

			issues.push(base.issue_with(
				CheckCode::InterpolationCount,
				Some(value),
				Some(interpolation),
				Some(format!(
					"The interpolation key `{prefix}{interpolation}{suffix}` is used {} here and {} in the target language.",
					times(*found),
					times(*expected)
				)),
			));
		}
	}
}

/// Reports keys of one locale that repeat a value another key already uses.
fn check_duplicate_values(
	issues: &mut Vec<Issue>,
	group: &str,
	locale_names: &[String],
	maps: &[&TranslationMap],
	own_keys: &[Vec<&String>],
	target_index: usize,
	files: Option<&[Option<String>]>,
) {
	for (index, locale) in locale_names.iter().enumerate() {
		let map = maps[index];
		let mut first_key_of_value: HashMap<&str, &str> = HashMap::new();

		for key in &own_keys[index] {
			let Some(value) = map.get(key.as_str()).and_then(Value::as_str) else {
				continue;
			};

			if value.is_empty() {
				continue;
			}

			let Some(first_key) = first_key_of_value.get(value).copied() else {
				first_key_of_value.insert(value, key);
				continue;
			};

			issues.push(create_issue(
				CheckCode::DuplicateValue,
				IssueInit {
					locale: Some(locale.clone()),
					key: Some(key.to_string()),
					group: Some(group.to_string()),
					value: Some(value.to_string()),
					target_value: maps[target_index].get(key.as_str()).map(display_value),
					related_key: Some(first_key.to_string()),
					file: files.and_then(|files| files[index].clone()),
					message: Some(format!(
						"The key `{first_key}` in the same locale already uses this value."
					)),
					..IssueInit::default()
				},
			));
		}
	}
}

/// Reports keys that share one target language string but are translated two
/// different ways: the terminology drift that turns one `Save` button into two
/// different words on two screens.
#[allow(clippy::too_many_arguments)]
fn check_inconsistent_values(
	issues: &mut Vec<Issue>,
	group: &str,
	locale_names: &[String],
	maps: &[&TranslationMap],
	own_keys: &[Vec<&String>],
	target_index: usize,
	target: &str,
	files: Option<&[Option<String>]>,
) {
	let target_map = maps[target_index];
	let mut keys_of_value: IndexMap<&str, Vec<&String>> = IndexMap::new();

	for key in &own_keys[target_index] {
		let Some(value) = target_map.get(key.as_str()).and_then(Value::as_str) else {
			continue;
		};

		if !value.is_empty() {
			keys_of_value.entry(value).or_default().push(key);
		}
	}

	for (target_value, keys) in &keys_of_value {
		if keys.len() < 2 {
			continue;
		}

		for (index, locale) in locale_names.iter().enumerate() {
			if index == target_index {
				continue;
			}

			let map = maps[index];
			let mut first: Option<(&str, &str)> = None;

			for key in keys {
				// A key this locale does not have, or has not filled in, is somebody
				// else's finding.
				let Some(value) = map.get(key.as_str()).and_then(Value::as_str) else {
					continue;
				};

				if value.is_empty() {
					continue;
				}

				let Some((first_key, first_value)) = first else {
					first = Some((key, value));
					continue;
				};

				if value == first_value {
					continue;
				}

				issues.push(create_issue(
					CheckCode::InconsistentValue,
					IssueInit {
						locale: Some(locale.clone()),
						key: Some(key.to_string()),
						group: Some(group.to_string()),
						value: Some(value.to_string()),
						target_value: Some(target_value.to_string()),
						related_key: Some(first_key.to_string()),
						file: files.and_then(|files| files[index].clone()),
						message: Some(format!(
							"The key `{first_key}` has the same {target} value but is translated as \"{first_value}\"."
						)),
						..IssueInit::default()
					},
				));
			}
		}
	}
}

/// Reports a plural key one of whose forms the language needs and does not
/// have. Which forms a language needs is a fact about the language, not about
/// the target.
fn check_plural_forms(
	issues: &mut Vec<Issue>,
	group: &str,
	locale_names: &[String],
	own_keys: &[Vec<&String>],
	files: Option<&[Option<String>]>,
) {
	for (index, locale) in locale_names.iter().enumerate() {
		let Some(categories) = plural_categories_of(locale) else {
			continue;
		};

		let mut forms_of_base: IndexMap<&str, HashSet<PluralCategory>> = IndexMap::new();

		for key in &own_keys[index] {
			if let Some(parts) = plural_parts_of(key) {
				forms_of_base
					.entry(parts.base)
					.or_default()
					.insert(parts.category);
			}
		}

		for (base, found) in &forms_of_base {
			let needed = plural_forms_needed(locale, base).unwrap_or(categories);
			let missing: Vec<String> = needed
				.iter()
				.filter(|category| !found.contains(category))
				.map(|category| format!("`{base}_{}`", category.as_str()))
				.collect();

			if missing.is_empty() {
				continue;
			}

			issues.push(create_issue(
				CheckCode::NoPluralForm,
				IssueInit {
					locale: Some(locale.clone()),
					key: Some(base.to_string()),
					group: Some(group.to_string()),
					file: files.and_then(|files| files[index].clone()),
					message: Some(format!(
						"`{locale}` needs {} and the file does not define {}.",
						list_of(&missing),
						if missing.len() == 1 { "it" } else { "them" }
					)),
					..IssueInit::default()
				},
			));
		}
	}
}

/// Keys of every locale, the target language first so reports follow its order.
pub fn collect_keys(own_keys: &[Vec<&String>], target_index: Option<usize>) -> Vec<String> {
	let mut keys: IndexSet<String> = IndexSet::new();

	if let Some(target) = target_index {
		keys.extend(own_keys[target].iter().map(|key| key.to_string()));
	}

	for (index, map_keys) in own_keys.iter().enumerate() {
		if Some(index) != target_index {
			keys.extend(map_keys.iter().map(|key| key.to_string()));
		}
	}

	keys.into_iter().collect()
}

/// Brings the input into the `group -> locale -> flat map` shape the analysis
/// works on. With [flattened] the maps are used as they are.
pub fn prepare_groups(
	input: &Input,
	options: &ResolvedOptions,
	flattened: bool,
	issues: &mut Vec<Issue>,
) -> TranslationGroups {
	let single;
	let source: &TranslationGroups = match &input.groups {
		Some(groups) => groups,
		None => {
			single = IndexMap::from([(String::new(), input.locales.clone().unwrap_or_default())]);
			&single
		}
	};
	let mut prepared = TranslationGroups::new();

	// In the order a JavaScript object lists its keys, whole numbers first.
	for group in names_in_object_order(source) {
		let locales = &source[group];
		let mut prepared_locales = IndexMap::new();

		for locale in names_in_object_order(locales) {
			let map = &locales[locale];
			if flattened {
				prepared_locales.insert(locale.clone(), map.clone());
				continue;
			}

			let (flat, duplicates) = flatten_object(map);

			prepared_locales.insert(locale.clone(), flat);

			// Found while flattening, because flattening is what hides it: two
			// definitions go in and one key comes out.
			if options.enabled_checks.contains(&CheckCode::DuplicateKey) {
				for key in duplicates {
					issues.push(create_issue(
						CheckCode::DuplicateKey,
						IssueInit {
							locale: Some(locale.clone()),
							group: Some(group.clone()),
							message: Some(format!(
								"The key `{key}` is defined more than once, so one of its values is lost."
							)),
							key: Some(key),
							..IssueInit::default()
						},
					));
				}
			}
		}

		prepared.insert(group.clone(), prepared_locales);
	}

	prepared
}

/// A reusable analyzer bound to one set of options. The options, the enabled
/// checks and the delimiters are resolved once, so a caller checking again after
/// every edit pays only for the comparison itself.
#[derive(Clone, Debug)]
pub struct Analyzer {
	/// The options every call of this analyzer runs with.
	pub options: ResolvedOptions,
	/// Issues raised while resolving those options, replayed into every result.
	pub option_issues: Vec<crate::types::Issue>,
	flags: CheckFlags,
}

impl Analyzer {
	/// An analyzer bound to [options].
	pub fn new(options: &Options) -> Analyzer {
		let (options, option_issues) = resolve_options(options);
		let flags = CheckFlags::of(&options.enabled_checks);

		Analyzer {
			options,
			option_issues,
			flags,
		}
	}

	/// Compares a whole set of translations held in memory.
	pub fn analyze(&self, input: &Input) -> CheckResult {
		self.analyze_with(input, self.options.flattened)
	}

	/// Compares a whole set of translations, flattening them first unless
	/// [flattened] says they already are.
	pub fn analyze_with(&self, input: &Input, flattened: bool) -> CheckResult {
		let started_at = Instant::now();
		let flags = &self.flags;
		let options = &self.options;
		// Whatever produced the input may already have found problems; they belong
		// in the same report.
		let mut issues: Vec<Issue> = input.issues.clone().unwrap_or_default();

		issues.extend(self.option_issues.iter().cloned());

		let groups = prepare_groups(input, options, flattened, &mut issues);
		let group_names: Vec<String> = groups.keys().cloned().collect();
		// Collected before the comparison: a group can only be missing a language
		// once every group has said which ones it has.
		let mut all_locales: IndexSet<String> = IndexSet::new();

		for locales in groups.values() {
			all_locales.extend(locales.keys().cloned());
		}

		let file_paths = build_file_paths(input.files.as_ref());
		let unused_keys: Option<HashSet<&String>> = input
			.unused_keys
			.as_ref()
			.filter(|keys| flags.unused_key && !keys.is_empty())
			.map(|keys| keys.iter().collect());

		if flags.undefined_key {
			for usage in input.undefined_keys.iter().flatten() {
				issues.push(create_issue(
					CheckCode::UndefinedKey,
					IssueInit {
						key: Some(usage.key.clone()),
						file: usage.file.clone(),
						message: Some(format!(
							"The scanned source asks for `{}` and no language file defines it.",
							usage.key
						)),
						..IssueInit::default()
					},
				));
			}
		}

		let mut key_count = 0;

		for (group, locale_maps) in &groups {
			let locale_names: Vec<String> = locale_maps.keys().cloned().collect();

			// Only worth asking with more than one group: with a single one, every
			// language that exists at all is in it by definition.
			if flags.no_locale && group_names.len() > 1 {
				for locale in &all_locales {
					if locale_maps.contains_key(locale) {
						continue;
					}

					issues.push(create_issue(
						CheckCode::NoLocale,
						IssueInit {
							locale: Some(locale.clone()),
							group: Some(group.clone()),
							message: Some(format!(
								"`{group}` holds no translations for `{locale}`, so none of its keys exist there."
							)),
							..IssueInit::default()
						},
					));
				}
			}

			let Some(target_index) = locale_names
				.iter()
				.position(|locale| *locale == options.target)
			else {
				issues.push(create_issue(
					CheckCode::InvalidOptions,
					IssueInit {
						level: Some(crate::constants::Level::Error),
						group: Some(group.clone()),
						message: Some(format!(
							"The target language `{}` was not found{}. There is nothing to compare against.",
							options.target,
							if group.is_empty() { String::new() } else { format!(" in `{group}`") }
						)),
						..IssueInit::default()
					},
				));
				continue;
			};

			let maps: Vec<&TranslationMap> = locale_names
				.iter()
				.map(|locale| &locale_maps[locale])
				.collect();
			// Listed once per map and shared by every check that walks it, in the
			// order a JavaScript object lists its keys.
			let own_keys: Vec<Vec<&String>> = maps.iter().map(|map| object_keys(map)).collect();
			let files = files_of(file_paths.as_ref(), group, &locale_names);
			let keys = collect_keys(&own_keys, Some(target_index));
			let mut values: Vec<Option<&Value>> = vec![None; maps.len()];

			key_count += keys.len();

			for key in &keys {
				// The shape of a key is the same in every language, so it is judged
				// once rather than once per locale.
				check_key_shape(&mut issues, key, group, options);

				for (slot, map) in values.iter_mut().zip(&maps) {
					*slot = map.get(key.as_str());
				}

				check_key_slots(
					&mut issues,
					key,
					group,
					&locale_names,
					&values,
					Some(target_index),
					flags,
					options,
					files.as_deref(),
				);

				// Not locale-bound: the key is unreferenced, not one language's
				// translation of it.
				if unused_keys
					.as_ref()
					.is_some_and(|unused| unused.contains(key))
				{
					issues.push(create_issue(
						CheckCode::UnusedKey,
						IssueInit {
							key: Some(key.clone()),
							group: Some(group.clone()),
							..IssueInit::default()
						},
					));
				}
			}

			if flags.duplicate_value {
				check_duplicate_values(
					&mut issues,
					group,
					&locale_names,
					&maps,
					&own_keys,
					target_index,
					files.as_deref(),
				);
			}

			if flags.no_plural_form {
				check_plural_forms(
					&mut issues,
					group,
					&locale_names,
					&own_keys,
					files.as_deref(),
				);
			}

			if flags.inconsistent_value {
				check_inconsistent_values(
					&mut issues,
					group,
					&locale_names,
					&maps,
					&own_keys,
					target_index,
					&options.target,
					files.as_deref(),
				);
			}
		}

		apply_level_overrides(&mut issues, options.levels.as_ref());

		build_result(
			issues,
			options,
			ResultFacts {
				locales: all_locales.into_iter().collect(),
				groups: group_names,
				key_count,
				files: input.files.clone().unwrap_or_default(),
				file_format: input.file_format,
				elapsed_ms: started_at.elapsed().as_millis(),
			},
		)
	}

	/// Compares a single key across locales. The checks that need every key of a
	/// locale at once are never reported here.
	pub fn check_entry(&self, entry: &Entry) -> Vec<Issue> {
		let mut issues = Vec::new();
		let locale_names: Vec<String> = entry
			.locales
			.clone()
			.unwrap_or_else(|| entry.values.keys().cloned().collect());
		let values: Vec<Option<&Value>> = locale_names
			.iter()
			.map(|locale| entry.values.get(locale))
			.collect();
		let group = entry.group.as_deref().unwrap_or("");

		check_key_shape(&mut issues, &entry.key, group, &self.options);
		check_key_slots(
			&mut issues,
			&entry.key,
			group,
			&locale_names,
			&values,
			locale_names
				.iter()
				.position(|locale| *locale == self.options.target),
			&self.flags,
			&self.options,
			None,
		);
		apply_level_overrides(&mut issues, self.options.levels.as_ref());

		issues
	}
}

/// A reusable analyzer bound to one set of options.
pub fn create_analyzer(options: &Options) -> Analyzer {
	Analyzer::new(options)
}

/// Compares translations held in memory. Does no file system work at all.
pub fn analyze_translations(input: &Input, options: &Options) -> CheckResult {
	Analyzer::new(options).analyze(input)
}
