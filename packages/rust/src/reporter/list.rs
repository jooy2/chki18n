//! One line per issue, for grepping and for editor integrations.

use crate::core::chars::is_space;
use crate::reporter::context::ReportContext;
use crate::reporter::text::{
	counts_sentence, detail_of, key_label_of, pad_to, reference_of, scope_sentence, widest_of,
};
use crate::types::LevelCount;

/// One line per issue, then the totals.
pub fn format_list(context: &ReportContext<'_>) -> String {
	let paint = &context.paint;
	let result = context.result;
	let issues: Vec<_> = context
		.sections
		.iter()
		.flat_map(|section| section.issues.iter().copied())
		.collect();
	let rows: Vec<(String, String, String)> = issues
		.iter()
		.map(|issue| {
			let locale = if issue.locale.is_empty() {
				"-".to_string()
			} else {
				issue.locale.clone()
			};
			let key = key_label_of(issue, context.show_group);
			let key = if key.is_empty() { "-".to_string() } else { key };
			let detail: Vec<String> = [
				reference_of(issue, &result.target),
				detail_of(issue).to_string(),
			]
			.into_iter()
			.filter(|part| !part.is_empty())
			.collect();

			(locale, key, detail.join("  "))
		})
		.collect();
	let locale_width = widest_of(rows.iter().map(|row| row.0.as_str()));
	let code_width = widest_of(issues.iter().map(|issue| issue.code.as_str()));
	let key_width = widest_of(rows.iter().map(|row| row.1.as_str()));
	let lines: Vec<String> = issues
		.iter()
		.zip(&rows)
		.map(|(issue, (locale, key, detail))| {
			[
				pad_to(locale, locale_width),
				paint.level(issue.level, &pad_to(issue.level.as_str(), 5)),
				paint.heading(&pad_to(issue.code.as_str(), code_width)),
				paint.key(&pad_to(key, key_width)),
				paint.value(detail),
			]
			.join("  ")
			.trim_end_matches(is_space)
			.to_string()
		})
		.collect();

	if !context.options.info {
		return lines.join("\n");
	}

	let counts = LevelCount {
		error: result.summary.error,
		warn: result.summary.warn,
		info: result.summary.info,
	};
	let summary = format!("{} {}", counts_sentence(&counts), scope_sentence(result));

	// Nothing to separate from when there are no findings, so no blank line.
	if lines.is_empty() {
		summary
	} else {
		format!("{}\n\n{summary}", lines.join("\n"))
	}
}
