//! What every reporter works from: the issues a person asked to see, sorted
//! into sections, and the width to lay them out to.

use crate::constants::{GroupBy, Level, Reporter, DEFAULT_REPORT_WIDTH};
use crate::options::ResolvedOptions;
use crate::reporter::group::{group_issues, IssueGroup};
use crate::reporter::paint::Paint;
use crate::types::{CheckResult, Issue, LevelCount};

const MIN_WIDTH: usize = 40;

const MAX_WIDTH: usize = 400;

/// What one rendering may set beyond the options.
#[derive(Clone, Debug, Default)]
pub struct ReportInit {
	/// Overrides the options' reporter. A file output renders its own.
	pub reporter: Option<Reporter>,
	/// Overrides the options' `color`. A file never gets escape codes.
	pub color: Option<bool>,
	/// Columns to lay the report out to. Defaults to 96.
	pub width: Option<usize>,
	/// Working directory, so a path can be shown relative to it.
	pub cwd: Option<String>,
}

/// Everything a reporter reads.
pub struct ReportContext<'a> {
	pub result: &'a CheckResult,
	pub options: &'a ResolvedOptions,
	/// The issues the level options leave in view.
	pub issues: Vec<&'a Issue>,
	pub sections: Vec<IssueGroup<'a>>,
	/// How many issues the level options keep out of view.
	pub hidden: usize,
	pub counts: LevelCount,
	pub paint: Paint,
	pub width: usize,
	pub cwd: String,
	/// Whether a key is shown with its group.
	pub show_group: bool,
}

/// The context of one rendering.
pub fn build_report_context<'a>(
	result: &'a CheckResult,
	options: &'a ResolvedOptions,
	init: &ReportInit,
) -> ReportContext<'a> {
	let issues: Vec<&Issue> = result
		.issues
		.iter()
		.filter(|issue| {
			(issue.level != Level::Warn || options.warn)
				&& (issue.level != Level::Info || options.info)
		})
		.collect();
	let mut counts = LevelCount::default();

	for issue in &issues {
		counts.add(issue.level);
	}

	let cwd = init.cwd.clone().unwrap_or_default();
	let asked = init
		.width
		.filter(|width| *width > 0)
		.unwrap_or(DEFAULT_REPORT_WIDTH);
	let sections = group_issues(&issues, options.group_by, &cwd);

	ReportContext {
		hidden: result.issues.len() - issues.len(),
		result,
		options,
		issues,
		sections,
		counts,
		paint: Paint::new(init.color.unwrap_or(options.color)),
		width: asked.clamp(MIN_WIDTH, MAX_WIDTH),
		cwd,
		// A section that already is a group or a file has named it in its heading.
		show_group: result.groups.len() > 1
			&& options.group_by != GroupBy::Group
			&& options.group_by != GroupBy::File,
	}
}
