use std::path::Path;

use chki18n::constants::DEFAULT_EXCLUDE_FILES;
use chki18n::core::exclude::{
	create_file_excluder, create_path_excluder, matches_name_pattern, path_segments,
};
use chki18n::{find_unused_keys, resolve_options, scan_translation_directory, Options, ScanResult};

const SAMPLE_PATH: &str = "tests/samples/excluded-files";

fn strings(items: &[&str]) -> Vec<String> {
	items.iter().map(|item| item.to_string()).collect()
}

fn scan(options: Options) -> ScanResult {
	let (resolved, _) = resolve_options(&Options {
		target: Some("en".into()),
		..options
	});

	scan_translation_directory(Path::new(SAMPLE_PATH), &resolved)
}

fn files_of(exclude: &[&str]) -> Vec<String> {
	scan(Options {
		exclude: Some(strings(exclude)),
		..Options::default()
	})
	.files
	.into_iter()
	.map(|file| file.relative_path)
	.collect()
}

// pathSegments

#[test]
fn reads_a_path_written_either_way() {
	assert_eq!(path_segments("src/legacy"), ["src", "legacy"]);
	assert_eq!(path_segments(r"src\legacy"), ["src", "legacy"]);
}

#[test]
fn drops_what_carries_no_meaning() {
	assert_eq!(path_segments("./src//legacy/"), ["src", "legacy"]);
	assert!(path_segments("").is_empty());
}

// matchesNamePattern

#[test]
fn matches_a_name_with_no_wildcard_exactly() {
	assert!(matches_name_pattern("package.json", "package.json"));
	assert!(!matches_name_pattern("my-package.json", "package.json"));
}

#[test]
fn lets_a_star_stand_for_any_run_of_characters() {
	assert!(matches_name_pattern("pnpm-lock.json", "*-lock.json"));
	assert!(matches_name_pattern(
		"tsconfig.build.json",
		"tsconfig.*.json"
	));
	assert!(!matches_name_pattern("tsconfig.json", "tsconfig.*.json"));
}

#[test]
fn ignores_case_the_way_the_file_systems_these_names_come_from_do() {
	assert!(matches_name_pattern("Package.json", "package.json"));
}

#[test]
fn does_not_let_the_ends_of_a_pattern_claim_the_same_characters_twice() {
	assert!(matches_name_pattern("ab", "a*b"));
	assert!(!matches_name_pattern("ab", "a*b*b"));
}

// createPathExcluder

#[test]
fn reads_one_segment_as_a_name_at_any_depth() {
	let entries = strings(&["node_modules"]);
	let excluded = create_path_excluder(&entries);

	assert!(excluded(&strings(&["node_modules"])));
	assert!(excluded(&strings(&["src", "node_modules"])));
	assert!(!excluded(&strings(&["src"])));
}

#[test]
fn reads_two_segments_as_a_path_from_the_root() {
	let entries = strings(&["src/legacy"]);
	let excluded = create_path_excluder(&entries);

	assert!(excluded(&strings(&["src", "legacy"])));
	assert!(excluded(&strings(&["src", "legacy", "ui"])));
	assert!(!excluded(&strings(&["legacy"])));
	assert!(!excluded(&strings(&["app", "src", "legacy"])));
}

// createFileExcluder

#[test]
fn answers_for_the_default_list() {
	let patterns = strings(&DEFAULT_EXCLUDE_FILES);
	let excluded = create_file_excluder(&patterns);

	assert!(excluded("package-lock.json"));
	assert!(excluded("tsconfig.base.json"));
	assert!(excluded("vite.config.json"));
	assert!(!excluded("en.json"));
	assert!(!excluded("common.json"));
}

// excludeFiles

#[test]
fn leaves_a_configuration_file_out_of_the_scan_entirely() {
	let result = scan(Options::default());
	let groups: Vec<&str> = result.groups.keys().map(String::as_str).collect();

	assert_eq!(groups, ["admin/common.json", "common.json"]);
	// Not merely skipped: an excluded file is never read, which is the point.
	assert!(result.skipped.is_empty());
	assert!(result.issues.is_empty());
}

#[test]
fn reads_what_it_was_told_to_instead_of_the_default_list() {
	let result = scan(Options {
		exclude_files: Some(strings(&["nothing-matches-this"])),
		..Options::default()
	});

	assert!(result
		.files
		.iter()
		.any(|file| file.relative_path == "en/app.config.json"));
	assert_eq!(result.skipped, ["package-lock.json", "tsconfig.json"]);
}

#[test]
fn is_reported_on_the_resolved_options() {
	let (options, _) = resolve_options(&Options {
		exclude_files: Some(strings(&["*.tmp.json, notes.json"])),
		..Options::default()
	});
	let patterns: Vec<&str> = options.exclude_files.iter().map(String::as_str).collect();

	assert_eq!(patterns, ["*.tmp.json", "notes.json"]);
}

// Exclude by path

#[test]
fn skips_one_directory_named_by_its_path() {
	assert_eq!(
		files_of(&["admin/ko"]),
		["admin/en/common.json", "en/common.json", "ko/common.json"]
	);
}

#[test]
fn still_skips_a_bare_name_wherever_it_appears() {
	assert_eq!(
		files_of(&["ko"]),
		["admin/en/common.json", "en/common.json"]
	);
}

#[test]
fn applies_to_the_source_scan_as_well() {
	// A key nothing holds, so the walk cannot stop early and the count is the
	// number of files the excludes actually left it.
	let read_of = |exclude: &[&str]| {
		let (options, _) = resolve_options(&Options {
			target: Some("en".into()),
			exclude: Some(strings(exclude)),
			..Options::default()
		});

		find_unused_keys(
			Path::new(SAMPLE_PATH),
			&strings(&["nothing.at.all"]),
			&options,
			&[],
		)
		.scanned_file_count
	};

	// Four translation files; the lock file, the `tsconfig.json` and the
	// `app.config.json` are excluded by name.
	assert_eq!(read_of(&["node_modules"]), 4);
	assert_eq!(read_of(&["node_modules", "admin/ko"]), 3);
	assert_eq!(read_of(&["node_modules", "ko"]), 2);
}
