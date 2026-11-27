//! Walking a directory tree in the same order on every machine.

use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::core::order::compare_text;

/// A file the walk found: its path, and its segments from the walked root.
#[derive(Clone, Debug)]
pub struct WalkedFile {
	/// The path, joined onto the walked root.
	pub path: String,
	/// Every segment from the root down to the file's own name.
	pub segments: Vec<String>,
}

/// What a walk met, in the order it met it.
#[derive(Clone, Debug)]
pub enum WalkItem {
	/// A file the walk was asked for.
	File(WalkedFile),
	/// A directory that could not be listed.
	Unreadable(String),
}

/// Every file under [root] that [is_wanted] asks for, in name order at every
/// level, skipping hidden entries and the directories [is_excluded_directory]
/// names, together with every directory that could not be listed.
///
/// Entries are ordered by UTF-16 code unit, which is what the JavaScript
/// package sorts them by, so every package reads the same files in the same
/// order whatever the file system returns.
pub fn walk_files(
	root: &Path,
	is_excluded_directory: &dyn Fn(&[String]) -> bool,
	is_wanted: &dyn Fn(&WalkedFile) -> bool,
) -> Vec<WalkItem> {
	let mut found = Vec::new();

	walk(root, &[], is_excluded_directory, is_wanted, &mut found);

	found
}

fn walk(
	directory: &Path,
	segments: &[String],
	is_excluded_directory: &dyn Fn(&[String]) -> bool,
	is_wanted: &dyn Fn(&WalkedFile) -> bool,
	found: &mut Vec<WalkItem>,
) {
	let entries = match fs::read_dir(directory) {
		Ok(entries) => entries,
		Err(_) => {
			found.push(WalkItem::Unreadable(
				directory.to_string_lossy().into_owned(),
			));
			return;
		}
	};
	let mut named: Vec<(String, bool)> = entries
		.filter_map(Result::ok)
		.map(|entry| {
			// A link is not followed into, as `readdir` does not report one as a
			// directory.
			let is_directory = entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false);

			(
				entry.file_name().to_string_lossy().into_owned(),
				is_directory,
			)
		})
		.collect();

	named.sort_by(|a, b| compare_text(&a.0, &b.0));

	for (name, is_directory) in named {
		if name.starts_with('.') {
			continue;
		}

		let path = directory.join(&name);
		let mut entry_segments = segments.to_vec();

		entry_segments.push(name);

		if is_directory {
			if !is_excluded_directory(&entry_segments) {
				walk(
					&path,
					&entry_segments,
					is_excluded_directory,
					is_wanted,
					found,
				);
			}

			continue;
		}

		let file = WalkedFile {
			path: path.to_string_lossy().into_owned(),
			segments: entry_segments,
		};

		if is_wanted(&file) {
			found.push(WalkItem::File(file));
		}
	}
}

/// The extension of a file name in lower case, or `""`. `.gitignore` is a name
/// that begins with a dot, not a file of that type.
pub fn extension_of(name: &str) -> String {
	match name.rfind('.') {
		Some(dot) if dot >= 1 => name[dot + 1..].to_lowercase(),
		_ => String::new(),
	}
}

/// [path] made absolute against the working directory, with `.` and `..`
/// resolved the way Node's `path.resolve` does it, without touching the disk.
pub fn resolve_path(path: &str) -> PathBuf {
	let given = Path::new(path);
	let joined = if given.is_absolute() {
		given.to_path_buf()
	} else {
		std::env::current_dir()
			.map(|cwd| cwd.join(given))
			.unwrap_or_else(|_| given.to_path_buf())
	};
	let mut resolved = PathBuf::new();

	for component in joined.components() {
		match component {
			Component::CurDir => {}
			Component::ParentDir => {
				resolved.pop();
			}
			other => resolved.push(other.as_os_str()),
		}
	}

	resolved
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn reads_an_extension() {
		assert_eq!(extension_of("en.JSON"), "json");
		assert_eq!(extension_of(".gitignore"), "");
		assert_eq!(extension_of("README"), "");
	}

	#[test]
	fn resolves_a_path_without_the_disk() {
		let resolved = resolve_path("/a/b/../c/./d");

		assert_eq!(resolved, PathBuf::from("/a/c/d"));
	}
}
