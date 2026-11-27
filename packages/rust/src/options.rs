//! Every option, the command line flag that sets it, and how both resolve into
//! the one shape the rest of the library reads.

use indexmap::{IndexMap, IndexSet};

use crate::constants::{
	reporter_by_extension, CheckCode, FileFormat, GroupBy, KeyCase, Level, Reporter,
	ANALYZE_CHECK_CODES, DEFAULT_EXCLUDE_DIRS, DEFAULT_EXCLUDE_FILES, DEFAULT_INTERPOLATION_PREFIX,
	DEFAULT_INTERPOLATION_SUFFIX, DEFAULT_TARGET_LOCALE, TRANSLATION_FUNCTIONS,
};
use crate::core::chars::is_space;
use crate::core::issue::{create_issue, issue_with_message, IssueInit};
use crate::core::js::number_to_string;
use crate::types::Issue;

/// What kind of value a flag takes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OptionType {
	/// One value.
	String,
	/// A flag on its own.
	Boolean,
	/// Several values, separated by commas or spaces.
	List,
}

/// One option, as the command line and the usage text describe it.
#[derive(Clone, Copy, Debug)]
pub struct OptionDefinition {
	/// The flag, without its leading dashes.
	pub flag: &'static str,
	/// The field it sets, as the JavaScript package names it.
	pub option: &'static str,
	/// What kind of value it takes.
	pub kind: OptionType,
	/// The placeholder the usage text shows for its value.
	pub value_name: Option<&'static str>,
	/// What the usage text says about it.
	pub description: &'static str,
}

const fn definition(
	flag: &'static str,
	option: &'static str,
	kind: OptionType,
	value_name: Option<&'static str>,
	description: &'static str,
) -> OptionDefinition {
	OptionDefinition {
		flag,
		option,
		kind,
		value_name,
		description,
	}
}

/// Every option, in the order the usage text lists them. The command line
/// builds its parser and its help from this table, so a flag and its option
/// cannot drift apart.
pub const OPTION_DEFINITIONS: [OptionDefinition; 23] = [
	definition(
		"path",
		"path",
		OptionType::String,
		Some("<dir>"),
		"The directory where the files to be scanned are located (required)",
	),
	definition(
		"target",
		"target",
		OptionType::String,
		Some("<locale>"),
		"The language every other language is compared against (default: `en`)",
	),
	definition(
		"format",
		"format",
		OptionType::String,
		Some("<format>"),
		"Layout of the translation files: `auto`, `single`, `folder` or `nested`",
	),
	definition(
		"checks",
		"checks",
		OptionType::List,
		Some("<codes>"),
		"Run only these comma separated check codes",
	),
	definition(
		"ignore-checks",
		"ignoreChecks",
		OptionType::List,
		Some("<codes>"),
		"Run every check except these comma separated check codes",
	),
	definition(
		"levels",
		"levels",
		OptionType::List,
		Some("<code=level>"),
		"Report a check at another severity, e.g. `EMPTY_VALUE=error`",
	),
	definition(
		"interpolation-prefix",
		"interpolationPrefix",
		OptionType::String,
		Some("<str>"),
		"Opening delimiter of an interpolation key (default: `{`)",
	),
	definition(
		"interpolation-suffix",
		"interpolationSuffix",
		OptionType::String,
		Some("<str>"),
		"Closing delimiter of an interpolation key (default: `}`)",
	),
	definition(
		"exclude",
		"exclude",
		OptionType::List,
		Some("<dirs>"),
		"Comma separated directory names or paths to skip while scanning",
	),
	definition(
		"exclude-files",
		"excludeFiles",
		OptionType::List,
		Some("<globs>"),
		"Comma separated file name patterns never read as translations",
	),
	definition(
		"source",
		"source",
		OptionType::String,
		Some("<dir>"),
		"Source files to read for key usages (enables `UNUSED_KEY` and `UNDEFINED_KEY`)",
	),
	definition(
		"translate-functions",
		"translateFunctions",
		OptionType::List,
		Some("<names>"),
		"Comma separated names a translation call goes by (default: `t`, `$t`, `translate`)",
	),
	definition(
		"key-case",
		"keyCase",
		OptionType::String,
		Some("<case>"),
		"Case every key segment has to use: `kebab`, `camel`, `snake`",
	),
	definition(
		"max-key-depth",
		"maxKeyDepth",
		OptionType::String,
		Some("<levels>"),
		"How many levels a key may be nested, e.g. `2` for `attr.folder`",
	),
	definition(
		"length-ratio",
		"lengthRatio",
		OptionType::String,
		Some("<times>"),
		"Report a value more than this many times longer or shorter than the target",
	),
	definition(
		"reporter",
		"reporter",
		OptionType::String,
		Some("<name>"),
		"How to render the report: `pretty`, `list`, `json`, `markdown`, `github`",
	),
	definition(
		"group-by",
		"groupBy",
		OptionType::String,
		Some("<axis>"),
		"Group the reported issues by `locale`, `code`, `group`, `file`, `none`",
	),
	definition(
		"output",
		"output",
		OptionType::String,
		Some("<file>"),
		"Also write the report to this file, in the format its extension implies",
	),
	definition(
		"width",
		"width",
		OptionType::String,
		Some("<columns>"),
		"Lay the report out to this many columns instead of measuring the terminal",
	),
	definition(
		"no-color",
		"color",
		OptionType::Boolean,
		None,
		"Do not colour the output",
	),
	definition(
		"no-info",
		"info",
		OptionType::Boolean,
		None,
		"Do not show info messages",
	),
	definition(
		"no-warn",
		"warn",
		OptionType::Boolean,
		None,
		"Do not show warning messages",
	),
	definition(
		"debug",
		"debug",
		OptionType::Boolean,
		None,
		"Show debug messages",
	),
];

/// Options shared by the command line and the library.
///
/// Every field is optional. The ones a closed set of values or a number would
/// suit are taken as the text a person wrote, the way the command line has
/// them, so a value that cannot be used is reported in the same words by every
/// package rather than refused before it is read. A list field takes items
/// that may themselves be separated by commas or spaces.
#[derive(Clone, Debug, Default)]
pub struct Options {
	/// Directory holding the translation files.
	pub path: Option<String>,
	/// Locale every other locale is compared against. Default `en`.
	pub target: Option<String>,
	/// `auto`, `single`, `folder` or `nested`. Default `auto`.
	pub format: Option<String>,
	/// Only run these checks. Cannot be used together with `ignore_checks`.
	pub checks: Option<Vec<String>>,
	/// Run every check except these.
	pub ignore_checks: Option<Vec<String>>,
	/// Report checks at another severity, as `CODE=level` entries.
	pub levels: Option<Vec<String>>,
	/// Opening delimiter of an interpolation placeholder. Default `{`.
	pub interpolation_prefix: Option<String>,
	/// Closing delimiter of an interpolation placeholder. Default `}`.
	pub interpolation_suffix: Option<String>,
	/// Directories skipped while scanning. Replaces the default list.
	pub exclude: Option<Vec<String>>,
	/// File names never read as translations, as `*` patterns. Replaces the
	/// default list.
	pub exclude_files: Option<Vec<String>>,
	/// Directory of source files to search for key usages.
	pub source: Option<String>,
	/// Names a translation call goes by. Replaces the default list.
	pub translate_functions: Option<Vec<String>>,
	/// `kebab`, `camel` or `snake`, for the `KEY_NAMING` check.
	pub key_case: Option<String>,
	/// Levels a key may be nested, for the `KEY_DEPTH` check.
	pub max_key_depth: Option<String>,
	/// How many times longer or shorter than the target language a value may be,
	/// for the `SUSPICIOUS_LENGTH` check.
	pub length_ratio: Option<String>,
	/// Treat the input as already flattened and skip the flatten pass.
	pub flattened: Option<bool>,
	/// `pretty`, `list`, `json`, `markdown` or `github`. Default `pretty`.
	pub reporter: Option<String>,
	/// `locale`, `code`, `group`, `file` or `none`. Default `locale`.
	pub group_by: Option<String>,
	/// Also write the report to this file.
	pub output: Option<String>,
	/// Colour the console report. Default `true`.
	pub color: Option<bool>,
	/// Columns to lay the report out to.
	pub width: Option<String>,
	/// Print the report to the console. Default `false`.
	pub verbose: Option<bool>,
	/// Show info level findings. Default `true`.
	pub info: Option<bool>,
	/// Show warn level findings. Default `true`.
	pub warn: Option<bool>,
	/// Print debug lines to standard error. Default `false`.
	pub debug: Option<bool>,
}

/// Options after defaults and the loose forms have been resolved.
#[derive(Clone, Debug)]
pub struct ResolvedOptions {
	pub path: Option<String>,
	pub target: String,
	pub format: FileFormat,
	pub enabled_checks: IndexSet<CheckCode>,
	/// Severity overrides, or `None` when every check keeps its own.
	pub levels: Option<IndexMap<CheckCode, Level>>,
	pub interpolation_prefix: String,
	pub interpolation_suffix: String,
	pub exclude: IndexSet<String>,
	pub exclude_files: IndexSet<String>,
	pub source: Option<String>,
	pub translate_functions: Vec<String>,
	pub key_case: Option<KeyCase>,
	pub max_key_depth: Option<u64>,
	pub length_ratio: Option<f64>,
	pub reporter: Reporter,
	pub group_by: GroupBy,
	pub output: Option<String>,
	/// Reporter the `output` file gets. `None` when nothing is written.
	pub output_reporter: Option<Reporter>,
	pub color: bool,
	/// Columns asked for, or `None` to measure the terminal instead.
	pub width: Option<u64>,
	pub flattened: bool,
	pub verbose: bool,
	pub info: bool,
	pub warn: bool,
	pub debug: bool,
}

/// Splits `["A,B", "C D"]` into `["A", "B", "C", "D"]`, the way every list option
/// is read.
pub fn to_list(items: Option<&Vec<String>>) -> Vec<String> {
	let Some(items) = items else {
		return Vec::new();
	};

	items
		.iter()
		.flat_map(|item| item.split(|character: char| character == ',' || is_space(character)))
		.map(|item| item.trim_matches(is_space))
		.filter(|item| !item.is_empty())
		.map(str::to_string)
		.collect()
}

/// A string read as a number the way JavaScript's `Number(text)` reads it, or
/// `NaN` when it is not one.
pub fn js_number(text: &str) -> f64 {
	let trimmed = text.trim_matches(is_space);

	if trimmed.is_empty() {
		return 0.0;
	}

	let radix = match trimmed.get(..2) {
		Some("0x") | Some("0X") => Some(16),
		Some("0o") | Some("0O") => Some(8),
		Some("0b") | Some("0B") => Some(2),
		_ => None,
	};

	if let Some(radix) = radix {
		let digits = &trimmed[2..];

		if digits.is_empty() || !digits.chars().all(|digit| digit.is_digit(radix)) {
			return f64::NAN;
		}

		return digits.chars().fold(0.0, |value, digit| {
			value * f64::from(radix) + f64::from(digit.to_digit(radix).unwrap_or(0))
		});
	}

	let unsigned = trimmed
		.strip_prefix(|sign| sign == '+' || sign == '-')
		.unwrap_or(trimmed);

	if unsigned == "Infinity" {
		return if trimmed.starts_with('-') {
			f64::NEG_INFINITY
		} else {
			f64::INFINITY
		};
	}

	// What a decimal literal may hold: digits, one point, and an exponent.
	let bytes = unsigned.as_bytes();
	let mut index = 0;
	let mut digits = 0;

	while index < bytes.len() && bytes[index].is_ascii_digit() {
		index += 1;
		digits += 1;
	}

	if index < bytes.len() && bytes[index] == b'.' {
		index += 1;

		while index < bytes.len() && bytes[index].is_ascii_digit() {
			index += 1;
			digits += 1;
		}
	}

	if digits == 0 {
		return f64::NAN;
	}

	if index < bytes.len() && (bytes[index] == b'e' || bytes[index] == b'E') {
		index += 1;

		if index < bytes.len() && (bytes[index] == b'+' || bytes[index] == b'-') {
			index += 1;
		}

		let start = index;

		while index < bytes.len() && bytes[index].is_ascii_digit() {
			index += 1;
		}

		if index == start {
			return f64::NAN;
		}
	}

	if index != bytes.len() {
		return f64::NAN;
	}

	trimmed.parse::<f64>().unwrap_or(f64::NAN)
}

/// The reporter a file name asks for. A `.json` or a `.md` report has a shape of
/// its own; anything else is read as plain text and gets the default reporter.
pub fn reporter_of_file_name(file_name: &str) -> Reporter {
	let extension = file_name.rsplit('.').next().unwrap_or("").to_lowercase();

	reporter_by_extension(&extension).unwrap_or(Reporter::Pretty)
}

/// Usage text for `--help`, built from [OPTION_DEFINITIONS].
pub fn build_usage_text(bin_name: &str) -> String {
	let mut lines = vec![
		format!("Usage: `{bin_name} [options]` or `{bin_name} [options] <targetDirectory>`"),
		String::new(),
		"Options:".to_string(),
	];

	for definition in OPTION_DEFINITIONS {
		let flag = match definition.value_name {
			Some(value) => format!("--{} {value}", definition.flag),
			None => format!("--{}", definition.flag),
		};

		lines.push(format!("  {flag:<32}{}", definition.description));
	}

	lines.push("  --help                          Show this message".to_string());
	lines.push("  --version                       Show the installed version".to_string());
	lines.push(String::new());
	lines.push(format!(
		"Check codes: {}",
		ANALYZE_CHECK_CODES
			.iter()
			.map(|code| code.as_str())
			.collect::<Vec<_>>()
			.join(", ")
	));

	lines.join("\n")
}

/// Records an option that could not be used as given.
fn invalid(issues: &mut Vec<Issue>, message: String) {
	issues.push(issue_with_message(CheckCode::InvalidOptions, message));
}

/// Fills in defaults and reads the loose forms an option may take, so that
/// everything downstream reads one resolved shape. Anything unusable is
/// reported as an `INVALID_OPTIONS` issue instead of stopping the run.
pub fn resolve_options(options: &Options) -> (ResolvedOptions, Vec<Issue>) {
	let mut issues: Vec<Issue> = Vec::new();

	let target = match options.target.as_deref() {
		Some(target) if !target.is_empty() => target.to_string(),
		_ => {
			// Reported so a caller can see which language it ended up comparing
			// against, but at `info`: leaving `target` out is a default, not a fault.
			issues.push(create_issue(
				CheckCode::InvalidOptions,
				IssueInit {
					level: Some(Level::Info),
					message: Some(format!(
						"No target language is specified. Defaulting to `{DEFAULT_TARGET_LOCALE}`."
					)),
					..IssueInit::default()
				},
			));
			DEFAULT_TARGET_LOCALE.to_string()
		}
	};

	let format = match options.format.as_deref() {
		None => FileFormat::Auto,
		Some(text) => FileFormat::parse(text).unwrap_or_else(|| {
			invalid(
				&mut issues,
				format!("Unknown format `{text}`. Defaulting to `auto`."),
			);
			FileFormat::Auto
		}),
	};

	let read_check_codes = |issues: &mut Vec<Issue>, value: Option<&Vec<String>>, name: &str| {
		let mut codes = Vec::new();

		for item in to_list(value) {
			match CheckCode::parse(&item) {
				Some(code) => codes.push(code),
				None => invalid(
					issues,
					format!("Unknown check code `{item}` in `{name}` was ignored."),
				),
			}
		}

		codes
	};

	let only = read_check_codes(&mut issues, options.checks.as_ref(), "checks");
	let ignored = read_check_codes(&mut issues, options.ignore_checks.as_ref(), "ignoreChecks");
	let enabled_checks: IndexSet<CheckCode> = if !only.is_empty() {
		if !ignored.is_empty() {
			invalid(
				&mut issues,
				"`checks` and `ignoreChecks` cannot be used together. `ignoreChecks` was ignored."
					.to_string(),
			);
		}

		only.into_iter().collect()
	} else {
		ANALYZE_CHECK_CODES
			.iter()
			.copied()
			.filter(|code| !ignored.contains(code))
			.collect()
	};

	let mut levels: Option<IndexMap<CheckCode, Level>> = None;

	for entry in to_list(options.levels.as_ref()) {
		let mut parts = entry.split('=');
		let raw_code = parts.next().unwrap_or("");
		let raw_level = parts.next();
		let code = CheckCode::parse(raw_code).filter(|code| ANALYZE_CHECK_CODES.contains(code));

		let Some(code) = code else {
			invalid(
				&mut issues,
				format!("`{raw_code}` in `levels` is not a check whose severity can be changed."),
			);
			continue;
		};

		let Some(level) = raw_level.and_then(Level::parse) else {
			invalid(
				&mut issues,
				format!(
					"`{}` is not a level. Use `error`, `warn` or `info`.",
					raw_level.unwrap_or("undefined")
				),
			);
			continue;
		};

		levels.get_or_insert_with(IndexMap::new).insert(code, level);
	}

	let interpolation_prefix = match options.interpolation_prefix.as_deref() {
		Some(prefix) if !prefix.is_empty() => prefix.to_string(),
		_ => DEFAULT_INTERPOLATION_PREFIX.to_string(),
	};
	let interpolation_suffix = match options.interpolation_suffix.as_deref() {
		Some(suffix) if !suffix.is_empty() => suffix.to_string(),
		_ => DEFAULT_INTERPOLATION_SUFFIX.to_string(),
	};

	// Said out loud, because nothing else would say it: every interpolation
	// check would pass on every value without having read one placeholder.
	if interpolation_prefix == interpolation_suffix {
		invalid(
			&mut issues,
			format!(
				"`interpolationPrefix` and `interpolationSuffix` are both `{interpolation_prefix}`, so a placeholder's start cannot be told from its end. Interpolation keys were not checked."
			),
		);
	}

	let exclude = to_list(options.exclude.as_ref());
	let exclude_files = to_list(options.exclude_files.as_ref());
	let translate_functions = to_list(options.translate_functions.as_ref());
	let output = options.output.clone().filter(|output| !output.is_empty());

	let reporter = read_choice(
		&mut issues,
		options.reporter.as_deref(),
		Reporter::parse,
		Reporter::Pretty,
		Reporter::as_str,
		"reporter",
	);
	let width = read_number(&mut issues, options.width.as_deref(), "width", 1.0, true);
	let max_key_depth = read_number(
		&mut issues,
		options.max_key_depth.as_deref(),
		"maxKeyDepth",
		1.0,
		true,
	);
	// A ratio of one would report every value whose length is not exactly the
	// target's, which is every value there is.
	let length_ratio = read_number(
		&mut issues,
		options.length_ratio.as_deref(),
		"lengthRatio",
		1.01,
		false,
	);

	let key_case = match options.key_case.as_deref() {
		Some(text) if !text.is_empty() => KeyCase::parse(text).or_else(|| {
			invalid(
				&mut issues,
				format!("Unknown `keyCase` value `{text}`. Key names were not checked."),
			);
			None
		}),
		_ => None,
	};
	// Read last, as the JavaScript package reads it, so its finding comes last.
	let group_by = read_choice(
		&mut issues,
		options.group_by.as_deref(),
		GroupBy::parse,
		GroupBy::Locale,
		GroupBy::as_str,
		"groupBy",
	);

	let has_reporter = options
		.reporter
		.as_deref()
		.is_some_and(|reporter| !reporter.is_empty());
	let output_reporter = output.as_deref().map(|file| {
		// An explicit `reporter` always wins; without one the file name decides.
		if has_reporter {
			reporter
		} else {
			reporter_of_file_name(file)
		}
	});

	let resolved = ResolvedOptions {
		path: options.path.clone().filter(|path| !path.is_empty()),
		target,
		format,
		enabled_checks,
		levels,
		interpolation_prefix,
		interpolation_suffix,
		exclude: if exclude.is_empty() {
			DEFAULT_EXCLUDE_DIRS
				.iter()
				.map(|entry| entry.to_string())
				.collect()
		} else {
			exclude.into_iter().collect()
		},
		exclude_files: if exclude_files.is_empty() {
			DEFAULT_EXCLUDE_FILES
				.iter()
				.map(|entry| entry.to_string())
				.collect()
		} else {
			exclude_files.into_iter().collect()
		},
		source: options.source.clone().filter(|source| !source.is_empty()),
		translate_functions: if translate_functions.is_empty() {
			TRANSLATION_FUNCTIONS
				.iter()
				.map(|name| name.to_string())
				.collect()
		} else {
			translate_functions
		},
		key_case,
		max_key_depth: max_key_depth.map(|depth| depth as u64),
		length_ratio,
		reporter,
		group_by,
		output,
		output_reporter,
		color: options.color != Some(false),
		width: width.map(|width| width as u64),
		flattened: options.flattened == Some(true),
		verbose: options.verbose == Some(true),
		info: options.info != Some(false),
		warn: options.warn != Some(false),
		debug: options.debug == Some(true),
	};

	(resolved, issues)
}

/// Reads one of the closed value sets, falling back rather than failing.
fn read_choice<T: Copy>(
	issues: &mut Vec<Issue>,
	value: Option<&str>,
	parse: fn(&str) -> Option<T>,
	fallback: T,
	name_of: fn(T) -> &'static str,
	option_name: &str,
) -> T {
	let Some(text) = value.filter(|text| !text.is_empty()) else {
		return fallback;
	};

	parse(text).unwrap_or_else(|| {
		issues.push(issue_with_message(
			CheckCode::InvalidOptions,
			format!(
				"Unknown `{option_name}` value `{text}`. Defaulting to `{}`.",
				name_of(fallback)
			),
		));
		fallback
	})
}

/// Reads a number an option needs, or `None` when there is none. An unusable
/// value is reported and dropped rather than guessed at.
fn read_number(
	issues: &mut Vec<Issue>,
	value: Option<&str>,
	option_name: &str,
	least: f64,
	whole: bool,
) -> Option<f64> {
	let text = value.filter(|text| !text.is_empty())?;
	let parsed = js_number(text);

	if !parsed.is_finite() || parsed < least {
		issues.push(issue_with_message(
			CheckCode::InvalidOptions,
			format!("`{text}` is not a usable `{option_name}`. It was ignored."),
		));

		return None;
	}

	Some(if whole { parsed.floor() } else { parsed })
}

/// The flags a command line was given, read the way the Dart package reads
/// them: `--flag value`, `--flag=value`, `--no-flag` for a negated boolean, a
/// bare `--flag` for a boolean, and everything else positional.
#[derive(Clone, Debug, Default)]
pub struct ParsedArgs {
	/// Values by flag, as written after it. A flag given twice keeps every value.
	pub values: IndexMap<String, Vec<String>>,
	/// Booleans by flag, `false` for a `--no-` form.
	pub flags: IndexMap<String, bool>,
	/// Arguments that are not flags.
	pub positional: Vec<String>,
}

/// Reads a command line into its flags and positional arguments.
pub fn parse_arguments(arguments: &[String]) -> ParsedArgs {
	let value_flags: Vec<&str> = OPTION_DEFINITIONS
		.iter()
		.filter(|definition| definition.kind != OptionType::Boolean)
		.map(|definition| definition.flag)
		.collect();
	let mut parsed = ParsedArgs::default();
	let mut index = 0;

	while index < arguments.len() {
		let argument = &arguments[index];

		index += 1;

		let Some(body) = argument.strip_prefix("--") else {
			parsed.positional.push(argument.clone());
			continue;
		};

		if let Some((flag, value)) = body.split_once('=') {
			parsed
				.values
				.entry(flag.to_string())
				.or_default()
				.push(value.to_string());
			continue;
		}

		if let Some(negated) = body.strip_prefix("no-") {
			if !value_flags.contains(&body) {
				parsed.flags.insert(negated.to_string(), false);
				continue;
			}
		}

		if value_flags.contains(&body) {
			if index < arguments.len() {
				parsed
					.values
					.entry(body.to_string())
					.or_default()
					.push(arguments[index].clone());
				index += 1;
			}

			continue;
		}

		parsed.flags.insert(body.to_string(), true);
	}

	parsed
}

/// The options a command line asks for.
pub fn options_from_args(args: &ParsedArgs) -> Options {
	let camel = |flag: &str| {
		let mut out = String::new();
		let mut upper = false;

		for character in flag.chars() {
			if character == '-' {
				upper = true;
			} else if upper {
				out.extend(character.to_uppercase());
				upper = false;
			} else {
				out.push(character);
			}
		}

		out
	};
	let values = |flag: &str| {
		args.values
			.get(flag)
			.or_else(|| args.values.get(&camel(flag)))
			.cloned()
	};
	// A flag given twice reads as its last value, a list flag as all of them.
	let single = |flag: &str| values(flag).and_then(|all| all.last().cloned());
	let boolean = |flag: &str| {
		args.flags
			.get(flag)
			.or_else(|| args.flags.get(&camel(flag)))
			.copied()
	};

	Options {
		path: single("path").or_else(|| args.positional.first().cloned()),
		target: single("target"),
		format: single("format"),
		checks: values("checks"),
		ignore_checks: values("ignore-checks"),
		levels: values("levels"),
		interpolation_prefix: single("interpolation-prefix"),
		interpolation_suffix: single("interpolation-suffix"),
		exclude: values("exclude"),
		exclude_files: values("exclude-files"),
		source: single("source"),
		translate_functions: values("translate-functions"),
		key_case: single("key-case"),
		max_key_depth: single("max-key-depth"),
		length_ratio: single("length-ratio"),
		reporter: single("reporter"),
		group_by: single("group-by"),
		output: single("output"),
		width: single("width"),
		color: boolean("color"),
		info: boolean("info"),
		warn: boolean("warn"),
		debug: boolean("debug"),
		flattened: None,
		verbose: None,
	}
}

/// The text a number option is written back as in a log line.
pub fn number_text(number: f64) -> String {
	number_to_string(number)
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn reads_numbers_the_way_javascript_does() {
		assert_eq!(js_number(" 12 "), 12.0);
		assert_eq!(js_number("0x10"), 16.0);
		assert_eq!(js_number("1e3"), 1000.0);
		assert_eq!(js_number(".5"), 0.5);
		assert_eq!(js_number("5."), 5.0);
		assert!(js_number("abc").is_nan());
		assert!(js_number("inf").is_nan());
		assert!(js_number("1e").is_nan());
		assert!(js_number("-Infinity").is_infinite());
		assert_eq!(js_number(""), 0.0);
	}

	#[test]
	fn splits_lists_on_commas_and_spaces() {
		let items = vec!["A,B".to_string(), " C  D ".to_string()];

		assert_eq!(to_list(Some(&items)), ["A", "B", "C", "D"]);
	}

	#[test]
	fn reports_what_it_could_not_use() {
		let (resolved, issues) = resolve_options(&Options {
			target: Some("en".into()),
			checks: Some(vec!["NO_KEY,BOGUS".into()]),
			width: Some("abc".into()),
			levels: Some(vec!["EMPTY_VALUE".into(), "NO_KEY=fatal".into()]),
			..Options::default()
		});
		let messages: Vec<&str> = issues.iter().map(|issue| issue.message.as_str()).collect();

		assert_eq!(
			messages,
			[
				"Unknown check code `BOGUS` in `checks` was ignored.",
				"`undefined` is not a level. Use `error`, `warn` or `info`.",
				"`fatal` is not a level. Use `error`, `warn` or `info`.",
				"`abc` is not a usable `width`. It was ignored."
			]
		);
		assert_eq!(resolved.enabled_checks.len(), 1);
		assert!(resolved.width.is_none());
	}

	#[test]
	fn reads_a_command_line() {
		let arguments: Vec<String> = [
			"./locales",
			"--target",
			"ko",
			"--no-color",
			"--width=80",
			"--debug",
		]
		.iter()
		.map(|item| item.to_string())
		.collect();
		let options = options_from_args(&parse_arguments(&arguments));

		assert_eq!(options.path.as_deref(), Some("./locales"));
		assert_eq!(options.target.as_deref(), Some("ko"));
		assert_eq!(options.color, Some(false));
		assert_eq!(options.width.as_deref(), Some("80"));
		assert_eq!(options.debug, Some(true));
	}
}
