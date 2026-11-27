//! The shape of a key: how deep it is nested and the case it is written in.

use crate::constants::{CheckCode, KeyCase};
use crate::core::issue::{create_issue, IssueInit};
use crate::options::ResolvedOptions;
use crate::types::Issue;

/// Suffixes the i18n libraries add to a key themselves, which a project's own
/// naming rule does not apply to.
const LIBRARY_SUFFIXES: [&str; 11] = [
	"zero", "one", "two", "few", "many", "other", "plural", "ordinal", "interval", "male", "female",
];

/// A segment without the library suffix it ends with, if any. In snake case the
/// underscore is the project's own, so nothing is cut.
fn without_library_suffix(segment: &str, key_case: KeyCase) -> &str {
	if key_case == KeyCase::Snake {
		return segment;
	}

	match segment.rfind('_') {
		Some(separator)
			if separator >= 1 && LIBRARY_SUFFIXES.contains(&&segment[separator + 1..]) =>
		{
			&segment[..separator]
		}
		_ => segment,
	}
}

fn is_lower_or_digit(byte: u8) -> bool {
	byte.is_ascii_lowercase() || byte.is_ascii_digit()
}

/// Words of lower case letters and digits joined by one [separator] each:
/// `^[a-z0-9]+(?:-[a-z0-9]+)*$` for kebab case and its underscore form for snake.
fn is_joined_words(segment: &str, separator: u8) -> bool {
	let bytes = segment.as_bytes();

	!bytes.is_empty()
		&& bytes[0] != separator
		&& bytes[bytes.len() - 1] != separator
		&& bytes
			.windows(2)
			.all(|pair| !(pair[0] == separator && pair[1] == separator))
		&& bytes
			.iter()
			.all(|&byte| is_lower_or_digit(byte) || byte == separator)
}

/// Whether a segment is written in [key_case].
fn is_in_case(segment: &str, key_case: KeyCase) -> bool {
	match key_case {
		KeyCase::Kebab => is_joined_words(segment, b'-'),
		KeyCase::Snake => is_joined_words(segment, b'_'),
		// `^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$`: a lower case start, then letters
		// and digits of either case.
		KeyCase::Camel => {
			let bytes = segment.as_bytes();

			!bytes.is_empty()
				&& bytes[0].is_ascii_lowercase()
				&& bytes.iter().all(|byte| byte.is_ascii_alphanumeric())
		}
	}
}

/// Reports a key nested deeper than `max_key_depth` allows, and a key one of
/// whose segments is not written in `key_case`.
pub fn check_key_shape(issues: &mut Vec<Issue>, key: &str, group: &str, options: &ResolvedOptions) {
	// Asked of every key of every group, so the case where the project has said
	// nothing costs nothing: not even splitting the key into its segments.
	if key.is_empty() || (options.max_key_depth.is_none() && options.key_case.is_none()) {
		return;
	}

	let segments: Vec<&str> = key.split('.').collect();

	if let Some(max_key_depth) = options.max_key_depth {
		if segments.len() as u64 > max_key_depth
			&& options.enabled_checks.contains(&CheckCode::KeyDepth)
		{
			issues.push(create_issue(
				CheckCode::KeyDepth,
				IssueInit {
					key: Some(key.into()),
					group: Some(group.into()),
					message: Some(format!(
						"The key is {} levels deep, and `maxKeyDepth` allows {max_key_depth}.",
						segments.len()
					)),
					..IssueInit::default()
				},
			));
		}
	}

	let Some(key_case) = options.key_case else {
		return;
	};

	if !options.enabled_checks.contains(&CheckCode::KeyNaming) {
		return;
	}

	for segment in &segments {
		if is_in_case(without_library_suffix(segment, key_case), key_case) {
			continue;
		}

		let message = if segments.len() > 1 {
			format!(
				"The part `{segment}` is not written in {} case.",
				key_case.as_str()
			)
		} else {
			format!("The key is not written in {} case.", key_case.as_str())
		};

		issues.push(create_issue(
			CheckCode::KeyNaming,
			IssueInit {
				key: Some(key.into()),
				group: Some(group.into()),
				message: Some(message),
				..IssueInit::default()
			},
		));

		// One finding per key. Naming a second bad segment of the same key adds
		// nothing to what has to be done about it.
		return;
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn tells_the_cases_apart() {
		assert!(is_in_case("attr-folder", KeyCase::Kebab));
		assert!(!is_in_case("attr--folder", KeyCase::Kebab));
		assert!(!is_in_case("-attr", KeyCase::Kebab));
		assert!(is_in_case("attrFolderX1", KeyCase::Camel));
		assert!(!is_in_case("AttrFolder", KeyCase::Camel));
		assert!(is_in_case("attr_folder", KeyCase::Snake));
		assert!(!is_in_case("attr_Folder", KeyCase::Snake));
		assert_eq!(without_library_suffix("item_one", KeyCase::Camel), "item");
		assert_eq!(
			without_library_suffix("item_one", KeyCase::Snake),
			"item_one"
		);
	}
}
