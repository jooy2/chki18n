//! Reading a directory and checking it, in one call or as a session kept in
//! memory.

use std::fs;
use std::path::Path;
use std::time::Instant;

use indexmap::IndexSet;
use serde_json::{json, Map, Value};

use crate::constants::{CheckCode, Level, MAX_MEASURED_REPORT_WIDTH};
use crate::core::duplicate::collect_flat_keys_of_map;
use crate::core::interpolation::Delimiters;
use crate::core::issue::{create_issue, IssueInit};
use crate::core::js::stringify_pretty;
use crate::core::result::{build_result, ResultFacts};
use crate::core::session::Session;
use crate::loader::scan::scan_translation_directory;
use crate::loader::unused_keys::{find_unused_keys, UsageScan};
use crate::loader::walk::resolve_path;
use crate::logger::Logger;
use crate::options::{Options, ResolvedOptions};
use crate::reporter::context::ReportInit;
use crate::reporter::format_result;
use crate::types::{CheckResult, Input, Issue, TranslationGroups};

/// A directory of translation files read once and kept, so the same set can be
/// checked as often as needed without touching the file system again.
pub struct FileSession {
	session: Session,
	path: String,
	skipped: Vec<String>,
	detected_interpolation: Option<Delimiters>,
}

impl FileSession {
	/// The session the translations are held in.
	pub fn session(&self) -> &Session {
		&self.session
	}

	/// The session, to change a value and check it again.
	pub fn session_mut(&mut self) -> &mut Session {
		&mut self.session
	}

	/// Absolute path the translations were read from.
	pub fn path(&self) -> &str {
		&self.path
	}

	/// Files that belong to no locale, whether read or left unread for their path.
	pub fn skipped(&self) -> &[String] {
		&self.skipped
	}

	/// Interpolation delimiters the files look like they are written with. What
	/// the scan saw, not what it used.
	pub fn detected_interpolation(&self) -> Option<Delimiters> {
		self.detected_interpolation
	}

	/// The options every check runs with.
	pub fn options(&self) -> &ResolvedOptions {
		self.session.options()
	}

	/// Compares everything the session holds.
	pub fn analyze(&self) -> CheckResult {
		self.session.analyze()
	}

	/// What the source tree says about the keys: the ones nothing refers to, and
	/// the ones it asks for that nothing defines. The project's own translation
	/// files are left out of the search, since a key appears verbatim in the file
	/// that defines it.
	fn usage_of(&self, groups: &TranslationGroups, files: &[String]) -> UsageScan {
		let options = self.session.options();
		let wanted = options.enabled_checks.contains(&CheckCode::UnusedKey)
			|| options.enabled_checks.contains(&CheckCode::UndefinedKey);

		let Some(source) = options.source.as_deref().filter(|_| wanted) else {
			return UsageScan::default();
		};

		let mut keys: IndexSet<String> = IndexSet::new();

		for locales in groups.values() {
			for translations in locales.values() {
				collect_flat_keys_of_map(translations, &mut keys);
			}
		}

		let keys: Vec<String> = keys.into_iter().collect();

		find_unused_keys(&resolve_path(source), &keys, options, files)
	}

	/// Reads the directory again, replacing everything the session holds.
	pub fn reload(&mut self) {
		if self.path.is_empty() {
			self.skipped = Vec::new();
			self.detected_interpolation = None;
			self.session.reset(Input {
				issues: Some(vec![create_issue(
					CheckCode::InvalidOptions,
					IssueInit {
						level: Some(Level::Error),
						message: Some("No `path` argument is specified.".to_string()),
						..IssueInit::default()
					},
				)]),
				..Input::default()
			});
			return;
		}

		let scan = scan_translation_directory(Path::new(&self.path), self.session.options());
		let file_paths: Vec<String> = scan.files.iter().map(|file| file.path.clone()).collect();
		let usage = self.usage_of(&scan.groups, &file_paths);

		self.skipped = scan.skipped;
		self.detected_interpolation = scan.detected_interpolation;
		self.session.reset(Input {
			groups: Some(scan.groups),
			files: Some(scan.files),
			issues: Some(scan.issues),
			file_format: Some(scan.file_format),
			unused_keys: Some(usage.unused_keys),
			undefined_keys: Some(usage.undefined_keys),
			locales: None,
		});
	}
}

/// Reads a directory of translation files once and keeps them. [path] is read
/// unless the options name one, which wins.
pub fn load_translations(path: Option<&str>, options: &Options) -> FileSession {
	let merged = Options {
		path: options.path.clone().or_else(|| path.map(str::to_string)),
		flattened: Some(false),
		..options.clone()
	};
	let session = Session::new(Input::default(), &merged);
	let scan_path = session
		.options()
		.path
		.as_deref()
		.map(|path| resolve_path(path).to_string_lossy().into_owned())
		.unwrap_or_default();
	let mut file_session = FileSession {
		session,
		path: scan_path,
		skipped: Vec::new(),
		detected_interpolation: None,
	};

	file_session.reload();

	file_session
}

/// The terminal's own width, where it can be asked for one.
#[cfg(unix)]
fn terminal_columns() -> Option<usize> {
	use std::io::IsTerminal;

	if !std::io::stdout().is_terminal() {
		return None;
	}

	let mut size = libc::winsize {
		ws_row: 0,
		ws_col: 0,
		ws_xpixel: 0,
		ws_ypixel: 0,
	};
	// SAFETY: `TIOCGWINSZ` writes one `winsize` into the pointer it is given,
	// which points at a value that lives for the whole call.
	let read = unsafe { libc::ioctl(libc::STDOUT_FILENO, libc::TIOCGWINSZ, &mut size) };

	(read == 0 && size.ws_col > 0).then_some(usize::from(size.ws_col))
}

/// The terminal's own width, which this build does not ask for.
#[cfg(not(unix))]
fn terminal_columns() -> Option<usize> {
	None
}

/// Columns the console report lays itself out to: what `width` asked for, else
/// the terminal's own width, else what `COLUMNS` says, capped at 120 when it was
/// measured. `None` leaves the reporter on its own default.
pub fn console_width(options: &ResolvedOptions) -> Option<usize> {
	if let Some(width) = options.width {
		return Some(width as usize);
	}

	let measured = terminal_columns().or_else(|| {
		std::env::var("COLUMNS")
			.ok()
			.and_then(|columns| columns.trim().parse::<usize>().ok())
	})?;

	(measured > 0).then(|| measured.min(MAX_MEASURED_REPORT_WIDTH))
}

fn working_directory() -> String {
	std::env::current_dir()
		.map(|cwd| cwd.to_string_lossy().into_owned())
		.unwrap_or_default()
}

/// Writes the report to the file `output` names, creating the directory it sits
/// in. A write that fails comes back as an issue rather than as an error.
fn write_report(result: &CheckResult, options: &ResolvedOptions) -> Option<Issue> {
	let output = options.output.as_deref()?;
	let reporter = options.output_reporter?;
	let file = resolve_path(output);
	// A saved report is read later, by someone who no longer has the terminal:
	// no escape codes, and the same width wherever it is run from.
	let text = format_result(
		result,
		options,
		&ReportInit {
			reporter: Some(reporter),
			color: Some(false),
			width: options.width.map(|width| width as usize),
			cwd: Some(working_directory()),
		},
	);
	let written = file
		.parent()
		.map_or(Ok(()), fs::create_dir_all)
		.and_then(|()| fs::write(&file, format!("{text}\n")));

	written.err().map(|error| {
		create_issue(
			CheckCode::InvalidOptions,
			IssueInit {
				level: Some(Level::Error),
				message: Some(format!(
					"The report could not be written to `{output}`: {error}"
				)),
				..IssueInit::default()
			},
		)
	})
}

/// The resolved options as the debug line prints them.
fn options_json(options: &ResolvedOptions) -> Value {
	let mut object = Map::new();
	let text = |value: &Option<String>| value.as_ref().map_or(Value::Null, |text| json!(text));

	object.insert("path".into(), text(&options.path));
	object.insert("target".into(), json!(options.target));
	object.insert("format".into(), json!(options.format.as_str()));
	object.insert(
		"enabledChecks".into(),
		json!(options
			.enabled_checks
			.iter()
			.map(|code| code.as_str())
			.collect::<Vec<_>>()),
	);
	object.insert(
		"levels".into(),
		options.levels.as_ref().map_or(Value::Null, |levels| {
			Value::Object(
				levels
					.iter()
					.map(|(code, level)| (code.as_str().into(), json!(level.as_str())))
					.collect(),
			)
		}),
	);
	object.insert(
		"interpolationPrefix".into(),
		json!(options.interpolation_prefix),
	);
	object.insert(
		"interpolationSuffix".into(),
		json!(options.interpolation_suffix),
	);
	object.insert(
		"exclude".into(),
		json!(options.exclude.iter().collect::<Vec<_>>()),
	);
	object.insert(
		"excludeFiles".into(),
		json!(options.exclude_files.iter().collect::<Vec<_>>()),
	);
	object.insert("source".into(), text(&options.source));
	object.insert(
		"translateFunctions".into(),
		json!(options.translate_functions),
	);
	object.insert(
		"keyCase".into(),
		options
			.key_case
			.map_or(Value::Null, |case| json!(case.as_str())),
	);
	object.insert(
		"maxKeyDepth".into(),
		options
			.max_key_depth
			.map_or(Value::Null, |depth| json!(depth)),
	);
	object.insert(
		"lengthRatio".into(),
		options
			.length_ratio
			.map_or(Value::Null, |ratio| json!(ratio)),
	);
	object.insert("reporter".into(), json!(options.reporter.as_str()));
	object.insert("groupBy".into(), json!(options.group_by.as_str()));
	object.insert("output".into(), text(&options.output));
	object.insert(
		"outputReporter".into(),
		options
			.output_reporter
			.map_or(Value::Null, |reporter| json!(reporter.as_str())),
	);
	object.insert("color".into(), json!(options.color));
	object.insert(
		"width".into(),
		options.width.map_or(Value::Null, |width| json!(width)),
	);
	object.insert("flattened".into(), json!(options.flattened));
	object.insert("verbose".into(), json!(options.verbose));
	object.insert("info".into(), json!(options.info));
	object.insert("warn".into(), json!(options.warn));
	object.insert("debug".into(), json!(options.debug));

	Value::Object(object)
}

/// Reads a directory of translation files and compares every language against
/// the target language, in one call.
///
/// Nothing is printed unless `verbose` is set, so the result is the only thing a
/// caller has to act on. Reach for [load_translations] instead when the same
/// directory is checked more than once.
pub fn check_translation_files(path: Option<&str>, options: &Options) -> CheckResult {
	let started_at = Instant::now();
	let session = load_translations(path, options);
	let resolved = session.options().clone();
	let logger = Logger::new(&resolved);

	logger.debug(&format!(
		"Options: {}",
		stringify_pretty(&options_json(&resolved), "\t")
	));
	logger.debug(&format!(
		"Detected file format: {}",
		session
			.session()
			.file_format()
			.map_or("null", |format| format.as_str())
	));

	for file in session.skipped() {
		logger.debug(&format!(
			"Skipped '{file}': it does not belong to a known locale."
		));
	}

	// The session times its own comparison; this call also paid for the scan.
	let mut analysis = session.analyze();

	analysis.elapsed_ms = started_at.elapsed().as_millis();

	let result = match write_report(&analysis, &resolved) {
		// A report that could not be saved is a failure of the run, so it joins
		// the issues instead of being mentioned once and forgotten.
		Some(failed) => {
			let mut issues = analysis.issues.clone();

			issues.push(failed);
			build_result(
				issues,
				&resolved,
				ResultFacts {
					locales: analysis.locales,
					groups: analysis.groups,
					key_count: analysis.key_count,
					files: analysis.files,
					file_format: analysis.file_format,
					elapsed_ms: analysis.elapsed_ms,
				},
			)
		}
		None => analysis,
	};

	if resolved.verbose {
		println!(
			"{}",
			format_result(
				&result,
				&resolved,
				&ReportInit {
					width: console_width(&resolved),
					cwd: Some(working_directory()),
					..ReportInit::default()
				}
			)
		);
	}

	result
}
