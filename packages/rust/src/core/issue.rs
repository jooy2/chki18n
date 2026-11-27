//! Building issues and counting them.

use indexmap::IndexMap;

use crate::constants::{check_meta, CheckCode, Level};
use crate::types::{Issue, LevelCount, Summary};

/// The fields of an issue a check fills in. Anything left out takes the
/// check's own level and description, or stays empty.
#[derive(Clone, Debug, Default)]
pub struct IssueInit {
	/// Overrides the level the check reports at.
	pub level: Option<Level>,
	/// Overrides the check's description.
	pub message: Option<String>,
	/// The locale the issue belongs to.
	pub locale: Option<String>,
	/// The flattened key.
	pub key: Option<String>,
	/// The group the key belongs to.
	pub group: Option<String>,
	/// The value the finding is about.
	pub value: Option<String>,
	/// The target language's value of the key.
	pub target_value: Option<String>,
	/// The placeholder involved.
	pub interpolation: Option<String>,
	/// The other key involved.
	pub related_key: Option<String>,
	/// The file the key came from.
	pub file: Option<String>,
}

/// An issue of [code], with the check's own level and description unless
/// [init] says otherwise.
pub fn create_issue(code: CheckCode, init: IssueInit) -> Issue {
	let meta = check_meta(code);

	Issue {
		code,
		level: init.level.unwrap_or(meta.level),
		locale: init.locale.unwrap_or_default(),
		key: init.key.unwrap_or_default(),
		group: init.group.unwrap_or_default(),
		value: init.value,
		target_value: init.target_value,
		interpolation: init.interpolation,
		related_key: init.related_key,
		file: init.file,
		message: init.message.unwrap_or_else(|| meta.description.to_string()),
	}
}

/// An issue that carries a message and nothing else.
pub fn issue_with_message(code: CheckCode, message: impl Into<String>) -> Issue {
	create_issue(
		code,
		IssueInit {
			message: Some(message.into()),
			..IssueInit::default()
		},
	)
}

/// Re-grades the issues of every check [levels] names.
pub fn apply_level_overrides(issues: &mut [Issue], levels: Option<&IndexMap<CheckCode, Level>>) {
	let Some(levels) = levels else {
		return;
	};

	for issue in issues {
		if let Some(&level) = levels.get(&issue.code) {
			issue.level = level;
		}
	}
}

/// The counts a report is built on.
pub fn summarize_issues(issues: &[Issue]) -> Summary {
	let mut summary = Summary {
		total: issues.len(),
		..Summary::default()
	};
	let mut levels = LevelCount::default();

	for issue in issues {
		levels.add(issue.level);
		*summary.by_code.entry(issue.code).or_insert(0) += 1;

		if !issue.locale.is_empty() {
			summary
				.by_locale
				.entry(issue.locale.clone())
				.or_default()
				.add(issue.level);
		}

		summary
			.by_group
			.entry(issue.group.clone())
			.or_default()
			.add(issue.level);
	}

	summary.error = levels.error;
	summary.warn = levels.warn;
	summary.info = levels.info;

	summary
}

/// Whether any issue is an error, which is what fails a run.
pub fn has_error(issues: &[Issue]) -> bool {
	issues.iter().any(|issue| issue.level == Level::Error)
}
