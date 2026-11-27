//! The fixed vocabulary of the library: every check, what it means and how badly
//! it is meant, the layouts and reporters there are, and the defaults.

use std::fmt;

/// One check identifier, written the way every package spells it (`NO_KEY`).
///
/// The variants are declared in report order, which is the order the
/// JavaScript package's `CHECK_CODE` object holds them in.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum CheckCode {
	Unknown,
	InvalidOptions,
	InvalidFile,
	InvalidValueType,
	NoLocale,
	NoKey,
	DummyKey,
	DuplicateKey,
	UnusedKey,
	UndefinedKey,
	NoPluralForm,
	KeyNaming,
	KeyDepth,
	EmptyValue,
	NoInterpolationKey,
	ExtraInterpolationKey,
	InterpolationCount,
	TagMismatch,
	NotTranslatedValue,
	UntranslatedScript,
	DuplicateValue,
	InconsistentValue,
	SurroundingWhitespace,
	InvisibleCharacter,
	MissingNumber,
	NumberMismatch,
	SuspiciousLength,
}

impl CheckCode {
	/// Every check, in report order.
	pub const ALL: [CheckCode; 27] = [
		CheckCode::Unknown,
		CheckCode::InvalidOptions,
		CheckCode::InvalidFile,
		CheckCode::InvalidValueType,
		CheckCode::NoLocale,
		CheckCode::NoKey,
		CheckCode::DummyKey,
		CheckCode::DuplicateKey,
		CheckCode::UnusedKey,
		CheckCode::UndefinedKey,
		CheckCode::NoPluralForm,
		CheckCode::KeyNaming,
		CheckCode::KeyDepth,
		CheckCode::EmptyValue,
		CheckCode::NoInterpolationKey,
		CheckCode::ExtraInterpolationKey,
		CheckCode::InterpolationCount,
		CheckCode::TagMismatch,
		CheckCode::NotTranslatedValue,
		CheckCode::UntranslatedScript,
		CheckCode::DuplicateValue,
		CheckCode::InconsistentValue,
		CheckCode::SurroundingWhitespace,
		CheckCode::InvisibleCharacter,
		CheckCode::MissingNumber,
		CheckCode::NumberMismatch,
		CheckCode::SuspiciousLength,
	];

	/// The spelling the command line, the JSON report and every package share.
	pub fn as_str(self) -> &'static str {
		match self {
			CheckCode::Unknown => "UNKNOWN",
			CheckCode::InvalidOptions => "INVALID_OPTIONS",
			CheckCode::InvalidFile => "INVALID_FILE",
			CheckCode::InvalidValueType => "INVALID_VALUE_TYPE",
			CheckCode::NoLocale => "NO_LOCALE",
			CheckCode::NoKey => "NO_KEY",
			CheckCode::DummyKey => "DUMMY_KEY",
			CheckCode::DuplicateKey => "DUPLICATE_KEY",
			CheckCode::UnusedKey => "UNUSED_KEY",
			CheckCode::UndefinedKey => "UNDEFINED_KEY",
			CheckCode::NoPluralForm => "NO_PLURAL_FORM",
			CheckCode::KeyNaming => "KEY_NAMING",
			CheckCode::KeyDepth => "KEY_DEPTH",
			CheckCode::EmptyValue => "EMPTY_VALUE",
			CheckCode::NoInterpolationKey => "NO_INTERPOLATION_KEY",
			CheckCode::ExtraInterpolationKey => "EXTRA_INTERPOLATION_KEY",
			CheckCode::InterpolationCount => "INTERPOLATION_COUNT",
			CheckCode::TagMismatch => "TAG_MISMATCH",
			CheckCode::NotTranslatedValue => "NOT_TRANSLATED_VALUE",
			CheckCode::UntranslatedScript => "UNTRANSLATED_SCRIPT",
			CheckCode::DuplicateValue => "DUPLICATE_VALUE",
			CheckCode::InconsistentValue => "INCONSISTENT_VALUE",
			CheckCode::SurroundingWhitespace => "SURROUNDING_WHITESPACE",
			CheckCode::InvisibleCharacter => "INVISIBLE_CHARACTER",
			CheckCode::MissingNumber => "MISSING_NUMBER",
			CheckCode::NumberMismatch => "NUMBER_MISMATCH",
			CheckCode::SuspiciousLength => "SUSPICIOUS_LENGTH",
		}
	}

	/// The check a spelling names, in any case, or `None`.
	pub fn parse(text: &str) -> Option<CheckCode> {
		let wanted = text.trim().to_uppercase();

		CheckCode::ALL
			.iter()
			.copied()
			.find(|code| code.as_str() == wanted)
	}

	/// Position in report order.
	pub fn rank(self) -> usize {
		self as usize
	}

	/// What the check is called, what it means, and how badly it is meant.
	pub fn meta(self) -> &'static CheckMeta {
		check_meta(self)
	}
}

impl fmt::Display for CheckCode {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		f.write_str(self.as_str())
	}
}

/// Severity of a reported issue. `Info` issues never fail a run.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Level {
	Error,
	Warn,
	Info,
}

impl Level {
	/// `error`, `warn` or `info`.
	pub fn as_str(self) -> &'static str {
		match self {
			Level::Error => "error",
			Level::Warn => "warn",
			Level::Info => "info",
		}
	}

	/// The level a spelling names, in any case, or `None`.
	pub fn parse(text: &str) -> Option<Level> {
		match text.trim().to_lowercase().as_str() {
			"error" => Some(Level::Error),
			"warn" => Some(Level::Warn),
			"info" => Some(Level::Info),
			_ => None,
		}
	}
}

/// Everything a consumer needs to render a check without hard-coding strings.
#[derive(Debug)]
pub struct CheckMeta {
	/// The severity the check reports at unless `levels` re-grades it.
	pub level: Level,
	/// A heading for a list of occurrences.
	pub summary: &'static str,
	/// What the check means, in one sentence.
	pub description: &'static str,
}

const fn meta(level: Level, summary: &'static str, description: &'static str) -> CheckMeta {
	CheckMeta {
		level,
		summary,
		description,
	}
}

static META: [CheckMeta; 27] = [
	meta(
		Level::Error,
		"An unexpected problem occurred",
		"Unknown error.",
	),
	meta(
		Level::Warn,
		"Some options could not be used as given",
		"The option value is missing or not usable.",
	),
	meta(
		Level::Error,
		"Some translation files could not be read",
		"The file is missing, empty, unreadable or not valid JSON.",
	),
	meta(
		Level::Warn,
		"Some values are not translatable strings",
		"The value is not a string, so it cannot be compared or translated.",
	),
	meta(
		Level::Error,
		"Some languages have no file in a group at all",
		"This group holds no translations for the language, so none of its keys exist.",
	),
	meta(
		Level::Error,
		"Some translation files did not include the following keys",
		"The key exists in the target language but is missing here.",
	),
	meta(
		Level::Warn,
		"The following keys do not exist in the target language",
		"The key is missing from the target language, so it may be unused.",
	),
	meta(
		Level::Error,
		"Some keys are defined more than once",
		"The key is defined twice, so one of its two values is silently lost.",
	),
	meta(
		Level::Info,
		"The following keys were not found in the scanned source files",
		"Nothing in the scanned sources appears to reference this key.",
	),
	meta(
		Level::Warn,
		"The scanned source files ask for keys nothing defines",
		"The source calls for this key and no language file defines it.",
	),
	meta(
		Level::Warn,
		"Some keys are missing a plural form their language needs",
		"The language needs a plural form of this key that the file does not define.",
	),
	meta(
		Level::Warn,
		"Some keys are not named the way the project asked",
		"The key is not written in the case `keyCase` asks for.",
	),
	meta(
		Level::Warn,
		"Some keys are nested deeper than the project allows",
		"The key has more levels than `maxKeyDepth` allows.",
	),
	meta(
		Level::Warn,
		"The value for the following items is empty",
		"The key is defined but its value is an empty string.",
	),
	meta(
		Level::Error,
		"The interpolation key does not match the target language",
		"An interpolation key of the target language is missing from this value.",
	),
	meta(
		Level::Error,
		"Some values use interpolation keys the target language does not have",
		"This value has an interpolation key that the target language does not define.",
	),
	meta(
		Level::Error,
		"Some values use an interpolation key a different number of times",
		"The value repeats an interpolation key more or fewer times than the target language.",
	),
	meta(
		Level::Warn,
		"Some values do not carry the same markup as the target language",
		"The markup tags of this value are not the ones the target language uses.",
	),
	meta(
		Level::Warn,
		"Some keys have the same value as the target language",
		"The value is identical to the target language, so the translation may be incomplete.",
	),
	meta(
		Level::Warn,
		"Some values are not written in the script of their language",
		"The value holds no character of the script this language is written in.",
	),
	meta(
		Level::Warn,
		"Some keys have duplicate values",
		"Another key in the same locale already uses this value.",
	),
	meta(
		Level::Warn,
		"Some keys with one shared original are translated differently",
		"Another key with the same target language value is translated differently here.",
	),
	meta(
		Level::Warn,
		"Some values begin or end with whitespace",
		"The value has leading or trailing whitespace, which is usually accidental.",
	),
	meta(
		Level::Warn,
		"Some values hold a character nothing will draw",
		"The value holds a zero width, bidirectional or non-breaking character.",
	),
	meta(
		Level::Warn,
		"Some values dropped a number the target language has",
		"The target language value contains digits but this value does not.",
	),
	meta(
		Level::Warn,
		"Some values changed a number the target language has",
		"The numbers in this value are not the ones the target language uses.",
	),
	meta(
		Level::Info,
		"Some values are far longer or shorter than the target language",
		"The value is further from the target language length than `lengthRatio` allows.",
	),
];

/// What a check is called, what it means, and how badly it is meant.
pub fn check_meta(code: CheckCode) -> &'static CheckMeta {
	&META[code.rank()]
}

/// Checks that compare translation data, in report order. `INVALID_*` and
/// `UNKNOWN` are left out: they report how the run itself went and cannot be
/// switched off through `checks` or `ignoreChecks`.
pub const ANALYZE_CHECK_CODES: [CheckCode; 24] = [
	CheckCode::InvalidValueType,
	CheckCode::NoLocale,
	CheckCode::NoKey,
	CheckCode::DummyKey,
	CheckCode::DuplicateKey,
	CheckCode::UnusedKey,
	CheckCode::UndefinedKey,
	CheckCode::NoPluralForm,
	CheckCode::KeyNaming,
	CheckCode::KeyDepth,
	CheckCode::EmptyValue,
	CheckCode::NoInterpolationKey,
	CheckCode::ExtraInterpolationKey,
	CheckCode::InterpolationCount,
	CheckCode::TagMismatch,
	CheckCode::NotTranslatedValue,
	CheckCode::UntranslatedScript,
	CheckCode::DuplicateValue,
	CheckCode::InconsistentValue,
	CheckCode::SurroundingWhitespace,
	CheckCode::InvisibleCharacter,
	CheckCode::MissingNumber,
	CheckCode::NumberMismatch,
	CheckCode::SuspiciousLength,
];

/// Checks that need to see every key of a locale at once, so they cannot be
/// answered by `check_entry`, which is handed one key at a time.
pub const CROSS_KEY_CHECK_CODES: [CheckCode; 7] = [
	CheckCode::DuplicateValue,
	CheckCode::InconsistentValue,
	CheckCode::NoLocale,
	CheckCode::DuplicateKey,
	CheckCode::UnusedKey,
	CheckCode::UndefinedKey,
	CheckCode::NoPluralForm,
];

/// How translation files are laid out on disk.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum FileFormat {
	/// Decide by looking at the scanned paths.
	Auto,
	/// One file per locale: `en.json`, `ko.json`.
	Single,
	/// One folder per locale: `en/common.json`, `ko/common.json`.
	Folder,
	/// One file holding every locale at the top level: `{ "en": {...} }`.
	Nested,
}

impl FileFormat {
	/// `auto`, `single`, `folder` or `nested`.
	pub fn as_str(self) -> &'static str {
		match self {
			FileFormat::Auto => "auto",
			FileFormat::Single => "single",
			FileFormat::Folder => "folder",
			FileFormat::Nested => "nested",
		}
	}

	/// The layout a spelling names, exactly as written, or `None`.
	pub fn parse(text: &str) -> Option<FileFormat> {
		match text {
			"auto" => Some(FileFormat::Auto),
			"single" => Some(FileFormat::Single),
			"folder" => Some(FileFormat::Folder),
			"nested" => Some(FileFormat::Nested),
			_ => None,
		}
	}
}

/// Case a project writes the segments of its translation keys in.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum KeyCase {
	/// `attr-folder`.
	Kebab,
	/// `attrFolder`.
	Camel,
	/// `attr_folder`.
	Snake,
}

impl KeyCase {
	/// `kebab`, `camel` or `snake`.
	pub fn as_str(self) -> &'static str {
		match self {
			KeyCase::Kebab => "kebab",
			KeyCase::Camel => "camel",
			KeyCase::Snake => "snake",
		}
	}

	/// The case a spelling names, in any case, or `None`.
	pub fn parse(text: &str) -> Option<KeyCase> {
		match text.trim().to_lowercase().as_str() {
			"kebab" => Some(KeyCase::Kebab),
			"camel" => Some(KeyCase::Camel),
			"snake" => Some(KeyCase::Snake),
			_ => None,
		}
	}
}

/// How a finished result is rendered. The checks and the counts are the same
/// whichever one is chosen; only the shape of the text changes.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Reporter {
	/// Grouped, coloured sections, meant to be read in a terminal.
	Pretty,
	/// One line per issue, for grepping and for editor integrations.
	List,
	/// The whole result object, for another tool to parse.
	Json,
	/// Tables, for pasting into a pull request or a report.
	Markdown,
	/// Workflow commands, so GitHub Actions annotates the files themselves.
	Github,
}

impl Reporter {
	/// Every reporter, in the order the usage text lists them.
	pub const ALL: [Reporter; 5] = [
		Reporter::Pretty,
		Reporter::List,
		Reporter::Json,
		Reporter::Markdown,
		Reporter::Github,
	];

	/// `pretty`, `list`, `json`, `markdown` or `github`.
	pub fn as_str(self) -> &'static str {
		match self {
			Reporter::Pretty => "pretty",
			Reporter::List => "list",
			Reporter::Json => "json",
			Reporter::Markdown => "markdown",
			Reporter::Github => "github",
		}
	}

	/// The reporter a spelling names, in any case, or `None`.
	pub fn parse(text: &str) -> Option<Reporter> {
		let wanted = text.trim().to_lowercase();

		Reporter::ALL
			.iter()
			.copied()
			.find(|reporter| reporter.as_str() == wanted)
	}
}

/// The axis a report groups its issues by.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum GroupBy {
	/// One section per language. What a translator works through.
	Locale,
	/// One section per check code. What a maintainer fixes in one pass.
	Code,
	/// One section per comparable set of files.
	Group,
	/// One section per translation file on disk.
	File,
	/// No sections at all.
	None,
}

impl GroupBy {
	/// Every axis, in the order the usage text lists them.
	pub const ALL: [GroupBy; 5] = [
		GroupBy::Locale,
		GroupBy::Code,
		GroupBy::Group,
		GroupBy::File,
		GroupBy::None,
	];

	/// `locale`, `code`, `group`, `file` or `none`.
	pub fn as_str(self) -> &'static str {
		match self {
			GroupBy::Locale => "locale",
			GroupBy::Code => "code",
			GroupBy::Group => "group",
			GroupBy::File => "file",
			GroupBy::None => "none",
		}
	}

	/// The axis a spelling names, in any case, or `None`.
	pub fn parse(text: &str) -> Option<GroupBy> {
		let wanted = text.trim().to_lowercase();

		GroupBy::ALL
			.iter()
			.copied()
			.find(|axis| axis.as_str() == wanted)
	}
}

/// The language every other language is compared against unless told otherwise.
pub const DEFAULT_TARGET_LOCALE: &str = "en";

/// Opening delimiter of an interpolation placeholder unless told otherwise.
pub const DEFAULT_INTERPOLATION_PREFIX: &str = "{";

/// Closing delimiter of an interpolation placeholder unless told otherwise.
pub const DEFAULT_INTERPOLATION_SUFFIX: &str = "}";

/// Directory names never worth scanning for translation files.
pub const DEFAULT_EXCLUDE_DIRS: [&str; 11] = [
	"node_modules",
	"dist",
	"build",
	"out",
	"coverage",
	".git",
	".next",
	".nuxt",
	".svelte-kit",
	".turbo",
	".cache",
];

/// File names that are never translation files, as `*` glob patterns:
/// configuration and lock files. Hidden files are skipped whatever this holds.
pub const DEFAULT_EXCLUDE_FILES: [&str; 7] = [
	"package.json",
	"tsconfig.json",
	"tsconfig.*.json",
	"eslintrc.json",
	"*-lock.json",
	"*-config.json",
	"*.config.json",
];

/// File extensions the scanner reads.
pub const SUPPORTED_EXTENSIONS: [&str; 1] = ["json"];

/// Extensions the unused key scan reads, as an allowlist rather than a
/// blocklist of binaries: an unknown binary decoded as UTF-8 could contain a
/// key's bytes by chance and wrongly mark it used.
pub const SOURCE_EXTENSIONS: [&str; 48] = [
	"js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts", "vue", "svelte", "astro", "html", "htm",
	"xml", "xhtml", "php", "rb", "py", "go", "rs", "java", "kt", "kts", "swift", "dart", "cs",
	"ex", "exs", "css", "scss", "sass", "less", "styl", "hbs", "ejs", "pug", "twig", "erb",
	"liquid", "json", "jsonc", "json5", "yaml", "yml", "toml", "md", "mdx", "txt",
];

/// Names a translation call goes by, for the `UNDEFINED_KEY` scan.
pub const TRANSLATION_FUNCTIONS: [&str; 3] = ["t", "$t", "translate"];

/// Files above this size are skipped by the unused key scan.
pub const SOURCE_MAX_FILE_BYTES: u64 = 5 * 1024 * 1024;

/// The reporter an `output` file name implies, by its extension.
pub fn reporter_by_extension(extension: &str) -> Option<Reporter> {
	match extension {
		"json" => Some(Reporter::Json),
		"md" | "markdown" => Some(Reporter::Markdown),
		_ => None,
	}
}

/// Width a report is laid out at when the terminal does not report its own.
pub const DEFAULT_REPORT_WIDTH: usize = 96;

/// Widest a report lays itself out to when the width was measured rather than
/// asked for.
pub const MAX_MEASURED_REPORT_WIDTH: usize = 120;
