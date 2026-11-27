//! Colours for the console report, as the JavaScript package's `chalk` styles
//! write them.

use std::io::IsTerminal;

use crate::constants::Level;

/// How each part of a report is coloured, or not at all.
#[derive(Clone, Copy, Debug)]
pub struct Paint {
	coloured: bool,
}

/// A style's opening and closing escape codes.
type Style = (&'static str, &'static str);

const RED_BRIGHT: Style = ("\x1b[91m", "\x1b[39m");
const YELLOW_BRIGHT: Style = ("\x1b[93m", "\x1b[39m");
const GRAY: Style = ("\x1b[90m", "\x1b[39m");
const BOLD_WHITE_BRIGHT: Style = ("\x1b[1m\x1b[97m", "\x1b[39m\x1b[22m");
const CYAN_BRIGHT: Style = ("\x1b[96m", "\x1b[39m");
const WHITE: Style = ("\x1b[37m", "\x1b[39m");
const PASS: Style = ("\x1b[102m\x1b[97m", "\x1b[39m\x1b[49m");
const FAIL: Style = ("\x1b[101m\x1b[97m", "\x1b[39m\x1b[49m");

/// Whether the console takes colour at all: forced on by `FORCE_COLOR`, off
/// under `NO_COLOR` or a `dumb` terminal, and otherwise on for a terminal only.
pub fn supports_color() -> bool {
	if let Ok(force) = std::env::var("FORCE_COLOR") {
		return force != "0" && force != "false";
	}

	if std::env::var_os("NO_COLOR").is_some() {
		return false;
	}

	if std::env::var("TERM").is_ok_and(|term| term == "dumb") {
		return false;
	}

	std::io::stdout().is_terminal()
}

impl Paint {
	/// Colours when [enabled] and the console takes them, plain text otherwise.
	pub fn new(enabled: bool) -> Paint {
		Paint {
			coloured: enabled && supports_color(),
		}
	}

	/// Plain text, whatever the console takes.
	pub fn plain() -> Paint {
		Paint { coloured: false }
	}

	fn style(&self, (open, close): Style, text: &str) -> String {
		if !self.coloured || text.is_empty() {
			return text.to_string();
		}

		format!("{open}{text}{close}")
	}

	pub fn error(&self, text: &str) -> String {
		self.style(RED_BRIGHT, text)
	}

	pub fn warn(&self, text: &str) -> String {
		self.style(YELLOW_BRIGHT, text)
	}

	pub fn info(&self, text: &str) -> String {
		self.style(GRAY, text)
	}

	pub fn heading(&self, text: &str) -> String {
		self.style(BOLD_WHITE_BRIGHT, text)
	}

	pub fn key(&self, text: &str) -> String {
		self.style(CYAN_BRIGHT, text)
	}

	pub fn value(&self, text: &str) -> String {
		self.style(WHITE, text)
	}

	pub fn dim(&self, text: &str) -> String {
		self.style(GRAY, text)
	}

	pub fn pass(&self, text: &str) -> String {
		self.style(PASS, text)
	}

	pub fn fail(&self, text: &str) -> String {
		self.style(FAIL, text)
	}

	/// The colour of a level.
	pub fn level(&self, level: Level, text: &str) -> String {
		match level {
			Level::Error => self.error(text),
			Level::Warn => self.warn(text),
			Level::Info => self.info(text),
		}
	}
}
