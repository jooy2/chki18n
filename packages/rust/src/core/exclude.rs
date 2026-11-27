//! The directories and files a scan never reads.

use std::collections::HashSet;

/// The segments of a path, whichever separator it was written with, without the
/// empty and `.` ones.
pub fn path_segments(path: &str) -> Vec<String> {
	path.replace('\\', "/")
		.split('/')
		.filter(|segment| !segment.is_empty() && *segment != ".")
		.map(str::to_string)
		.collect()
}

/// Whether a file name matches a `*` pattern, ignoring case.
pub fn matches_name_pattern(name: &str, pattern: &str) -> bool {
	let lower = pattern.to_lowercase();
	let parts: Vec<&str> = lower.split('*').collect();

	matches_pattern_parts(&name.to_lowercase(), &parts)
}

fn matches_pattern_parts(subject: &str, parts: &[&str]) -> bool {
	if parts.len() == 1 {
		return subject == parts[0];
	}

	let first = parts[0];
	let last = parts[parts.len() - 1];

	if !subject.starts_with(first) || !subject.ends_with(last) {
		return false;
	}

	let mut index = first.len();

	for part in &parts[1..parts.len() - 1] {
		if part.is_empty() {
			continue;
		}

		match subject.get(index..).and_then(|rest| rest.find(part)) {
			Some(found) => index += found + part.len(),
			None => return false,
		}
	}

	// The parts matched in order, but the first and the last may have claimed
	// the same characters: `ab` must not match `a*b*b`.
	index + last.len() <= subject.len()
}

/// A test of whether a directory, given as its segments from the scanned root,
/// is excluded. An entry of one segment names a directory at any depth; an
/// entry with a separator names a path from the root.
pub fn create_path_excluder<'a>(
	entries: impl IntoIterator<Item = &'a String>,
) -> impl Fn(&[String]) -> bool {
	let mut names: HashSet<String> = HashSet::new();
	let mut paths: Vec<Vec<String>> = Vec::new();

	for entry in entries {
		let segments = path_segments(entry);

		match segments.len() {
			0 => {}
			1 => {
				names.extend(segments);
			}
			_ => paths.push(segments),
		}
	}

	move |segments: &[String]| {
		if segments.iter().any(|segment| names.contains(segment)) {
			return true;
		}

		paths.iter().any(|path| {
			path.len() <= segments.len() && path.iter().zip(segments).all(|(a, b)| a == b)
		})
	}
}

/// A test of whether a file name matches one of [patterns], ignoring case.
pub fn create_file_excluder<'a>(
	patterns: impl IntoIterator<Item = &'a String>,
) -> impl Fn(&str) -> bool {
	let mut exact: HashSet<String> = HashSet::new();
	// Cut once here rather than on every file the walk meets.
	let mut globs: Vec<Vec<String>> = Vec::new();

	for pattern in patterns {
		if pattern.is_empty() {
			continue;
		}

		if pattern.contains('*') {
			globs.push(
				pattern
					.to_lowercase()
					.split('*')
					.map(str::to_string)
					.collect(),
			);
		} else {
			exact.insert(pattern.to_lowercase());
		}
	}

	move |name: &str| {
		let subject = name.to_lowercase();

		exact.contains(&subject)
			|| globs.iter().any(|parts| {
				let parts: Vec<&str> = parts.iter().map(String::as_str).collect();

				matches_pattern_parts(&subject, &parts)
			})
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn matches_star_patterns() {
		assert!(matches_name_pattern("tsconfig.app.json", "tsconfig.*.json"));
		assert!(matches_name_pattern("Package-Lock.json", "*-lock.json"));
		assert!(!matches_name_pattern("ab", "a*b*b"));
		assert!(matches_name_pattern("abb", "a*b*b"));
		assert!(!matches_name_pattern("en.json", "package.json"));
	}

	#[test]
	fn excludes_a_name_anywhere_and_a_path_from_the_root() {
		let entries = vec!["node_modules".to_string(), "src/legacy".to_string()];
		let excluded = create_path_excluder(&entries);
		let path = |text: &str| text.split('/').map(str::to_string).collect::<Vec<_>>();

		assert!(excluded(&path("a/node_modules")));
		assert!(excluded(&path("src/legacy/old")));
		assert!(!excluded(&path("lib/legacy")));
	}
}
