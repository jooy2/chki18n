//! Reading a directory of translation files into comparable groups.

use std::fs;
use std::path::Path;

use indexmap::IndexSet;
use serde_json::Value;

use crate::constants::{CheckCode, FileFormat, SUPPORTED_EXTENSIONS};
use crate::core::chars::is_space;
use crate::core::exclude::{create_file_excluder, create_path_excluder};
use crate::core::interpolation::{
	detect_interpolation_delimiters, Delimiters, INTERPOLATION_DELIMITERS,
};
use crate::core::issue::{create_issue, IssueInit};
use crate::core::js::object_keys;
use crate::core::locale::is_locale_code;
use crate::loader::json_duplicates::{find_duplicate_json_keys, JsonDuplicateKey};
use crate::loader::walk::{extension_of, text_of, walk_files, WalkItem, WalkedFile};
use crate::options::ResolvedOptions;
use crate::types::{Issue, SourceFile, TranslationGroups};

/// What a scan of a directory found.
#[derive(Clone, Debug)]
pub struct ScanResult {
	/// The layout the files were read in.
	pub file_format: FileFormat,
	/// The translations, by group and locale, nested as the files hold them.
	pub groups: TranslationGroups,
	/// The file each group and locale was read from.
	pub files: Vec<SourceFile>,
	/// Files that belong to no locale, whether read or left unread for their path.
	pub skipped: Vec<String>,
	/// Interpolation delimiters the files look like they are written with.
	pub detected_interpolation: Option<Delimiters>,
	/// What went wrong while reading.
	pub issues: Vec<Issue>,
}

/// A file read and parsed.
struct ScannedFile {
	path: String,
	relative_path: String,
	segments: Vec<String>,
	json: Value,
	duplicate_keys: Vec<JsonDuplicateKey>,
	interpolation: Option<Delimiters>,
}

/// A place in the walk: a directory it could not list, or a file found there
/// and, once read, what reading it gave.
enum Slot {
	Unreadable(Issue),
	File {
		file: WalkedFile,
		read: Option<Result<ScannedFile, Box<Issue>>>,
	},
}

/// A file name without its last extension.
fn stem_of(name: &str) -> &str {
	match name.rfind('.') {
		Some(dot) if dot + 1 < name.len() => &name[..dot],
		_ => name,
	}
}

fn is_named_for_locale(segments: &[String]) -> bool {
	segments
		.last()
		.is_some_and(|name| is_locale_code(stem_of(name)))
}

fn is_in_locale_folder(segments: &[String]) -> bool {
	segments.len() >= 2 && is_locale_code(&segments[segments.len() - 2])
}

/// Whether a file's path leaves room for it to hold a locale in [format].
fn may_hold_locale(segments: &[String], format: FileFormat) -> bool {
	match format {
		FileFormat::Single => is_named_for_locale(segments),
		FileFormat::Folder => is_in_locale_folder(segments),
		FileFormat::Nested => true,
		FileFormat::Auto => is_named_for_locale(segments) || is_in_locale_folder(segments),
	}
}

/// Top level keys of a file that name a locale, as the `nested` layout does.
fn nested_locale_keys(json: &Value) -> Vec<String> {
	match json {
		Value::Object(map) => object_keys(map)
			.into_iter()
			.filter(|key| is_locale_code(key))
			.cloned()
			.collect(),
		_ => Vec::new(),
	}
}

fn file_format_of_paths<'a>(files: impl Iterator<Item = &'a ScannedFile>) -> Option<FileFormat> {
	for file in files {
		if is_named_for_locale(&file.segments) {
			return Some(FileFormat::Single);
		}

		if is_in_locale_folder(&file.segments) {
			return Some(FileFormat::Folder);
		}
	}

	None
}

fn read_translation_file(
	file: &WalkedFile,
	options: &ResolvedOptions,
) -> Result<ScannedFile, Box<Issue>> {
	let relative_path = file.segments.join("/");
	let read_error = format!("Failed to read file '{relative_path}': ");
	let invalid = |message: String| {
		Box::new(create_issue(
			CheckCode::InvalidFile,
			IssueInit {
				file: Some(file.path.clone()),
				message: Some(message),
				..IssueInit::default()
			},
		))
	};
	let bytes = fs::read(&file.path).map_err(|_| {
		invalid(format!(
			"{read_error}May be read access denied or invalid file format."
		))
	})?;
	// Decoded the way Node decodes a file as UTF-8: a byte that is not part of a
	// character becomes U+FFFD rather than an error.
	let decoded = text_of(bytes);
	let content = decoded.strip_prefix('\u{feff}').unwrap_or(&decoded);

	if content.trim_matches(is_space).is_empty() {
		return Err(invalid(format!("{read_error}File content is empty.")));
	}

	let json: Value = serde_json::from_str(content).map_err(|_| {
		invalid(format!(
			"{read_error}Content is not json format or parse failed due to an invalid character."
		))
	})?;

	Ok(ScannedFile {
		path: file.path.clone(),
		relative_path,
		segments: file.segments.clone(),
		json,
		// Read off the text, because parsing has already discarded it.
		duplicate_keys: if options.enabled_checks.contains(&CheckCode::DuplicateKey) {
			find_duplicate_json_keys(content)
		} else {
			Vec::new()
		},
		interpolation: detect_interpolation_delimiters(content),
	})
}

fn walk_translation_tree(root: &Path, options: &ResolvedOptions) -> Vec<Slot> {
	let is_excluded_file = create_file_excluder(&options.exclude_files);
	let is_excluded_directory = create_path_excluder(&options.exclude);
	let is_wanted = |file: &WalkedFile| {
		let name = file.segments.last().map(String::as_str).unwrap_or("");

		SUPPORTED_EXTENSIONS.contains(&extension_of(name).as_str()) && !is_excluded_file(name)
	};

	walk_files(root, &is_excluded_directory, &is_wanted)
		.into_iter()
		.map(|item| match item {
			WalkItem::File(file) => Slot::File { file, read: None },
			WalkItem::Unreadable(directory) => Slot::Unreadable(create_issue(
				CheckCode::InvalidFile,
				IssueInit {
					message: Some(format!(
						"Failed to read the directory '{directory}'. It may not exist or read access may be denied."
					)),
					file: Some(directory),
					..IssueInit::default()
				},
			)),
		})
		.collect()
}

/// Reads every file of [slots] that [is_wanted] asks for and has not been read.
fn read_slots(
	slots: &mut [Slot],
	is_wanted: impl Fn(&WalkedFile) -> bool,
	options: &ResolvedOptions,
) {
	for slot in slots {
		if let Slot::File { file, read } = slot {
			if read.is_none() && is_wanted(file) {
				*read = Some(read_translation_file(file, options));
			}
		}
	}
}

/// What the groups are built from: a file that was read, or one left unread
/// because its path names no locale.
enum Entry {
	Read(ScannedFile),
	Unread(String),
}

struct Built {
	groups: TranslationGroups,
	files: Vec<SourceFile>,
	skipped: Vec<String>,
}

/// Sorts the files into comparable groups. The files are consumed: each one's
/// translations move into its group rather than being copied there.
fn build_groups(entries: Vec<Entry>, file_format: FileFormat, issues: &mut Vec<Issue>) -> Built {
	let mut groups = TranslationGroups::new();
	let mut sources = Vec::new();
	let mut skipped = Vec::new();

	let mut add = |group: String, locale: String, translations: Value, file: &ScannedFile| {
		// A translation file is an object of keys. Anything else has no keys to
		// compare and is reported rather than read.
		let Value::Object(map) = translations else {
			issues.push(create_issue(
				CheckCode::InvalidFile,
				IssueInit {
					locale: Some(locale.clone()),
					group: Some(group.clone()),
					file: Some(file.path.clone()),
					message: Some(format!(
						"The translations of `{locale}` in '{}' are not an object.",
						file.relative_path
					)),
					..IssueInit::default()
				},
			));
			return;
		};

		groups
			.entry(group.clone())
			.or_default()
			.insert(locale.clone(), map);
		sources.push(SourceFile {
			path: file.path.clone(),
			relative_path: file.relative_path.clone(),
			group: group.clone(),
			locale: locale.clone(),
		});

		// A `nested` file's paths start with the locale that owns them; every other
		// layout's are already relative to the locale's own root.
		let prefix = if file_format == FileFormat::Nested {
			format!("{locale}.")
		} else {
			String::new()
		};

		for duplicate in &file.duplicate_keys {
			if !prefix.is_empty() && !duplicate.path.starts_with(&prefix) {
				continue;
			}

			issues.push(create_issue(
				CheckCode::DuplicateKey,
				IssueInit {
					locale: Some(locale.clone()),
					group: Some(group.clone()),
					key: Some(duplicate.path[prefix.len()..].to_string()),
					file: Some(file.path.clone()),
					message: Some(format!(
						"The key is written twice in '{}' (line {}), so one of its values is lost.",
						file.relative_path, duplicate.line
					)),
					..IssueInit::default()
				},
			));
		}
	};

	for entry in entries {
		let mut file = match entry {
			// Left unread because its path names no locale, so it belongs to none.
			Entry::Unread(relative_path) => {
				skipped.push(relative_path);
				continue;
			}
			Entry::Read(file) => file,
		};
		let json = file.json.take();
		let segments = file.segments.clone();
		let file_name = segments.last().cloned().unwrap_or_default();

		match file_format {
			FileFormat::Nested => {
				let locales = nested_locale_keys(&json);

				if locales.is_empty() {
					skipped.push(file.relative_path.clone());
					continue;
				}

				let mut json = json;

				for locale in locales {
					let translations = json
						.get_mut(locale.as_str())
						.map(Value::take)
						.unwrap_or_default();

					add(file.relative_path.clone(), locale, translations, &file);
				}
			}
			FileFormat::Folder => {
				let locale = if segments.len() >= 2 {
					segments[segments.len() - 2].clone()
				} else {
					String::new()
				};

				if !is_locale_code(&locale) {
					skipped.push(file.relative_path.clone());
					continue;
				}

				let directory = segments[..segments.len().saturating_sub(2)].join("/");
				let group = if directory.is_empty() {
					file_name
				} else {
					format!("{directory}/{file_name}")
				};

				add(group, locale, json, &file);
			}
			_ => {
				let locale = stem_of(&file_name).to_string();

				if !is_locale_code(&locale) {
					skipped.push(file.relative_path.clone());
					continue;
				}

				add(
					segments[..segments.len() - 1].join("/"),
					locale,
					json,
					&file,
				);
			}
		}
	}

	Built {
		groups,
		files: sources,
		skipped,
	}
}

fn detected_interpolation_of(
	files: &[(String, Option<Delimiters>)],
	skipped: &[String],
) -> Option<Delimiters> {
	let ignored: IndexSet<&String> = skipped.iter().collect();
	let seen: IndexSet<&str> = files
		.iter()
		.filter(|(relative_path, _)| !ignored.contains(relative_path))
		.filter_map(|(_, delimiters)| delimiters.map(|delimiters| delimiters.prefix))
		.collect();

	INTERPOLATION_DELIMITERS
		.iter()
		.copied()
		.find(|candidate| seen.contains(candidate.prefix))
}

/// Reads a directory of translation files into comparable groups, working out
/// the layout from the paths, or from the files' content when no path names a
/// locale.
pub fn scan_translation_directory(path: &Path, options: &ResolvedOptions) -> ScanResult {
	let mut issues = Vec::new();
	let mut slots = walk_translation_tree(path, options);

	read_slots(
		&mut slots,
		|file| may_hold_locale(&file.segments, options.format),
		options,
	);

	let mut file_format = if options.format == FileFormat::Auto {
		let read: Vec<&ScannedFile> = slots
			.iter()
			.filter_map(|slot| match slot {
				Slot::File {
					read: Some(Ok(file)),
					..
				} => Some(file),
				_ => None,
			})
			.collect();

		file_format_of_paths(read.into_iter())
	} else {
		Some(options.format)
	};

	if file_format.is_none() {
		// No path names a locale, so only the files' content can tell whether
		// their top level keys do, as the `nested` layout writes them.
		read_slots(&mut slots, |_| true, options);

		let nested = slots.iter().any(|slot| match slot {
			Slot::File {
				read: Some(Ok(file)),
				..
			} => !nested_locale_keys(&file.json).is_empty(),
			_ => false,
		});

		file_format = Some(if nested {
			FileFormat::Nested
		} else {
			FileFormat::Single
		});
	}

	let file_format = file_format.unwrap_or(FileFormat::Single);
	// The issues go out in walk order.
	let mut entries: Vec<Entry> = Vec::new();

	for slot in slots {
		match slot {
			Slot::Unreadable(issue) => issues.push(issue),
			Slot::File { file, read: None } => entries.push(Entry::Unread(file.segments.join("/"))),
			Slot::File {
				read: Some(Ok(scanned)),
				..
			} => entries.push(Entry::Read(scanned)),
			Slot::File {
				read: Some(Err(issue)),
				..
			} => issues.push(*issue),
		}
	}

	// What the delimiter guess needs is noted before the files move into their
	// groups.
	let interpolations: Vec<(String, Option<Delimiters>)> = entries
		.iter()
		.filter_map(|entry| match entry {
			Entry::Read(file) => Some((file.relative_path.clone(), file.interpolation)),
			Entry::Unread(_) => None,
		})
		.collect();
	let had_entries = !entries.is_empty();
	let built = build_groups(entries, file_format, &mut issues);
	let display_path = path.to_string_lossy();

	if built.files.is_empty() {
		issues.push(create_issue(
			CheckCode::InvalidFile,
			IssueInit {
				file: Some(display_path.to_string()),
				message: Some(if !had_entries {
					format!("No translation file was found in '{display_path}'.")
				} else {
					format!(
						"No translation file matching the `{}` format was found in '{display_path}'. Check the `format` option.",
						file_format.as_str()
					)
				}),
				..IssueInit::default()
			},
		));
	}

	let detected_interpolation = detected_interpolation_of(&interpolations, &built.skipped);

	ScanResult {
		file_format,
		groups: built.groups,
		files: built.files,
		skipped: built.skipped,
		detected_interpolation,
		issues,
	}
}
