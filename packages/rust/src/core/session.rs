//! Translations held in memory and checked again as they change.

use indexmap::{IndexMap, IndexSet};
use serde_json::Value;

use crate::constants::FileFormat;
use crate::core::analyzer::{collect_keys, prepare_groups_owned, Analyzer};
use crate::core::js::object_keys;
use crate::options::{Options, ResolvedOptions};
use crate::types::{
	CheckResult, Entry, Input, Issue, KeyUsage, SourceFile, TranslationGroups, TranslationMap,
};

/// Translations held in memory, flattened once, checked as a whole or one key at
/// a time.
#[derive(Clone, Debug)]
pub struct Session {
	analyzer: Analyzer,
	input_is_flat: bool,
	groups: TranslationGroups,
	group_names: Vec<String>,
	locale_names: Vec<String>,
	files: Vec<SourceFile>,
	file_format: Option<FileFormat>,
	source_issues: Vec<Issue>,
	unused_keys: Vec<String>,
	undefined_keys: Vec<KeyUsage>,
}

impl Session {
	/// A session over [input], bound to [options].
	pub fn new(input: Input, options: &Options) -> Session {
		// The session flattens once, up front, so the analyzer never has to.
		let analyzer = Analyzer::new(&Options {
			flattened: Some(true),
			..options.clone()
		});
		let mut session = Session {
			analyzer,
			input_is_flat: options.flattened == Some(true),
			groups: TranslationGroups::new(),
			group_names: Vec::new(),
			locale_names: Vec::new(),
			files: Vec::new(),
			file_format: None,
			source_issues: Vec::new(),
			unused_keys: Vec::new(),
			undefined_keys: Vec::new(),
		};

		session.reset(input);

		session
	}

	/// The options every check of this session runs with.
	pub fn options(&self) -> &ResolvedOptions {
		&self.analyzer.options
	}

	/// Every locale of every group.
	pub fn locales(&self) -> &[String] {
		&self.locale_names
	}

	/// Every group.
	pub fn groups(&self) -> &[String] {
		&self.group_names
	}

	/// The files the translations were read from.
	pub fn files(&self) -> &[SourceFile] {
		&self.files
	}

	/// The layout the files were read in.
	pub fn file_format(&self) -> Option<FileFormat> {
		self.file_format
	}

	/// Replaces everything the session holds.
	pub fn reset(&mut self, next: Input) {
		let mut load_issues = Vec::new();
		let Input {
			groups,
			locales,
			files,
			issues,
			file_format,
			unused_keys,
			undefined_keys,
		} = next;

		// The session keeps its own maps, which it changes as values are set, so
		// the translations it is handed move into them.
		self.groups = prepare_groups_owned(
			Input {
				groups,
				locales,
				..Input::default()
			},
			&self.analyzer.options,
			self.input_is_flat,
			&mut load_issues,
		);
		self.group_names = self.groups.keys().cloned().collect();
		self.files = files.unwrap_or_default();
		self.file_format = file_format;
		self.source_issues = issues.unwrap_or_default();
		self.source_issues.extend(load_issues);
		self.unused_keys = unused_keys.unwrap_or_default();
		self.undefined_keys = undefined_keys.unwrap_or_default();

		let mut locales: IndexSet<String> = IndexSet::new();

		for group in self.groups.values() {
			locales.extend(group.keys().cloned());
		}

		self.locale_names = locales.into_iter().collect();
	}

	/// The group a key belongs to: the one named, else the first group that has
	/// it, else the first group.
	fn resolve_group(&self, key: Option<&str>, group: Option<&str>) -> String {
		if let Some(group) = group {
			return group.to_string();
		}

		let first = self.group_names.first().cloned().unwrap_or_default();

		let Some(key) = key.filter(|_| self.group_names.len() > 1) else {
			return first;
		};

		self.group_names
			.iter()
			.find(|name| {
				self.groups[name.as_str()]
					.values()
					.any(|map| map.contains_key(key))
			})
			.cloned()
			.unwrap_or(first)
	}

	fn locales_of(&self, group: &str) -> Vec<String> {
		self.groups
			.get(group)
			.map(|locales| locales.keys().cloned().collect())
			.unwrap_or_default()
	}

	/// Compares one key across the locales of its group.
	pub fn check_key(&self, key: &str, group: Option<&str>) -> Vec<Issue> {
		let name = self.resolve_group(Some(key), group);
		let locales = self.locales_of(&name);
		let mut values: IndexMap<String, Value> = IndexMap::new();

		if let Some(maps) = self.groups.get(&name) {
			for locale in &locales {
				if let Some(value) = maps[locale.as_str()].get(key) {
					values.insert(locale.clone(), value.clone());
				}
			}
		}

		self.analyzer.check_entry(&Entry {
			key: key.to_string(),
			values,
			locales: Some(locales),
			group: Some(name),
		})
	}

	/// Every key of a group, the target language's first.
	pub fn keys(&self, group: Option<&str>) -> Vec<String> {
		let name = self.resolve_group(None, group);
		let locales = self.locales_of(&name);
		let Some(maps) = self.groups.get(&name) else {
			return Vec::new();
		};
		let own_keys: Vec<Vec<&String>> = locales
			.iter()
			.map(|locale| object_keys(&maps[locale.as_str()]))
			.collect();

		collect_keys(
			&own_keys,
			locales
				.iter()
				.position(|locale| *locale == self.analyzer.options.target),
		)
	}

	/// The flattened translations of a group, by locale.
	pub fn translations(&self, group: Option<&str>) -> Option<&IndexMap<String, TranslationMap>> {
		self.groups.get(&self.resolve_group(None, group))
	}

	/// One value, or `None` when the locale has no such key.
	pub fn get(&self, locale: &str, key: &str, group: Option<&str>) -> Option<&Value> {
		self.groups
			.get(&self.resolve_group(Some(key), group))?
			.get(locale)?
			.get(key)
	}

	/// Sets one value and checks its key again.
	pub fn set(&mut self, locale: &str, key: &str, value: &str, group: Option<&str>) -> Vec<Issue> {
		let name = self.resolve_group(Some(key), group);

		self.groups
			.entry(name.clone())
			.or_default()
			.entry(locale.to_string())
			.or_default()
			.insert(key.to_string(), Value::String(value.to_string()));

		if !self.locale_names.iter().any(|known| known == locale) {
			self.locale_names.push(locale.to_string());
		}

		if !self.group_names.contains(&name) {
			self.group_names.push(name.clone());
		}

		self.check_key(key, Some(&name))
	}

	/// Removes a key from one locale, or from every locale of its group, and
	/// checks it again.
	pub fn remove(&mut self, key: &str, locale: Option<&str>, group: Option<&str>) -> Vec<Issue> {
		let name = self.resolve_group(Some(key), group);
		let locales = match locale {
			Some(locale) => vec![locale.to_string()],
			None => self.locales_of(&name),
		};

		if let Some(maps) = self.groups.get_mut(&name) {
			for locale in &locales {
				if let Some(map) = maps.get_mut(locale) {
					map.shift_remove(key);
				}
			}
		}

		self.check_key(key, Some(&name))
	}

	/// Compares everything the session holds.
	pub fn analyze(&self) -> CheckResult {
		self.analyzer.analyze_with(
			&Input {
				groups: Some(self.groups.clone()),
				locales: None,
				files: Some(self.files.clone()),
				issues: Some(self.source_issues.clone()),
				file_format: self.file_format,
				unused_keys: Some(self.unused_keys.clone()),
				undefined_keys: Some(self.undefined_keys.clone()),
			},
			true,
		)
	}
}

/// A session over [input], bound to [options].
pub fn create_session(input: Input, options: &Options) -> Session {
	Session::new(input, options)
}
