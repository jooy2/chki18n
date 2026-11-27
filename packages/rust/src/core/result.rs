//! Putting a result together from its issues and the facts of the run.

use crate::constants::FileFormat;
use crate::core::issue::{has_error, summarize_issues};
use crate::options::ResolvedOptions;
use crate::types::{CheckResult, Issue, SourceFile};

/// What a run knew besides its issues.
#[derive(Clone, Debug, Default)]
pub struct ResultFacts {
	/// Every locale that took part.
	pub locales: Vec<String>,
	/// Every group that took part.
	pub groups: Vec<String>,
	/// Distinct keys compared.
	pub key_count: usize,
	/// Files read from disk.
	pub files: Vec<SourceFile>,
	/// The layout the files were read in.
	pub file_format: Option<FileFormat>,
	/// How long the run took.
	pub elapsed_ms: u128,
}

/// A result from its issues, with the counts worked out from them.
pub fn build_result(
	issues: Vec<Issue>,
	options: &ResolvedOptions,
	facts: ResultFacts,
) -> CheckResult {
	CheckResult {
		success: !has_error(&issues),
		summary: summarize_issues(&issues),
		issues,
		target: options.target.clone(),
		locales: facts.locales,
		groups: facts.groups,
		key_count: facts.key_count,
		files: facts.files,
		file_format: facts.file_format,
		elapsed_ms: facts.elapsed_ms,
	}
}
