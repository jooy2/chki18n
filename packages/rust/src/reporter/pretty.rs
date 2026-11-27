//! The report a person reads in a terminal: grouped, coloured sections.

use indexmap::IndexMap;

use crate::constants::GroupBy;
use crate::core::order::compare_text;
use crate::core::width::display_width;
use crate::reporter::context::ReportContext;
use crate::reporter::group::{sub_group_issues, IssueGroup};
use crate::reporter::text::{
	counts_phrase, detail_of, key_label_of, pad_to, plural, reference_of, relative_to,
	scope_sentence, truncate, truncate_start, widest_of, wrap,
};
use crate::types::{Issue, LevelCount};

const INDENT_SECTION: &str = "  ";

const INDENT_ITEM: &str = "    ";

const INDENT_DETAIL: &str = "      ";

const MAX_KEY_COLUMN: usize = 40;

const MAX_LABEL_COLUMN: usize = 30;

/// A heading drawn as a rule across the report, with the counts at its end.
fn rule_line(label: &str, right: Option<(String, usize)>, context: &ReportContext<'_>) -> String {
	let paint = &context.paint;
	let width = context.width;
	let tail_length = right.as_ref().map_or(0, |(_, length)| length + 1);
	// A long label is cut rather than allowed to push the counts past the edge. A
	// path keeps its tail, which is the part that tells one file from another.
	let room = width.saturating_sub(tail_length + 5).max(12);
	let head = if label.is_empty() {
		" ".to_string()
	} else if label.contains('/') || label.contains('\\') {
		format!(" {} ", truncate_start(label, room))
	} else {
		format!(" {} ", truncate(label, room))
	};
	let fill = width
		.saturating_sub(display_width(&head) + tail_length)
		.max(3);
	let counts = right.map_or(String::new(), |(text, _)| format!(" {text}"));

	format!(
		"{}{}{counts}",
		paint.heading(&head),
		paint.dim(&"\u{2500}".repeat(fill))
	)
}

fn head_block(context: &ReportContext<'_>) -> Vec<String> {
	let result = context.result;
	let options = context.options;
	let mut rows: Vec<(&str, String)> = Vec::new();

	if let Some(path) = &options.path {
		rows.push(("Path", relative_to(path, &context.cwd)));
	}

	rows.push(("Target", result.target.clone()));

	if !result.locales.is_empty() {
		rows.push(("Locales", result.locales.join(", ")));
	}

	let mut layout: Vec<String> = Vec::new();

	if let Some(format) = result.file_format {
		layout.push(format.as_str().to_string());
	}

	layout.push(plural(result.groups.len(), "group"));
	layout.push(plural(result.key_count, "key"));
	rows.push(("Layout", layout.join(", ")));

	if let Some(source) = &options.source {
		rows.push(("Sources", relative_to(source, &context.cwd)));
	}

	rows.into_iter()
		.map(|(label, value)| {
			format!(
				"{INDENT_SECTION}{}{value}",
				context.paint.dim(&pad_to(label, 9))
			)
		})
		.collect()
}

fn item_lines(
	issues: &[&Issue],
	context: &ReportContext<'_>,
	show_locale: bool,
	key_width: usize,
) -> Vec<String> {
	let paint = &context.paint;
	let width = context.width;
	let locales: Vec<&str> = issues
		.iter()
		.map(|issue| {
			if show_locale {
				issue.locale.as_str()
			} else {
				""
			}
		})
		.collect();
	let locale_width = widest_of(locales.iter().copied());
	let mut lines = Vec::new();

	for (issue, row_locale) in issues.iter().zip(&locales) {
		let key = key_label_of(issue, context.show_group);

		if key.is_empty() {
			// A bad option or an unreadable file has no key to name; the message is
			// the whole finding.
			for line in wrap(&issue.message, width.saturating_sub(INDENT_ITEM.len())) {
				lines.push(format!("{INDENT_ITEM}{}", paint.value(&line)));
			}

			continue;
		}

		let locale = if locale_width > 0 {
			format!("{}  ", pad_to(row_locale, locale_width))
		} else {
			String::new()
		};
		let room = width as isize
			- INDENT_ITEM.len() as isize
			- display_width(&locale) as isize
			- key_width as isize
			- 2;
		let raw_reference = reference_of(issue, &context.result.target);
		let reference = if raw_reference.is_empty() {
			String::new()
		} else {
			truncate(&raw_reference, room.max(16) as usize)
		};
		let cut = truncate(&key, key_width);
		// Padded only when something follows it, so a line that ends on the key
		// does not end on the spaces that would have lined the next column up.
		let label = if reference.is_empty() {
			cut
		} else {
			pad_to(&cut, key_width)
		};
		let after = if reference.is_empty() {
			String::new()
		} else {
			format!("  {}", paint.value(&reference))
		};

		lines.push(format!(
			"{INDENT_ITEM}{}{}{after}",
			paint.dim(&locale),
			paint.key(&label)
		));

		let detail = detail_of(issue);

		if !detail.is_empty() {
			for line in wrap(detail, width.saturating_sub(INDENT_DETAIL.len())) {
				lines.push(format!("{INDENT_DETAIL}{}", paint.dim(&line)));
			}
		}
	}

	lines
}

fn description_line(issues: &[&Issue], context: &ReportContext<'_>, indent: &str) -> Vec<String> {
	let Some(first) = issues.first() else {
		return Vec::new();
	};

	let description = first.code.meta().description;

	if issues.iter().all(|issue| !detail_of(issue).is_empty()) {
		return Vec::new();
	}

	wrap(description, context.width.saturating_sub(indent.len()))
		.into_iter()
		.map(|line| format!("{indent}{}", context.paint.dim(&line)))
		.collect()
}

fn key_column_of(section: &IssueGroup<'_>, context: &ReportContext<'_>) -> usize {
	let labels: Vec<String> = section
		.issues
		.iter()
		.map(|issue| key_label_of(issue, context.show_group))
		.collect();

	widest_of(labels.iter().map(String::as_str)).min(MAX_KEY_COLUMN)
}

fn check_section(section: &IssueGroup<'_>, context: &ReportContext<'_>) -> Vec<String> {
	let mut lines = vec![String::new()];

	lines.extend(description_line(&section.issues, context, INDENT_SECTION));
	lines.extend(item_lines(
		&section.issues,
		context,
		true,
		key_column_of(section, context),
	));

	lines
}

fn mixed_section(section: &IssueGroup<'_>, context: &ReportContext<'_>) -> Vec<String> {
	let paint = &context.paint;
	let key_width = key_column_of(section, context);
	let mut lines = Vec::new();

	// Keyed by severity as well as by check: one check can report at two levels
	// once `levels` re-grades it.
	for part in sub_group_issues(&section.issues, |issue| {
		format!("{} {}", issue.level.as_str(), issue.code.as_str())
	}) {
		let first = part.issues[0];

		lines.push(String::new());
		lines.push(format!(
			"{INDENT_SECTION}{}  {}{}",
			paint.level(
				first.level,
				&pad_to(&first.level.as_str().to_uppercase(), 5)
			),
			paint.heading(first.code.as_str()),
			paint.dim(&format!(" ({})", part.issues.len()))
		));
		lines.extend(description_line(
			&part.issues,
			context,
			&format!("{INDENT_SECTION}{}", " ".repeat(7)),
		));
		lines.extend(item_lines(&part.issues, context, false, key_width));
	}

	lines
}

fn cross_tab_rows(context: &ReportContext<'_>) -> Vec<String> {
	let result = context.result;
	let paint = &context.paint;
	let by_locale = context.options.group_by == GroupBy::Code;
	let mut counts: IndexMap<String, LevelCount> = IndexMap::new();

	for issue in &context.issues {
		let id = if by_locale {
			issue.locale.clone()
		} else {
			issue.code.as_str().to_string()
		};

		counts.entry(id).or_default().add(issue.level);
	}

	if by_locale {
		// A language with nothing wrong is worth saying out loud, so every locale
		// that took part gets a row.
		for locale in &result.locales {
			counts.entry(locale.clone()).or_default();
		}
	}

	let mut rows: Vec<(String, LevelCount)> = counts
		.into_iter()
		.map(|(id, count)| {
			(
				if id.is_empty() {
					"(general)".to_string()
				} else {
					id
				},
				count,
			)
		})
		.collect();

	rows.sort_by(|a, b| {
		b.1.error
			.cmp(&a.1.error)
			.then(b.1.warn.cmp(&a.1.warn))
			.then(b.1.info.cmp(&a.1.info))
			.then_with(|| compare_text(&a.0, &b.0))
	});

	if rows.is_empty() {
		return Vec::new();
	}

	let label_width = widest_of(rows.iter().map(|(label, _)| label.as_str())).min(MAX_LABEL_COLUMN);
	let mut lines = vec![
		String::new(),
		format!(
			"{INDENT_SECTION}{}",
			paint.dim(if by_locale { "By locale" } else { "By check" })
		),
	];

	for (label, count) in &rows {
		lines.push(format!(
			"{INDENT_ITEM}{}  {}",
			paint.key(&pad_to(&truncate(label, label_width), label_width)),
			counts_phrase(count, paint).0
		));
	}

	lines
}

fn summary_block(context: &ReportContext<'_>) -> Vec<String> {
	let result = context.result;
	let paint = &context.paint;
	let summary = LevelCount {
		error: result.summary.error,
		warn: result.summary.warn,
		info: result.summary.info,
	};
	let mut lines = vec![
		String::new(),
		format!("{INDENT_SECTION}{}", paint.dim(&scope_sentence(result))),
		format!("{INDENT_SECTION}{}", counts_phrase(&summary, paint).0),
	];

	if context.hidden > 0 {
		lines.push(format!(
			"{INDENT_SECTION}{}",
			paint.dim(&format!(
				"{} not shown, because of the level options.",
				plural(context.hidden, "issue")
			))
		));
	}

	if context.options.group_by == GroupBy::Locale {
		let clean: Vec<&str> = result
			.locales
			.iter()
			.filter(|locale| {
				!context
					.sections
					.iter()
					.any(|section| &section.id == *locale)
			})
			.map(String::as_str)
			.collect();

		if !clean.is_empty() {
			lines.push(format!(
				"{INDENT_SECTION}{}",
				paint.dim(&format!("Clean: {}", clean.join(", ")))
			));
		}
	}

	lines.extend(cross_tab_rows(context));

	lines
}

fn verdict_line(context: &ReportContext<'_>) -> String {
	let result = context.result;
	let paint = &context.paint;

	if result.success {
		return format!(
			" {} {}",
			paint.pass(" PASS "),
			paint.dim("No error level issue was found.")
		);
	}

	format!(
		" {} {} must be fixed before this passes.",
		paint.fail(" FAIL "),
		plural(result.summary.error, "error")
	)
}

/// The report a person reads in a terminal.
pub fn format_pretty(context: &ReportContext<'_>) -> String {
	let options = context.options;
	let paint = &context.paint;
	let mut lines: Vec<String> = Vec::new();

	if options.info {
		lines.extend(head_block(context));
	}

	for section in &context.sections {
		lines.push(String::new());
		lines.push(rule_line(
			&section.label,
			Some(counts_phrase(&section.counts, paint)),
			context,
		));
		lines.extend(if options.group_by == GroupBy::Code {
			check_section(section, context)
		} else {
			mixed_section(section, context)
		});
	}

	if context.sections.is_empty() {
		lines.push(String::new());
		lines.push(format!(
			"{INDENT_SECTION}{}",
			paint.dim("Nothing to report.")
		));
	}

	if options.info {
		lines.push(String::new());
		lines.push(rule_line("Summary", None, context));
		lines.extend(summary_block(context));
	}

	lines.push(String::new());
	lines.push(verdict_line(context));

	lines.join("\n")
}
