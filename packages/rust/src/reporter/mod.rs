//! Rendering a result in the shape a reader asked for.

pub mod context;
pub mod github;
pub mod group;
pub mod list;
pub mod markdown;
pub mod paint;
pub mod pretty;
pub mod text;

use crate::constants::Reporter;
use crate::core::js::stringify_pretty;
use crate::options::ResolvedOptions;
use crate::reporter::context::{build_report_context, ReportInit};
use crate::types::CheckResult;

/// A result as text, in the reporter [init] or the options name.
pub fn format_result(result: &CheckResult, options: &ResolvedOptions, init: &ReportInit) -> String {
	let reporter = init.reporter.unwrap_or(options.reporter);

	// The whole result, unfiltered: the level options shape what a person reads,
	// and a program asking for JSON wants everything that was found.
	if reporter == Reporter::Json {
		return stringify_pretty(&result.to_json(), "  ");
	}

	let context = build_report_context(result, options, init);

	match reporter {
		Reporter::List => list::format_list(&context),
		Reporter::Markdown => markdown::format_markdown(&context),
		Reporter::Github => github::format_github(&context),
		_ => pretty::format_pretty(&context),
	}
}
