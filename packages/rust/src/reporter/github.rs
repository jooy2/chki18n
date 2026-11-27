//! Workflow commands, so GitHub Actions annotates the files themselves.

use crate::constants::Level;
use crate::reporter::context::ReportContext;
use crate::reporter::text::{
	counts_sentence, key_label_of, reference_of, relative_to, scope_sentence,
};
use crate::types::LevelCount;

fn annotation(level: Level) -> &'static str {
	match level {
		Level::Error => "error",
		Level::Warn => "warning",
		Level::Info => "notice",
	}
}

fn escape_data(value: &str) -> String {
	value
		.replace('%', "%25")
		.replace('\r', "%0D")
		.replace('\n', "%0A")
}

fn escape_property(value: &str) -> String {
	escape_data(value).replace(':', "%3A").replace(',', "%2C")
}

/// One annotation per issue, then the totals as a plain line.
pub fn format_github(context: &ReportContext<'_>) -> String {
	let result = context.result;
	let mut lines: Vec<String> = context
		.sections
		.iter()
		.flat_map(|section| section.issues.iter())
		.map(|issue| {
			let mut properties = Vec::new();

			if let Some(file) = issue.file.as_deref().filter(|file| !file.is_empty()) {
				properties.push(format!(
					"file={}",
					escape_property(&relative_to(file, &context.cwd).replace('\\', "/"))
				));
			}

			properties.push(format!(
				"title={}",
				escape_property(&format!("chki18n {}", issue.code.as_str()))
			));

			let reference = reference_of(issue, &result.target);
			let subject: Vec<String> = [
				issue.locale.clone(),
				key_label_of(issue, context.show_group),
			]
			.into_iter()
			.filter(|part| !part.is_empty())
			.collect();
			let message: Vec<String> = [
				subject.join(" "),
				issue.message.clone(),
				if reference.is_empty() {
					String::new()
				} else {
					format!("({reference})")
				},
			]
			.into_iter()
			.filter(|part| !part.is_empty())
			.collect();

			format!(
				"::{} {}::{}",
				annotation(issue.level),
				properties.join(","),
				escape_data(&message.join(" "))
			)
		})
		.collect();

	if !context.options.info {
		return lines.join("\n");
	}

	// Plain text rather than a command: a run's totals belong in the log, not as
	// one more annotation for a reviewer to dismiss.
	let counts = LevelCount {
		error: result.summary.error,
		warn: result.summary.warn,
		info: result.summary.info,
	};

	lines.push(format!(
		"{} {}",
		counts_sentence(&counts),
		scope_sentence(result)
	));

	lines.join("\n")
}
