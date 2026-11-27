//! What a translation value can be measured on beyond its text: the markup it
//! carries, the numbers in it, the characters nothing will draw, and the script
//! it is written in.
//!
//! Every character class here is written as escapes rather than as the
//! characters themselves. Some of them are invisible, and a source file that
//! holds one is a source file nobody can review.

use std::sync::OnceLock;

use regex::Regex;

use crate::core::chars::is_space;

/// The zero of every set of decimal digits Unicode 17 defines, each followed by
/// the nine digits after it. Written out rather than read from a library: each
/// package runs on a different Unicode version, and they must agree on what a
/// digit is.
const DIGIT_ZEROS: [u32; 77] = [
	0x30, 0x660, 0x6f0, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66,
	0xde6, 0xe50, 0xed0, 0xf20, 0x1040, 0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0, 0x1a80, 0x1a90,
	0x1b50, 0x1bb0, 0x1c40, 0x1c50, 0xa620, 0xa8d0, 0xa900, 0xa9d0, 0xa9f0, 0xaa50, 0xabf0, 0xff10,
	0x104a0, 0x10d30, 0x10d40, 0x11066, 0x110f0, 0x11136, 0x111d0, 0x112f0, 0x11450, 0x114d0,
	0x11650, 0x116c0, 0x116d0, 0x116da, 0x11730, 0x118e0, 0x11950, 0x11bf0, 0x11c50, 0x11d50,
	0x11da0, 0x11de0, 0x11f50, 0x16130, 0x16a60, 0x16ac0, 0x16b50, 0x16d70, 0x1ccf0, 0x1d7ce,
	0x1d7d8, 0x1d7e2, 0x1d7ec, 0x1d7f6, 0x1e140, 0x1e2f0, 0x1e4f0, 0x1e5f1, 0x1e950, 0x1fbf0,
];

/// The script each language is written in, as the first and last code point of
/// each of its blocks, for the languages whose script says something a
/// comparison can act on. A language written in the Latin alphabet is left out:
/// there would be nothing to tell it apart from an English string nobody
/// translated.
const SCRIPT_OF_LANGUAGE: &[(&str, &[(u32, u32)])] = &[
	("am", &[(0x1200, 0x137f)]),
	(
		"ar",
		&[(0x0600, 0x06ff), (0x0750, 0x077f), (0x08a0, 0x08ff)],
	),
	("be", &[(0x0400, 0x04ff)]),
	("bg", &[(0x0400, 0x04ff)]),
	("bn", &[(0x0980, 0x09ff)]),
	("el", &[(0x0370, 0x03ff), (0x1f00, 0x1fff)]),
	("fa", &[(0x0600, 0x06ff), (0x0750, 0x077f)]),
	("he", &[(0x0590, 0x05ff)]),
	("hi", &[(0x0900, 0x097f)]),
	("hy", &[(0x0530, 0x058f)]),
	(
		"ja",
		&[(0x3040, 0x30ff), (0x31f0, 0x31ff), (0x4e00, 0x9fff)],
	),
	("ka", &[(0x10a0, 0x10ff)]),
	("kk", &[(0x0400, 0x04ff)]),
	("km", &[(0x1780, 0x17ff)]),
	(
		"ko",
		&[(0x1100, 0x11ff), (0x3130, 0x318f), (0xac00, 0xd7af)],
	),
	("ky", &[(0x0400, 0x04ff)]),
	("lo", &[(0x0e80, 0x0eff)]),
	("mk", &[(0x0400, 0x04ff)]),
	("ml", &[(0x0d00, 0x0d7f)]),
	("mn", &[(0x0400, 0x04ff)]),
	("my", &[(0x1000, 0x109f)]),
	("ne", &[(0x0900, 0x097f)]),
	("ru", &[(0x0400, 0x04ff)]),
	("si", &[(0x0d80, 0x0dff)]),
	("ta", &[(0x0b80, 0x0bff)]),
	("te", &[(0x0c00, 0x0c7f)]),
	("th", &[(0x0e00, 0x0e7f)]),
	("uk", &[(0x0400, 0x04ff)]),
	("ur", &[(0x0600, 0x06ff), (0x0750, 0x077f)]),
	(
		"zh",
		&[(0x3400, 0x4dbf), (0x4e00, 0x9fff), (0xf900, 0xfaff)],
	),
];

/// Whether a code point is a character nothing will draw: a zero width joiner or
/// space, the byte order mark, or one of the bidirectional controls a copy out
/// of a right-to-left editor leaves behind. The non-breaking space is here too,
/// because it looks exactly like the ordinary space it is not.
fn is_invisible(code: u32) -> bool {
	code == 0xa0
		|| (0x200b..=0x200f).contains(&code)
		|| (0x202a..=0x202e).contains(&code)
		|| (0x2060..=0x2064).contains(&code)
		|| (0x2066..=0x2069).contains(&code)
		|| code == 0xfeff
}

fn letter_pattern() -> &'static Regex {
	static PATTERN: OnceLock<Regex> = OnceLock::new();

	PATTERN.get_or_init(|| Regex::new(r"\p{L}").expect("the letter class compiles"))
}

/// The index of the last zero at or below [code], which is the set of digits
/// [code] would belong to if it were a digit at all.
fn zero_index_of(code: u32) -> usize {
	DIGIT_ZEROS
		.partition_point(|&zero| zero <= code)
		.saturating_sub(1)
}

/// The value of a digit of any script, or `None` for a character that is not one.
fn digit_value_of(code: u32) -> Option<u32> {
	if (0x30..=0x39).contains(&code) {
		return Some(code - 0x30);
	}

	if code < DIGIT_ZEROS[1] {
		return None;
	}

	let digit = code - DIGIT_ZEROS[zero_index_of(code)];

	(digit <= 9).then_some(digit)
}

/// Whether a character may follow the `<` of a tag: anything but another
/// bracket or whitespace, so prose comparing two numbers is not mistaken for a
/// tag.
fn can_start_tag_name(character: char) -> bool {
	character != '<' && character != '>' && !is_space(character)
}

/// The end of the tag whose `<` is at byte [start], or `None` when that `<`
/// opens none.
///
/// Reads `</?[^<>\s][^<>]*>` the way a regular expression engine does,
/// backtracking included: the slash is a closing mark only when a name follows
/// it, so in `</>` and `</ b>` the slash is the name itself.
fn tag_end_at(value: &str, start: usize) -> Option<usize> {
	let rest = &value[start + 1..];
	let mut characters = rest.char_indices();
	let (_, first) = characters.next()?;
	let name_start = if first == '/' && rest[1..].chars().next().is_some_and(can_start_tag_name) {
		1
	} else if can_start_tag_name(first) {
		0
	} else {
		return None;
	};
	let name_length = rest[name_start..].chars().next()?.len_utf8();

	for (offset, byte) in rest.bytes().enumerate().skip(name_start + name_length) {
		if byte == b'>' {
			return Some(start + 1 + offset + 1);
		}

		if byte == b'<' {
			return None;
		}
	}

	None
}

/// Markup tags a value carries, in the order they appear.
pub fn extract_tags(value: &str) -> Vec<&str> {
	let mut tags = Vec::new();
	let mut from = 0;

	while let Some(found) = value[from..].find('<') {
		let start = from + found;

		match tag_end_at(value, start) {
			Some(end) => {
				tags.push(&value[start..end]);
				from = end;
			}
			None => from = start + 1,
		}
	}

	tags
}

/// [value] with each tag replaced by a space.
fn without_tags(value: &str) -> std::borrow::Cow<'_, str> {
	let mut text = String::new();
	let mut copied = 0;
	let mut from = 0;

	while let Some(found) = value[from..].find('<') {
		let start = from + found;

		match tag_end_at(value, start) {
			Some(end) => {
				text.push_str(&value[copied..start]);
				text.push(' ');
				copied = end;
				from = end;
			}
			None => from = start + 1,
		}
	}

	if copied == 0 {
		return std::borrow::Cow::Borrowed(value);
	}

	text.push_str(&value[copied..]);

	std::borrow::Cow::Owned(text)
}

/// Whether a value holds a digit of any script.
pub fn has_digit(value: &str) -> bool {
	if value.bytes().any(|byte| byte.is_ascii_digit()) {
		return true;
	}

	if value.is_ascii() {
		return false;
	}

	value
		.chars()
		.any(|character| digit_value_of(character as u32).is_some())
}

/// Runs of digits a value carries, as they are written and as text so `03` and
/// `3` stay apart. A run may be written in any script's digits.
pub fn extract_numbers(value: &str) -> Vec<&str> {
	let mut numbers = Vec::new();
	let mut start: Option<usize> = None;

	for (index, character) in value.char_indices() {
		let is_digit = digit_value_of(character as u32).is_some();

		match (is_digit, start) {
			(true, None) => start = Some(index),
			(false, Some(from)) => {
				numbers.push(&value[from..index]);
				start = None;
			}
			_ => {}
		}
	}

	if let Some(from) = start {
		numbers.push(&value[from..]);
	}

	numbers
}

/// A run of digits in ASCII, so `٠٣` and `03` compare equal.
pub fn ascii_digits_of(digits: &str) -> String {
	if digits.is_ascii() {
		return digits.to_string();
	}

	digits
		.chars()
		.map(|character| {
			let code = character as u32;
			let digit = code.wrapping_sub(DIGIT_ZEROS[zero_index_of(code)]);

			char::from_u32(0x30 + digit).unwrap_or(character)
		})
		.collect()
}

/// The first character in a value that nothing will draw, if there is one.
pub fn find_invisible_character(value: &str) -> Option<char> {
	if value.is_ascii() {
		return None;
	}

	value
		.chars()
		.find(|&character| is_invisible(character as u32))
}

/// How to name an invisible character in a message, since it cannot be shown.
pub fn name_of_invisible_character(character: char) -> String {
	let name = match character {
		'\u{a0}' => "a non-breaking space",
		'\u{200b}' => "a zero width space",
		'\u{200c}' => "a zero width non-joiner",
		'\u{200d}' => "a zero width joiner",
		'\u{200e}' => "a left-to-right mark",
		'\u{200f}' => "a right-to-left mark",
		'\u{feff}' => "a byte order mark",
		_ => "a bidirectional control",
	};

	format!("{name} (U+{:04X})", character as u32)
}

/// The blocks of the script a locale's translations are expected to be written
/// in, or `None` when the locale writes in the Latin alphabet, is not listed, or
/// names a script of its own: `sr-Latn` is Serbian written in Latin, and asking
/// it for Cyrillic would be wrong.
pub fn script_of_locale(locale: &str) -> Option<&'static [(u32, u32)]> {
	let lower = locale.to_lowercase();
	let parts: Vec<&str> = lower.split(['-', '_']).collect();
	let language = parts.first().copied().unwrap_or("");

	if parts.contains(&"latn") {
		return None;
	}

	SCRIPT_OF_LANGUAGE
		.iter()
		.find(|(name, _)| *name == language)
		.map(|(_, ranges)| *ranges)
}

/// Whether [value] holds a character of one of the blocks in [ranges].
pub fn holds_script(value: &str, ranges: &[(u32, u32)]) -> bool {
	let lowest = ranges.first().map_or(0, |&(start, _)| start);

	value.chars().any(|character| {
		let code = character as u32;

		code >= lowest
			&& ranges
				.iter()
				.any(|&(start, end)| code >= start && code <= end)
	})
}

/// Whether [text] holds a letter of any script. An ASCII letter answers on the
/// spot; only a value with characters beyond ASCII and none of its letters is
/// left to the Unicode letter class.
fn has_letter(text: &str) -> bool {
	if text.bytes().any(|byte| byte.is_ascii_alphabetic()) {
		return true;
	}

	!text.is_ascii() && letter_pattern().is_match(text)
}

/// Whether a value holds a word of its own, once the parts that are never
/// translated are taken out. A value that is only a placeholder, a tag or a
/// number cannot be judged on the script it is written in.
pub fn has_translatable_text(value: &str, prefix: &str, suffix: &str) -> bool {
	let mut text = without_tags(value).into_owned();
	let mut start = text.find(prefix);

	// A placeholder name is written by the developer and stays in English, so
	// leaving it in would let it answer for the whole value.
	while let Some(at) = start {
		let Some(end) = text[at + prefix.len()..]
			.find(suffix)
			.map(|end| at + prefix.len() + end)
		else {
			break;
		};

		text = format!("{} {}", &text[..at], &text[end + suffix.len()..]);
		start = text.find(prefix);
	}

	has_letter(&text)
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn reads_markup_tags_as_they_were_written() {
		assert_eq!(extract_tags("a <b>c</b> <br/>"), ["<b>", "</b>", "<br/>"]);
		assert!(extract_tags("no markup here").is_empty());
		assert_eq!(
			extract_tags("</> and </ b> and 1 < 2 > 0"),
			["</>", "</ b>"]
		);
		assert_eq!(extract_tags("<a<b>"), ["<b>"]);
	}

	#[test]
	fn reads_digits_of_any_script() {
		assert!(has_digit("Step 3"));
		assert!(has_digit("\u{663}"));
		assert!(has_digit("\u{1d7ce}"));
		assert!(!has_digit("none"));
		assert_eq!(extract_numbers("Step 03 of 5"), ["03", "5"]);
		assert_eq!(
			extract_numbers("\u{663}\u{664} and 7"),
			["\u{663}\u{664}", "7"]
		);
		assert_eq!(ascii_digits_of("\u{663}\u{664}"), "34");
		assert_eq!(ascii_digits_of("\u{ff10}\u{ff13}"), "03");
	}

	#[test]
	fn finds_the_first_character_nothing_will_draw() {
		assert_eq!(find_invisible_character("ab\u{200b}c"), Some('\u{200b}'));
		assert_eq!(find_invisible_character("plain"), None);
		assert_eq!(
			name_of_invisible_character('\u{200b}'),
			"a zero width space (U+200B)"
		);
		assert_eq!(
			name_of_invisible_character('\u{202e}'),
			"a bidirectional control (U+202E)"
		);
	}

	#[test]
	fn knows_which_script_a_language_is_written_in() {
		assert!(holds_script("\u{ac00}", script_of_locale("ko").unwrap()));
		assert!(holds_script("\u{3042}", script_of_locale("ja-JP").unwrap()));
		assert!(script_of_locale("en").is_none());
		assert!(script_of_locale("sr-Latn").is_none());
	}

	#[test]
	fn does_not_count_a_placeholder_or_a_tag_as_words_of_its_own() {
		assert!(!has_translatable_text("{name}", "{", "}"));
		assert!(!has_translatable_text("<br/>", "{", "}"));
		assert!(has_translatable_text("Hi {name}", "{", "}"));
		assert!(has_translatable_text("\u{c548}\u{b155}", "{", "}"));
		assert!(!has_translatable_text("100%", "{", "}"));
	}
}
