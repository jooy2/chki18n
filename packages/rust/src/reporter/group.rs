//! Sorting issues into the sections a report is laid out in.

use std::cmp::Ordering;

use indexmap::IndexMap;

use crate::constants::{CheckCode, GroupBy};
use crate::core::order::compare_text;
use crate::reporter::text::relative_to;
use crate::types::{Issue, LevelCount};

/// One section of a report.
#[derive(Clone, Debug)]
pub struct IssueGroup<'a> {
	/// What the section is about: a locale, a check, a group or a file.
	pub id: String,
	/// The heading the section is shown under.
	pub label: String,
	/// Its issues, most severe first.
	pub issues: Vec<&'a Issue>,
	/// How many of each level it holds.
	pub counts: LevelCount,
}

/// One part of a section, holding the issues one key shares.
#[derive(Clone, Debug)]
pub struct IssueSubGroup<'a> {
	/// What the issues share.
	pub id: String,
	/// The issues, in the order they were met.
	pub issues: Vec<&'a Issue>,
	/// How many of each level it holds.
	pub counts: LevelCount,
}

const GENERAL_LABEL: &str = "(general)";

const DEFAULT_GROUP_LABEL: &str = "(default)";

/// The order issues are listed in inside a section: errors first, then by check,
/// locale and key.
pub fn compare_issues(a: &Issue, b: &Issue) -> Ordering {
	a.level
		.cmp(&b.level)
		.then(a.code.rank().cmp(&b.code.rank()))
		.then_with(|| compare_text(&a.locale, &b.locale))
		.then_with(|| compare_text(&a.key, &b.key))
}

fn axis_value_of(issue: &Issue, group_by: GroupBy) -> String {
	match group_by {
		GroupBy::Code => issue.code.as_str().to_string(),
		GroupBy::Group => issue.group.clone(),
		GroupBy::File => issue.file.clone().unwrap_or_default(),
		GroupBy::Locale => issue.locale.clone(),
		GroupBy::None => String::new(),
	}
}

fn label_of(id: &str, group_by: GroupBy, cwd: &str) -> String {
	match group_by {
		GroupBy::None => String::new(),
		GroupBy::Group => {
			if id.is_empty() {
				DEFAULT_GROUP_LABEL.to_string()
			} else {
				id.to_string()
			}
		}
		_ if id.is_empty() => GENERAL_LABEL.to_string(),
		GroupBy::File => relative_to(id, cwd),
		_ => id.to_string(),
	}
}

fn severity_rank(counts: &LevelCount) -> u8 {
	if counts.error > 0 {
		0
	} else if counts.warn > 0 {
		1
	} else {
		2
	}
}

fn code_rank_of(id: &str) -> usize {
	CheckCode::parse(id).map_or(CheckCode::ALL.len(), CheckCode::rank)
}

/// The sections a report shows, most severe first.
pub fn group_issues<'a>(issues: &[&'a Issue], group_by: GroupBy, cwd: &str) -> Vec<IssueGroup<'a>> {
	let mut sections: IndexMap<String, IssueGroup<'a>> = IndexMap::new();

	for issue in issues {
		let id = axis_value_of(issue, group_by);
		let section = sections.entry(id.clone()).or_insert_with(|| IssueGroup {
			label: label_of(&id, group_by, cwd),
			id,
			issues: Vec::new(),
			counts: LevelCount::default(),
		});

		section.issues.push(issue);
		section.counts.add(issue.level);
	}

	let mut sections: Vec<IssueGroup<'a>> = sections.into_values().collect();

	for section in &mut sections {
		section.issues.sort_by(|a, b| compare_issues(a, b));
	}

	sections.sort_by(|a, b| {
		severity_rank(&a.counts)
			.cmp(&severity_rank(&b.counts))
			.then(b.counts.error.cmp(&a.counts.error))
			.then(b.counts.warn.cmp(&a.counts.warn))
			.then_with(|| {
				if group_by == GroupBy::Code {
					code_rank_of(&a.id).cmp(&code_rank_of(&b.id))
				} else {
					compare_text(&a.id, &b.id)
				}
			})
	});

	sections
}

/// The issues split by [by], in the order each part is first met.
pub fn sub_group_issues<'a>(
	issues: &[&'a Issue],
	by: impl Fn(&Issue) -> String,
) -> Vec<IssueSubGroup<'a>> {
	let mut parts: IndexMap<String, IssueSubGroup<'a>> = IndexMap::new();

	for issue in issues {
		let id = by(issue);
		let part = parts.entry(id.clone()).or_insert_with(|| IssueSubGroup {
			id,
			issues: Vec::new(),
			counts: LevelCount::default(),
		});

		part.issues.push(issue);
		part.counts.add(issue.level);
	}

	parts.into_values().collect()
}
