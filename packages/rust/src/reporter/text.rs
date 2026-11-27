//! Column arithmetic and the sentences every reporter shares.

use crate::core::chars::is_space;
use crate::core::width::{char_width, display_width};
use crate::reporter::paint::Paint;
use crate::types::{CheckResult, Issue, LevelCount};

/// `1 key` and `2 keys`, so a count never has to be read as `2 key(s)`.
pub fn plural(count: usize, noun: &str) -> String {
	format!("{count} {noun}{}", if count == 1 { "" } else { "s" })
}

/// A value on one line: every run of whitespace becomes one space, as `\s+`
/// would match it.
pub fn one_line(value: &str) -> String {
	let mut line = String::with_capacity(value.len());
	let mut in_space = false;

	for character in value.chars() {
		if is_space(character) {
			if !in_space {
				line.push(' ');
			}

			in_space = true;
		} else {
			line.push(character);
			in_space = false;
		}
	}

	line
}

/// A value as the report shows it, or `(none)` when there was none.
pub fn quote(value: Option<&str>) -> String {
	match value {
		Some(text) => format!("\"{}\"", one_line(text)),
		None => "(none)".to_string(),
	}
}

/// Pads to a column count, so a column of Korean lines up with one of English.
pub fn pad_to(text: &str, width: usize) -> String {
	let room = width.saturating_sub(display_width(text));

	format!("{text}{}", " ".repeat(room))
}

/// The widest of several strings, in columns.
pub fn widest_of<'a>(values: impl IntoIterator<Item = &'a str>) -> usize {
	values.into_iter().map(display_width).max().unwrap_or(0)
}

/// Cuts a string at the end to fit [max] columns, marking the cut with `...`.
pub fn truncate(text: &str, max: usize) -> String {
	if display_width(text) <= max {
		return text.to_string();
	}

	let room = max.saturating_sub(3).max(1);
	let mut width = 0;
	let mut end = 0;

	// Measured character by character and cut once, where the room runs out.
	for character in text.chars() {
		let next = width + char_width(character);

		if next > room {
			break;
		}

		width = next;
		end += character.len_utf8();
	}

	format!("{}...", &text[..end])
}

/// Cuts a string at the start to fit [max] columns, keeping its tail.
pub fn truncate_start(text: &str, max: usize) -> String {
	if display_width(text) <= max {
		return text.to_string();
	}

	let room = max.saturating_sub(3).max(1);
	let mut width = 0;
	let mut start = text.len();

	for (index, character) in text.char_indices().rev() {
		let next = width + char_width(character);

		if next > room {
			break;
		}

		width = next;
		start = index;
	}

	format!("...{}", &text[start..])
}

/// Breaks text into lines of at most [width] columns at its spaces.
pub fn wrap(text: &str, width: usize) -> Vec<String> {
	if width < 8 {
		return vec![text.to_string()];
	}

	let mut lines = Vec::new();
	let mut line_start = 0;
	let mut line_end = 0;
	let mut line_width = 0;
	let mut word_start = 0;

	while word_start <= text.len() {
		let word_end = text[word_start..]
			.find(' ')
			.map_or(text.len(), |space| word_start + space);
		let word_width = display_width(&text[word_start..word_end]);

		if line_end == line_start {
			line_start = word_start;
			line_end = word_end;
			line_width = word_width;
		} else if line_width + 1 + word_width > width {
			lines.push(text[line_start..line_end].to_string());
			line_start = word_start;
			line_end = word_end;
			line_width = word_width;
		} else {
			line_end = word_end;
			line_width += 1 + word_width;
		}

		word_start = word_end + 1;
	}

	if line_end > line_start {
		lines.push(text[line_start..line_end].to_string());
	}

	lines
}

/// The counts of a section, coloured, and how many columns they take.
pub fn counts_phrase(counts: &LevelCount, paint: &Paint) -> (String, usize) {
	let mut parts: Vec<String> = Vec::new();
	let mut length = 0;
	let mut add = |count: usize, word: String, painter: &dyn Fn(&str) -> String| {
		if count < 1 {
			return;
		}

		length += if parts.is_empty() { 0 } else { 3 } + word.len();
		parts.push(painter(&word));
	};

	add(counts.error, plural(counts.error, "error"), &|text| {
		paint.error(text)
	});
	add(counts.warn, plural(counts.warn, "warning"), &|text| {
		paint.warn(text)
	});
	// `info` has no plural that reads well, so the noun is left as it is.
	add(counts.info, format!("{} info", counts.info), &|text| {
		paint.info(text)
	});

	if parts.is_empty() {
		return (paint.dim("clean"), 5);
	}

	(parts.join(&paint.dim(" \u{b7} ")), length)
}

/// The counts as a sentence: `Found 1 error, 2 warnings.`
pub fn counts_sentence(counts: &LevelCount) -> String {
	let mut parts = Vec::new();

	if counts.error > 0 {
		parts.push(plural(counts.error, "error"));
	}

	if counts.warn > 0 {
		parts.push(plural(counts.warn, "warning"));
	}

	if counts.info > 0 {
		parts.push(format!("{} info", counts.info));
	}

	if parts.is_empty() {
		"Found no issues.".to_string()
	} else {
		format!("Found {}.", parts.join(", "))
	}
}

/// What the run compared and how long it took.
pub fn scope_sentence(result: &CheckResult) -> String {
	format!(
		"Compared {} across {} in {}. ({}ms)",
		plural(result.key_count, "key"),
		plural(result.locales.len(), "locale"),
		plural(result.groups.len(), "group"),
		result.elapsed_ms
	)
}

/// The value a finding is about, quoted: the target language's when there is
/// one, else the locale's own.
pub fn reference_of(issue: &Issue, target: &str) -> String {
	if let Some(target_value) = &issue.target_value {
		return format!("{target}: {}", quote(Some(target_value)));
	}

	if let Some(value) = &issue.value {
		return format!("{}: {}", issue.locale, quote(Some(value)));
	}

	String::new()
}

/// The message of a finding when it says more than its check's description.
pub fn detail_of(issue: &Issue) -> &str {
	if issue.message == issue.code.meta().description {
		""
	} else {
		&issue.message
	}
}

/// The key a finding is listed under, with its group when there are several.
pub fn key_label_of(issue: &Issue, show_group: bool) -> String {
	if issue.key.is_empty() {
		// A finding about a whole group or file has no key to address it by.
		return String::new();
	}

	if show_group && !issue.group.is_empty() {
		format!("{} @{}", issue.key, issue.group)
	} else {
		issue.key.clone()
	}
}

/// A path relative to [cwd] when it is under it.
pub fn relative_to(path: &str, cwd: &str) -> String {
	if cwd.is_empty() {
		return path.to_string();
	}

	for separator in ["/", "\\"] {
		let prefix = if cwd.ends_with(separator) {
			cwd.to_string()
		} else {
			format!("{cwd}{separator}")
		};

		if let Some(rest) = path.strip_prefix(&prefix) {
			return rest.to_string();
		}
	}

	path.to_string()
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn fits_text_to_columns() {
		assert_eq!(truncate("abcdefghij", 5), "ab...");
		assert_eq!(truncate("abc", 5), "abc");
		assert!(
			display_width(&truncate(
				"\u{d55c}\u{ad6d}\u{c5b4}\u{c785}\u{b2c8}\u{b2e4}",
				7
			)) <= 7
		);
		assert_eq!(truncate_start("src/locales/en.json", 10), "...en.json");
		assert_eq!(wrap("one two three four", 9), ["one two", "three", "four"]);
		assert_eq!(wrap(" a  b ", 8), ["a  b "]);
		assert_eq!(one_line("a \n\t b"), "a b");
	}
}
