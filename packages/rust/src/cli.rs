//! The `chki18n` command.

use crate::check::check_translation_files;
use crate::constants::Reporter;
use crate::options::{build_usage_text, options_from_args, parse_arguments, Options};

const BIN_NAME: &str = "chki18n";

/// Runs the command over [arguments] and returns its exit code: `1` when an
/// error level issue was found.
pub fn run(arguments: &[String]) -> i32 {
	let parsed = parse_arguments(arguments);

	if parsed.flags.get("help") == Some(&true) {
		println!("{}", build_usage_text(BIN_NAME));
		return 0;
	}

	if parsed.flags.get("version") == Some(&true) {
		println!("{}", env!("CARGO_PKG_VERSION"));
		return 0;
	}

	let options = options_from_args(&parsed);
	let is_pretty = options
		.reporter
		.as_deref()
		.is_none_or(|reporter| reporter.to_lowercase() == Reporter::Pretty.as_str());

	// The banner belongs to the report a person reads. Anything piped into
	// another program has to start with its own first line.
	if options.info != Some(false) && is_pretty {
		println!("Chki18n {}\n", env!("CARGO_PKG_VERSION"));
	}

	let result = check_translation_files(
		None,
		&Options {
			verbose: Some(true),
			..options
		},
	);

	if result.success {
		0
	} else {
		1
	}
}
