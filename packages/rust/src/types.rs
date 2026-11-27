//! The shapes the library reads and returns: translations, issues, results and
//! the input of a comparison.

use indexmap::IndexMap;
use serde_json::{json, Map, Value};

use crate::constants::{CheckCode, FileFormat, Level};

/// Translation strings of one locale, nested as a file holds them or flattened
/// into dotted keys. Keys keep the order they were written in.
pub type TranslationMap = Map<String, Value>;

/// `group name -> locale -> strings`. A group is one comparable set of files.
pub type TranslationGroups = IndexMap<String, IndexMap<String, TranslationMap>>;

/// A translation file located by the scanner.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SourceFile {
	/// Absolute path of the file.
	pub path: String,
	/// Path from the scanned directory, with `/` between segments.
	pub relative_path: String,
	/// The group the file's keys are compared in.
	pub group: String,
	/// The locale the file holds.
	pub locale: String,
}

/// A key the source asks for, and the file that asks for it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct KeyUsage {
	/// The key as the source wrote it.
	pub key: String,
	/// The first file that asks for it, when known.
	pub file: Option<String>,
}

/// One finding.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Issue {
	/// The check that found it.
	pub code: CheckCode,
	/// How badly it is meant, after `levels` re-graded it.
	pub level: Level,
	/// Locale the issue belongs to. Empty for issues that are not locale-bound.
	pub locale: String,
	/// Flattened translation key. Empty for file or option level issues.
	pub key: String,
	/// Group the key belongs to. Empty when the caller supplied a single set.
	pub group: String,
	/// The value the finding is about, as text.
	pub value: Option<String>,
	/// The target language's value of the same key, as text.
	pub target_value: Option<String>,
	/// Interpolation placeholder that triggered the issue.
	pub interpolation: Option<String>,
	/// The other key involved, such as the first key holding a duplicated value.
	pub related_key: Option<String>,
	/// Absolute path of the file the key came from, when known.
	pub file: Option<String>,
	/// One line describing this occurrence.
	pub message: String,
}

impl Issue {
	/// The issue as the JSON report writes it: the fixed fields first, and an
	/// optional one only when it is there.
	pub fn to_json(&self) -> Value {
		let mut object = Map::new();

		object.insert("code".into(), json!(self.code.as_str()));
		object.insert("level".into(), json!(self.level.as_str()));
		object.insert("locale".into(), json!(self.locale));
		object.insert("key".into(), json!(self.key));
		object.insert("group".into(), json!(self.group));
		object.insert("message".into(), json!(self.message));

		let optional = [
			("value", &self.value),
			("targetValue", &self.target_value),
			("interpolation", &self.interpolation),
			("relatedKey", &self.related_key),
			("file", &self.file),
		];

		for (name, field) in optional {
			if let Some(text) = field {
				object.insert(name.into(), json!(text));
			}
		}

		Value::Object(object)
	}
}

/// How many issues there are of each level.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct LevelCount {
	/// Issues at `error`.
	pub error: usize,
	/// Issues at `warn`.
	pub warn: usize,
	/// Issues at `info`.
	pub info: usize,
}

impl LevelCount {
	/// Counts one more issue of [level].
	pub fn add(&mut self, level: Level) {
		match level {
			Level::Error => self.error += 1,
			Level::Warn => self.warn += 1,
			Level::Info => self.info += 1,
		}
	}

	/// The count of one level.
	pub fn of(&self, level: Level) -> usize {
		match level {
			Level::Error => self.error,
			Level::Warn => self.warn,
			Level::Info => self.info,
		}
	}

	fn to_json(self) -> Value {
		json!({ "error": self.error, "warn": self.warn, "info": self.info })
	}
}

/// The counts a report is built on.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Summary {
	/// Issues at `error`.
	pub error: usize,
	/// Issues at `warn`.
	pub warn: usize,
	/// Issues at `info`.
	pub info: usize,
	/// Every issue.
	pub total: usize,
	/// Issues of each check, in the order the checks were first met.
	pub by_code: IndexMap<CheckCode, usize>,
	/// Issues of each locale, for the issues that belong to one.
	pub by_locale: IndexMap<String, LevelCount>,
	/// Issues of each group.
	pub by_group: IndexMap<String, LevelCount>,
}

impl Summary {
	fn to_json(&self) -> Value {
		let by_code: Map<String, Value> = self
			.by_code
			.iter()
			.map(|(code, count)| (code.as_str().into(), json!(count)))
			.collect();
		let by_locale: Map<String, Value> = self
			.by_locale
			.iter()
			.map(|(locale, counts)| (locale.clone(), counts.to_json()))
			.collect();
		let by_group: Map<String, Value> = self
			.by_group
			.iter()
			.map(|(group, counts)| (group.clone(), counts.to_json()))
			.collect();

		json!({
			"error": self.error,
			"warn": self.warn,
			"info": self.info,
			"total": self.total,
			"byCode": by_code,
			"byLocale": by_locale,
			"byGroup": by_group,
		})
	}
}

/// What a comparison found.
#[derive(Clone, Debug, PartialEq)]
pub struct CheckResult {
	/// `false` when at least one `error` level issue was found.
	pub success: bool,
	/// Every issue, in scan order.
	pub issues: Vec<Issue>,
	/// The counts a report is built on.
	pub summary: Summary,
	/// Locale used as the comparison base.
	pub target: String,
	/// Every locale that took part in the comparison.
	pub locales: Vec<String>,
	/// Group names that took part in the comparison.
	pub groups: Vec<String>,
	/// Number of distinct keys compared across all groups.
	pub key_count: usize,
	/// Files read from disk. Empty when the input was supplied in memory.
	pub files: Vec<SourceFile>,
	/// Detected or forced on-disk layout. `None` for input held in memory.
	pub file_format: Option<FileFormat>,
	/// How long the comparison took.
	pub elapsed_ms: u128,
}

impl CheckResult {
	/// The issues grouped by check, in the order the checks were first met.
	pub fn issues_by_code(&self) -> IndexMap<CheckCode, Vec<&Issue>> {
		let mut grouped: IndexMap<CheckCode, Vec<&Issue>> = IndexMap::new();

		for issue in &self.issues {
			grouped.entry(issue.code).or_default().push(issue);
		}

		grouped
	}

	/// The whole result as the JSON report writes it, in the order the
	/// JavaScript package builds its result object.
	pub fn to_json(&self) -> Value {
		let issues: Vec<Value> = self.issues.iter().map(Issue::to_json).collect();
		let by_code: Map<String, Value> = self
			.issues_by_code()
			.into_iter()
			.map(|(code, issues)| {
				(
					code.as_str().into(),
					Value::Array(issues.into_iter().map(Issue::to_json).collect()),
				)
			})
			.collect();
		let files: Vec<Value> = self
			.files
			.iter()
			.map(|file| {
				json!({
					"path": file.path,
					"relativePath": file.relative_path,
					"group": file.group,
					"locale": file.locale,
				})
			})
			.collect();
		let mut object = Map::new();

		object.insert("locales".into(), json!(self.locales));
		object.insert("groups".into(), json!(self.groups));
		object.insert("keyCount".into(), json!(self.key_count));
		object.insert("files".into(), Value::Array(files));
		object.insert(
			"fileFormat".into(),
			self.file_format
				.map_or(Value::Null, |format| json!(format.as_str())),
		);
		object.insert("elapsedMs".into(), json!(self.elapsed_ms as u64));
		object.insert("target".into(), json!(self.target));
		object.insert("success".into(), json!(self.success));
		object.insert("issues".into(), Value::Array(issues));
		object.insert("issuesByCode".into(), Value::Object(by_code));
		object.insert("summary".into(), self.summary.to_json());

		Value::Object(object)
	}
}

/// What a comparison reads: the translations, and what produced them already
/// found or worked out.
#[derive(Clone, Debug, Default)]
pub struct Input {
	/// Several comparable sets, such as one entry per translation file name.
	pub groups: Option<TranslationGroups>,
	/// A single set. Shorthand for one group named `""`.
	pub locales: Option<IndexMap<String, TranslationMap>>,
	/// The file each group and locale was read from.
	pub files: Option<Vec<SourceFile>>,
	/// Issues found while producing this input, such as an unreadable file.
	pub issues: Option<Vec<Issue>>,
	/// Layout the input came from, carried through to the result.
	pub file_format: Option<FileFormat>,
	/// Flattened keys nothing appears to reference, reported as `UNUSED_KEY`.
	pub unused_keys: Option<Vec<String>>,
	/// Keys the source asks for that nothing defines, reported as
	/// `UNDEFINED_KEY`.
	pub undefined_keys: Option<Vec<KeyUsage>>,
}

/// One key of one group, as fed to the incremental `check_entry`.
#[derive(Clone, Debug, Default)]
pub struct Entry {
	/// The flattened key.
	pub key: String,
	/// `locale -> value`. The target locale's value is read from here too.
	pub values: IndexMap<String, Value>,
	/// The group the key belongs to.
	pub group: Option<String>,
	/// Locales to compare. Defaults to the keys of `values`; pass it when a
	/// locale that owns no value still has to be reported as missing.
	pub locales: Option<Vec<String>>,
}
