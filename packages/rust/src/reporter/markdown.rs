//! Tables, for pasting into a pull request or a report.

use crate::constants::GroupBy;
use crate::reporter::context::ReportContext;
use crate::reporter::text::{
	counts_sentence, detail_of, key_label_of, pad_to, plural, reference_of, scope_sentence,
	widest_of,
};
use crate::types::LevelCount;

/// Text that cannot end a table cell early.
fn cell(text: &str) -> String {
	text.replace('|', "\\|")
}

/// A value shown as code, so its markup reads as written.
fn code(text: &str) -> String {
	if text.is_empty() {
		String::new()
	} else {
		format!("`{}`", cell(text))
	}
}

/// Prose with its markup shown as written: everything outside a code span has
/// its `&`, `<` and `>` escaped, and a code span is left as it is.
fn prose(text: &str) -> String {
	let text = cell(text);
	let escape = |part: &str| {
		part.replace('&', "&amp;")
			.replace('<', "&lt;")
			.replace('>', "&gt;")
	};
	let mut out = String::new();
	let mut rest = text.as_str();

	while let Some(open) = rest.find('`') {
		let Some(close) = rest[open + 1..].find('`').map(|close| open + 1 + close) else {
			break;
		};

		out.push_str(&escape(&rest[..open]));
		out.push_str(&rest[open..=close]);
		rest = &rest[close + 1..];
	}

	out.push_str(&escape(rest));

	out
}

fn table(header: &[&str], rows: &[Vec<String>]) -> Vec<String> {
	let widths: Vec<usize> = header
		.iter()
		.enumerate()
		.map(|(column, title)| {
			widest_of(std::iter::once(*title).chain(rows.iter().map(|row| row[column].as_str())))
		})
		.collect();
	let line = |cells: Vec<&str>| {
		let padded: Vec<String> = cells
			.iter()
			.enumerate()
			.map(|(column, text)| pad_to(text, widths[column]))
			.collect();

		format!("| {} |", padded.join(" | "))
	};
	let mut lines = vec![line(header.to_vec())];

	lines.push(format!(
		"| {} |",
		widths
			.iter()
			.map(|width| "-".repeat(*width))
			.collect::<Vec<_>>()
			.join(" | ")
	));

	for row in rows {
		lines.push(line(row.iter().map(String::as_str).collect()));
	}

	lines
}

/// Every section as a table.
pub fn format_markdown(context: &ReportContext<'_>) -> String {
	let result = context.result;
	let counts = LevelCount {
		error: result.summary.error,
		warn: result.summary.warn,
		info: result.summary.info,
	};
	let mut lines = vec![
		"# Translation check".to_string(),
		String::new(),
		format!(
			"**{}** {} Compared against `{}`.",
			counts_sentence(&counts),
			scope_sentence(result),
			result.target
		),
	];
	let by_code = context.options.group_by == GroupBy::Code;

	for section in &context.sections {
		lines.push(String::new());
		lines.push(format!(
			"## {}",
			if section.label.is_empty() {
				"Issues"
			} else {
				&section.label
			}
		));
		lines.push(String::new());

		let rows: Vec<Vec<String>> = section
			.issues
			.iter()
			.map(|issue| {
				vec![
					issue.level.as_str().to_string(),
					code(if by_code {
						&issue.locale
					} else {
						issue.code.as_str()
					}),
					code(&key_label_of(issue, context.show_group)),
					prose(&reference_of(issue, &result.target)),
					prose(detail_of(issue)),
				]
			})
			.collect();

		lines.extend(table(
			&[
				"Level",
				if by_code { "Locale" } else { "Check" },
				"Key",
				"Value",
				"Note",
			],
			&rows,
		));
	}

	if context.sections.is_empty() {
		lines.push(String::new());
		lines.push("Nothing to report.".to_string());
	}

	if context.hidden > 0 {
		lines.push(String::new());
		lines.push(format!(
			"{} not shown, because of the level options.",
			plural(context.hidden, "issue")
		));
	}

	lines.join("\n")
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn escapes_markup_outside_code_spans() {
		assert_eq!(prose("a <b> `<c>` & d"), "a &lt;b&gt; `<c>` &amp; d");
		assert_eq!(prose("one ` open <x>"), "one ` open &lt;x&gt;");
		assert_eq!(prose("a | b"), "a \\| b");
	}
}
