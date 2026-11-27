//! Character tests the analysis asks of values.

/// Whether a character is one of those `\s` matches in a JavaScript regular
/// expression: the ASCII whitespace, the line and paragraph separators, the
/// Unicode spaces and the byte order mark.
pub fn is_space(character: char) -> bool {
	let code = character as u32;

	if code < 0x80 {
		return code == 0x20 || (0x09..=0x0d).contains(&code);
	}

	code == 0xa0
		|| code == 0x1680
		|| (0x2000..=0x200a).contains(&code)
		|| code == 0x2028
		|| code == 0x2029
		|| code == 0x202f
		|| code == 0x205f
		|| code == 0x3000
		|| code == 0xfeff
}

/// The characters a placeholder name and a key segment are spelled with:
/// ASCII letters and digits, `_`, `$` and `-`.
pub fn is_word_byte(byte: u8) -> bool {
	byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$' || byte == b'-'
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn knows_the_spaces_a_pattern_does() {
		for character in [
			'\t', '\n', '\u{b}', '\u{c}', '\r', ' ', '\u{a0}', '\u{2028}', '\u{feff}',
		] {
			assert!(is_space(character), "{:x}", character as u32);
		}

		for character in ['a', '\u{200b}', '\u{85}', '\u{180e}'] {
			assert!(!is_space(character), "{:x}", character as u32);
		}
	}
}
