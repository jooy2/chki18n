//! The order a report lists names and keys in.

use std::cmp::Ordering;

/// Orders two strings by their UTF-16 code units, the way JavaScript's `<`
/// compares them, whatever the locale of the machine.
///
/// UTF-8 bytes sort by code point, which agrees with UTF-16 everywhere except
/// between a character above U+FFFF and one from U+E000 to U+FFFF: a surrogate
/// pair starts below U+E000, so in UTF-16 the first sorts before the second.
pub fn compare_text(a: &str, b: &str) -> Ordering {
	for (left, right) in a.chars().zip(b.chars()) {
		if left == right {
			continue;
		}

		let (left, right) = (left as u32, right as u32);
		let left_unit = if left > 0xffff { 0xd800 } else { left };
		let right_unit = if right > 0xffff { 0xd800 } else { right };

		if left_unit != right_unit {
			return left_unit.cmp(&right_unit);
		}

		// Two characters above U+FFFF: their surrogate pairs sort as they do.
		return left.cmp(&right);
	}

	a.chars().count().cmp(&b.chars().count())
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn sorts_by_code_unit() {
		assert_eq!(compare_text("a", "b"), Ordering::Less);
		assert_eq!(compare_text("B", "a"), Ordering::Less);
		assert_eq!(compare_text("ab", "a"), Ordering::Greater);
		assert_eq!(compare_text("\u{1f600}", "\u{ff01}"), Ordering::Less);
		assert_eq!(compare_text("\u{1f600}", "\u{1f601}"), Ordering::Less);
		assert_eq!(compare_text("", ""), Ordering::Equal);
	}
}
