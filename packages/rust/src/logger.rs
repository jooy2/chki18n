//! Diagnostics for the command line, and only diagnostics: the findings are
//! rendered by the reporter. They go to standard error so that a report piped
//! out of standard output stays parseable with `--debug` on.

use crate::options::ResolvedOptions;
use crate::reporter::paint::supports_color;

/// Writes debug lines when asked to, and nothing otherwise.
pub struct Logger {
	label: Option<String>,
}

impl Logger {
	/// A logger that speaks only when `debug` is on.
	pub fn new(options: &ResolvedOptions) -> Logger {
		if !options.debug {
			return Logger { label: None };
		}

		let label = if options.color && supports_color() {
			"\x1b[104m\x1b[97m Chki18n \x1b[39m\x1b[49m\x1b[44m\x1b[97m DEBUG \x1b[39m\x1b[49m"
				.to_string()
		} else {
			" Chki18n  DEBUG ".to_string()
		};

		Logger { label: Some(label) }
	}

	/// Writes one diagnostic line.
	pub fn debug(&self, message: &str) {
		if let Some(label) = &self.label {
			eprintln!("{label} {message}");
		}
	}
}
