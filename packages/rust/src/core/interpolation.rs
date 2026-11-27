//! The placeholders a translation value carries.

use crate::core::chars::is_word_byte;

/// An opening and closing delimiter pair, as `interpolation_prefix` takes them.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Delimiters {
	/// Opening delimiter, such as `{{`.
	pub prefix: &'static str,
	/// Closing delimiter, such as `}}`.
	pub suffix: &'static str,
}

/// The delimiter pairs [detect_interpolation_delimiters] knows, in the order it
/// believes them. A doubled pair comes before its single form, or `{{name}}`
/// would be read as `{` wrapped around `{name`.
pub const INTERPOLATION_DELIMITERS: [Delimiters; 8] = [
	Delimiters {
		prefix: "{{",
		suffix: "}}",
	},
	Delimiters {
		prefix: "{",
		suffix: "}",
	},
	Delimiters {
		prefix: "[[",
		suffix: "]]",
	},
	Delimiters {
		prefix: "[",
		suffix: "]",
	},
	Delimiters {
		prefix: "((",
		suffix: "))",
	},
	Delimiters {
		prefix: "(",
		suffix: ")",
	},
	Delimiters {
		prefix: "<<",
		suffix: ">>",
	},
	Delimiters {
		prefix: "<",
		suffix: ">",
	},
];

/// Whether the delimiter at byte [at] is escaped by an odd number of
/// backslashes.
fn is_escaped(text: &[u8], at: usize) -> bool {
	text[..at]
		.iter()
		.rev()
		.take_while(|&&byte| byte == b'\\')
		.count()
		% 2 == 1
}

/// Whether [delimiter] starts at byte [at] as a delimiter rather than as text.
/// An escaped one is text, and so is a doubled one-character delimiter:
/// `{{name}}` holds no key as far as `{` and `}` are concerned.
fn is_delimiter_at(text: &str, at: usize, delimiter: &str, single: bool) -> bool {
	let bytes = text.as_bytes();

	if !text[at..].starts_with(delimiter) || is_escaped(bytes, at) {
		return false;
	}

	if !single {
		return true;
	}

	// One character on either side of it, the way JavaScript reads `text[at - 1]`
	// and `text[at + 1]` around a delimiter one code unit long.
	let unit = delimiter.chars().next();
	let before = text[..at].chars().next_back();
	let behind = text[at + delimiter.len()..].chars().next();

	before != unit && behind != unit
}

/// The first occurrence of [needle] in [text]. A delimiter of one character, which
/// nearly every delimiter is, is searched for as a character, which scans the
/// bytes directly instead of setting up a substring search for every value.
fn find_in(text: &str, needle: &str) -> Option<usize> {
	let mut characters = needle.chars();

	match (characters.next(), characters.next()) {
		(Some(only), None) => text.find(only),
		_ => text.find(needle),
	}
}

/// The next occurrence of [needle] in [text] at or after byte [from].
fn find_from(text: &str, needle: &str, from: usize) -> Option<usize> {
	if from > text.len() {
		return None;
	}

	find_in(&text[from..], needle).map(|found| from + found)
}

/// The next character boundary after byte [at], so a search can move on past a
/// delimiter that turned out to be text.
fn after(text: &str, at: usize) -> usize {
	let mut next = at + 1;

	while next < text.len() && !text.is_char_boundary(next) {
		next += 1;
	}

	next
}

/// Interpolation keys used by a value, such as `["name"]` for `Hello {name}`.
///
/// Values that cannot hold a placeholder are rejected by one search, and the
/// rest jump from one delimiter to the next rather than walking every
/// character. The two delimiters may differ in length, as `%{` and `}` do.
pub fn extract_interpolation_keys<'a>(value: &'a str, prefix: &str, suffix: &str) -> Vec<&'a str> {
	let mut keys = Vec::new();

	if find_in(value, prefix).is_none() || find_in(value, suffix).is_none() {
		return keys;
	}

	// One string cannot tell an opening delimiter from a closing one.
	if prefix.is_empty() || suffix.is_empty() || prefix == suffix {
		return keys;
	}

	// Measured in UTF-16 code units, as JavaScript measures a string.
	let single = prefix.encode_utf16().count() == 1 && suffix.encode_utf16().count() == 1;
	let mut at = find_in(value, prefix);

	while let Some(open) = at {
		if !is_delimiter_at(value, open, prefix, single) {
			at = find_from(value, prefix, after(value, open));
			continue;
		}

		let from = open + prefix.len();
		let mut close = find_from(value, suffix, from);

		while let Some(end) = close {
			if is_delimiter_at(value, end, suffix, single) {
				break;
			}

			close = find_from(value, suffix, after(value, end));
		}

		let Some(end) = close else {
			at = find_from(value, prefix, after(value, open));
			continue;
		};

		let key = &value[from..end];

		if key.bytes().all(is_word_byte)
			&& find_in(key, prefix).is_none()
			&& find_in(key, suffix).is_none()
		{
			keys.push(key);
		}

		at = find_from(value, prefix, end + suffix.len());
	}

	keys
}

/// Whether a byte opens one of the pairs above.
fn is_opener(byte: u8) -> bool {
	matches!(byte, b'{' | b'[' | b'(' | b'<')
}

/// Whether a byte can start an interpolation key. Deliberately narrow: it is
/// what tells `{name}` apart from the `{"` of the JSON holding it, which is why
/// this can be pointed at a file's raw text.
fn is_key_start(byte: u8) -> bool {
	byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$'
}

/// Guesses which delimiters a text writes its interpolation keys with, or
/// `None` when nothing in it looks like one.
///
/// A suggestion to offer a user, not a decision to act on: a text that mixes
/// two answers with the first pair of [INTERPOLATION_DELIMITERS] it holds.
pub fn detect_interpolation_delimiters(text: &str) -> Option<Delimiters> {
	let bytes = text.as_bytes();
	let mut seen_single = [false; 4];
	let mut seen_double = [false; 4];
	let mut at = 0;

	while at < bytes.len() {
		let open = bytes[at];

		if !is_opener(open) {
			at += 1;
			continue;
		}

		let mut end = at + 1;

		while end < bytes.len() && bytes[end] == open {
			end += 1;
		}

		let mut key = end;

		// `{{ name }}` is as common as `{{name}}`, and the space belongs to the
		// style rather than to the delimiter.
		while key < bytes.len() && bytes[key] == b' ' {
			key += 1;
		}

		if key < bytes.len() && is_key_start(bytes[key]) {
			let slot = match open {
				b'{' => 0,
				b'[' => 1,
				b'(' => 2,
				_ => 3,
			};

			// A run of three or more is read as the doubled form, the way a run of
			// one is read as the single one.
			if end - at > 1 {
				seen_double[slot] = true;
			} else {
				seen_single[slot] = true;
			}

			// Nothing later can outrank the first candidate.
			if seen_double[0] {
				break;
			}
		}

		at = end;
	}

	INTERPOLATION_DELIMITERS.iter().copied().find(|candidate| {
		let slot = match candidate.prefix.as_bytes()[0] {
			b'{' => 0,
			b'[' => 1,
			b'(' => 2,
			_ => 3,
		};

		if candidate.prefix.len() > 1 {
			seen_double[slot]
		} else {
			seen_single[slot]
		}
	})
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn reads_the_keys_between_the_delimiters() {
		assert_eq!(
			extract_interpolation_keys("Hello {name}", "{", "}"),
			["name"]
		);
		assert_eq!(
			extract_interpolation_keys("{a} and {b}", "{", "}"),
			["a", "b"]
		);
		assert!(extract_interpolation_keys("{{name}}", "{", "}").is_empty());
		assert_eq!(extract_interpolation_keys("{{name}}", "{{", "}}"), ["name"]);
		assert!(extract_interpolation_keys(r"\{name}", "{", "}").is_empty());
		assert_eq!(
			extract_interpolation_keys("%{count} left", "%{", "}"),
			["count"]
		);
		assert!(extract_interpolation_keys("{not a key}", "{", "}").is_empty());
		assert_eq!(extract_interpolation_keys("{}", "{", "}"), [""]);
	}

	#[test]
	fn guesses_the_delimiters_a_text_uses() {
		assert_eq!(
			detect_interpolation_delimiters("Hi {{name}}"),
			Some(INTERPOLATION_DELIMITERS[0])
		);
		assert_eq!(
			detect_interpolation_delimiters(r#"{"a": "Hi {name}"}"#),
			Some(INTERPOLATION_DELIMITERS[1])
		);
		assert_eq!(detect_interpolation_delimiters("nothing"), None);
	}
}
