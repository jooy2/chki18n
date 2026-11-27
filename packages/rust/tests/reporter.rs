use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use chki18n::core::issue::{create_issue, IssueInit};
use chki18n::core::result::{build_result, ResultFacts};
use chki18n::core::width::display_width;
use chki18n::options::reporter_of_file_name;
use chki18n::reporter::group::group_issues;
use chki18n::reporter::text::{pad_to, truncate};
use chki18n::{
	analyze_translations, check_translation_files, format_result, resolve_options, CheckCode,
	CheckResult, GroupBy, Input, Issue, Level, Options, ReportInit, Reporter,
};
use indexmap::IndexMap;
use serde_json::{json, Map, Value};

fn sample_path(name: &str) -> String {
	format!("tests/samples/{name}")
}

/// A directory outside the project, removed when the test ends however it ends.
struct OutputDir(PathBuf);

static NEXT_DIR: AtomicUsize = AtomicUsize::new(0);

impl OutputDir {
	fn new() -> OutputDir {
		let nanos = SystemTime::now()
			.duration_since(UNIX_EPOCH)
			.map_or(0, |elapsed| elapsed.as_nanos());
		let path = std::env::temp_dir().join(format!(
			"chki18n-report-{}-{nanos}-{}",
			std::process::id(),
			NEXT_DIR.fetch_add(1, Ordering::Relaxed)
		));

		fs::create_dir_all(&path).unwrap();

		OutputDir(path)
	}

	fn join(&self, name: &str) -> PathBuf {
		self.0.join(name)
	}
}

impl Drop for OutputDir {
	fn drop(&mut self) {
		fs::remove_dir_all(&self.0).ok();
	}
}

fn options_en() -> Options {
	Options {
		target: Some("en".into()),
		..Options::default()
	}
}

/// The sample every reporter is measured against: one of nearly every check.
fn analyze() -> CheckResult {
	check_translation_files(Some(&sample_path("locales-all-issues")), &options_en())
}

fn render(result: &CheckResult, options: Options, init: ReportInit) -> String {
	let (resolved, _) = resolve_options(&Options {
		target: options.target.clone().or_else(|| Some("en".into())),
		color: options.color.or(Some(false)),
		..options
	});

	format_result(result, &resolved, &init)
}

fn reporter(name: &str) -> Options {
	Options {
		reporter: Some(name.into()),
		..Options::default()
	}
}

fn has_ansi(text: &str) -> bool {
	text.contains("\u{1b}[")
}

/// The command line, with colour forced on as a terminal would take it.
fn run_coloured(args: &[&str]) -> String {
	let output = Command::new(env!("CARGO_BIN_EXE_chki18n"))
		.args(args)
		.env("FORCE_COLOR", "1")
		.env_remove("NO_COLOR")
		.output()
		.unwrap();

	String::from_utf8(output.stdout).unwrap()
}

fn issue(file: &str, target_value: Option<&str>, message: &str) -> Issue {
	Issue {
		code: CheckCode::NoKey,
		level: Level::Error,
		locale: "ko".into(),
		key: "attr.folder".into(),
		group: String::new(),
		value: None,
		target_value: target_value.map(str::to_string),
		interpolation: None,
		related_key: None,
		file: Some(file.into()),
		message: message.into(),
	}
}

fn one_issue_result(issue: Issue) -> CheckResult {
	build_result(
		vec![issue],
		&resolve_options(&options_en()).0,
		ResultFacts {
			locales: vec!["en".into(), "ko".into()],
			groups: vec![String::new()],
			key_count: 1,
			..ResultFacts::default()
		},
	)
}

/// One issue, so a property can carry the characters a command breaks on.
fn awkward() -> CheckResult {
	one_issue_result(issue(
		"/repo/lo,cales/ko.json",
		Some("Folder"),
		"Missing: here, and there.",
	))
}

fn first_line(text: &str) -> &str {
	text.split('\n').next().unwrap_or("")
}

// reporter options

#[test]
fn defaults_to_a_grouped_coloured_report_and_no_file() {
	let (options, _) = resolve_options(&Options::default());

	assert_eq!(options.reporter, Reporter::Pretty);
	assert_eq!(options.group_by, GroupBy::Locale);
	assert_eq!(options.output, None);
	assert_eq!(options.output_reporter, None);
	assert!(options.color);
}

#[test]
fn falls_back_and_says_so_when_a_reporter_is_not_one_it_knows() {
	let (options, issues) = resolve_options(&reporter("fancy"));

	assert_eq!(options.reporter, Reporter::Pretty);
	assert!(issues.iter().any(|issue| issue.message.contains("fancy")));
}

#[test]
fn reads_a_reporter_name_whatever_its_case() {
	assert_eq!(
		resolve_options(&reporter("JSON")).0.reporter,
		Reporter::Json
	);
}

#[test]
fn takes_the_file_reporter_from_the_extension() {
	assert_eq!(reporter_of_file_name("report.json"), Reporter::Json);
	assert_eq!(reporter_of_file_name("report.md"), Reporter::Markdown);
	assert_eq!(reporter_of_file_name("report.txt"), Reporter::Pretty);
	assert_eq!(reporter_of_file_name("report"), Reporter::Pretty);
}

#[test]
fn lets_an_explicit_reporter_override_what_the_extension_implies() {
	let (options, _) = resolve_options(&Options {
		output: Some("report.json".into()),
		..reporter("list")
	});

	assert_eq!(options.output_reporter, Some(Reporter::List));
}

#[test]
fn uses_the_extension_when_no_reporter_was_named() {
	let (options, _) = resolve_options(&Options {
		output: Some("report.md".into()),
		..Options::default()
	});

	assert_eq!(options.reporter, Reporter::Pretty);
	assert_eq!(options.output_reporter, Some(Reporter::Markdown));
}

// `width` is always text in Rust, so only the form a flag gives it is ported.
#[test]
fn reads_a_width_from_the_string_a_flag_gives_it() {
	let (options, _) = resolve_options(&Options {
		width: Some("80".into()),
		..Options::default()
	});

	assert_eq!(options.width, Some(80));
}

#[test]
fn measures_the_terminal_instead_when_the_width_is_not_a_column_count() {
	for value in ["abc", "0", "-10"] {
		let (options, issues) = resolve_options(&Options {
			width: Some(value.into()),
			..Options::default()
		});

		assert_eq!(options.width, None, "{value}");
		assert!(
			issues
				.iter()
				.any(|issue| issue.message.contains("not a usable `width`")),
			"{value}"
		);
	}
}

#[test]
fn leaves_the_width_unset_when_nothing_asked_for_one() {
	assert_eq!(resolve_options(&Options::default()).0.width, None);
}

// formatResult

#[test]
fn renders_one_section_per_locale_by_default() {
	let report = render(&analyze(), Options::default(), ReportInit::default());

	assert!(report.contains(" ko "));
	assert!(report.contains("NO_KEY"));
	assert!(report.contains("only-en"));
	assert!(report.contains("FAIL"));
	// The locale nothing is wrong with is still worth naming.
	assert!(report.contains("Clean: en"));
}

#[test]
fn renders_one_section_per_check_when_asked_to() {
	let report = render(
		&analyze(),
		Options {
			group_by: Some("code".into()),
			..Options::default()
		},
		ReportInit::default(),
	);

	assert!(report.contains(" NO_KEY "));
	assert!(report.contains("By locale"));
}

// Through the binary, so the colour turned off is the only thing keeping the
// escape codes out.
#[test]
fn leaves_out_the_colours_when_they_are_turned_off() {
	let report = run_coloured(&[
		&sample_path("locales-all-issues"),
		"--target",
		"en",
		"--no-color",
	]);

	assert!(report.contains("NO_KEY"));
	assert!(!has_ansi(&report));
}

#[test]
fn writes_one_line_per_issue_as_a_list() {
	let result = analyze();
	let report = render(&result, reporter("list"), ReportInit::default());
	let lines: Vec<&str> = report
		.split('\n')
		.filter(|line| line.starts_with("ko"))
		.collect();

	assert_eq!(lines.len(), result.issues.len());
	assert!(lines[0].contains("error"));
	assert!(lines[0].contains("NO_KEY"));
}

#[test]
fn writes_a_table_per_section_as_markdown() {
	let report = render(&analyze(), reporter("markdown"), ReportInit::default());

	assert!(report.starts_with("# Translation check"));
	assert!(report.contains("## ko"));
	assert!(report.contains("| Level | Check"));
}

#[test]
fn pads_a_markdown_table_to_one_width_counting_a_wide_character_as_two() {
	let report = render(&analyze(), reporter("markdown"), ReportInit::default());
	let rows: Vec<&str> = report
		.split('\n')
		.filter(|line| line.starts_with('|'))
		.collect();
	let widths: HashSet<usize> = rows.iter().map(|row| display_width(row)).collect();

	// The sample holds a Korean value, so equal widths here can only come from
	// counting columns rather than characters.
	assert!(rows
		.iter()
		.any(|row| row.chars().any(|c| ('\u{ac00}'..='\u{d7a3}').contains(&c))));
	assert_eq!(widths.len(), 1, "{widths:?}");
}

#[test]
fn shows_the_markup_in_a_value_as_written_rather_than_rendering_it() {
	let mut locales: IndexMap<String, Map<String, Value>> = IndexMap::new();

	locales.insert(
		"en".into(),
		json!({ "a": "Press <b>Save</b>" })
			.as_object()
			.unwrap()
			.clone(),
	);
	locales.insert(
		"ko".into(),
		json!({ "a": "\u{c800}\u{c7a5}\u{c744} \u{b204}\u{b974}\u{c138}\u{c694}" })
			.as_object()
			.unwrap()
			.clone(),
	);

	let result = analyze_translations(
		&Input {
			locales: Some(locales),
			..Input::default()
		},
		&Options {
			flattened: Some(true),
			checks: Some(vec!["TAG_MISMATCH".into()]),
			..options_en()
		},
	);
	let report = render(&result, reporter("markdown"), ReportInit::default());
	let row = report
		.split('\n')
		.find(|line| line.contains("TAG_MISMATCH"))
		.unwrap_or("");

	assert!(
		row.contains("en: \"Press &lt;b&gt;Save&lt;/b&gt;\""),
		"{row}"
	);
	// A code span is shown as written already, so the note keeps its tags.
	assert!(row.contains("`<b>`"), "{row}");
}

#[test]
fn hands_back_the_whole_result_as_json_unfiltered() {
	let result = analyze();
	let parsed: Value = serde_json::from_str(&render(
		&result,
		Options {
			warn: Some(false),
			..reporter("json")
		},
		ReportInit::default(),
	))
	.unwrap();

	assert_eq!(
		parsed["issues"].as_array().map(Vec::len),
		Some(result.issues.len())
	);
	assert_eq!(parsed["summary"], result.to_json()["summary"]);
}

#[test]
fn drops_the_warnings_and_their_lines_with_them_on_no_warn() {
	let result = analyze();
	let report = render(
		&result,
		Options {
			warn: Some(false),
			..Options::default()
		},
		ReportInit::default(),
	);

	assert!(!report.contains("EMPTY_VALUE"));
	assert!(report.contains(&format!("{} issues not shown", result.summary.warn)));
	assert!(report.contains("NO_KEY"));
}

#[test]
fn leaves_out_the_heading_block_and_the_summary_on_no_info() {
	let report = render(
		&analyze(),
		Options {
			info: Some(false),
			..Options::default()
		},
		ReportInit::default(),
	);

	assert!(!report.contains("Compared 11 keys"));
	assert!(report.contains("NO_KEY"));
}

#[test]
fn lays_the_report_out_to_the_width_it_is_given() {
	let report = render(
		&analyze(),
		Options::default(),
		ReportInit {
			width: Some(60),
			..ReportInit::default()
		},
	);
	let rules: Vec<&str> = report
		.split('\n')
		.filter(|line| line.contains('\u{2500}'))
		.collect();

	assert!(!rules.is_empty());

	for rule in rules {
		assert_eq!(display_width(rule), 60, "{rule}");
	}
}

#[test]
fn wraps_a_description_rather_than_cutting_it_short() {
	let report = render(
		&analyze(),
		Options::default(),
		ReportInit {
			width: Some(56),
			..ReportInit::default()
		},
	);

	assert!(report.contains("The key exists in the target language but is"));
	assert!(!report.contains("..."));
}

#[test]
fn says_so_rather_than_printing_nothing_when_a_run_is_clean() {
	let result = check_translation_files(
		Some(&sample_path("multiple-translate-files")),
		&options_en(),
	);

	assert!(render(&result, Options::default(), ReportInit::default()).contains("PASS"));
}

// the GitHub reporter

#[test]
fn writes_one_workflow_command_per_issue() {
	let result = analyze();
	let cwd = std::env::current_dir().unwrap();
	let report = render(
		&result,
		reporter("github"),
		ReportInit {
			cwd: Some(cwd.to_string_lossy().into_owned()),
			..ReportInit::default()
		},
	);
	let commands: Vec<&str> = report
		.split('\n')
		.filter(|line| line.starts_with("::"))
		.collect();

	assert_eq!(commands.len(), result.issues.len());
	assert!(commands[0].starts_with("::error "));
	assert!(commands[0].contains("title=chki18n NO_KEY"));
	// The path is relative to the working directory, which is what GitHub
	// resolves an annotation against.
	assert!(
		commands[0].contains("file=tests/samples/locales-all-issues/ko.json"),
		"{}",
		commands[0]
	);
}

#[test]
fn names_each_severity_the_way_github_does() {
	let report = render(&analyze(), reporter("github"), ReportInit::default());

	assert!(report.contains("::warning "));
	assert!(!report.contains("::warn "));
}

#[test]
fn escapes_what_would_otherwise_end_a_command_or_a_property() {
	let report = render(
		&awkward(),
		reporter("github"),
		ReportInit {
			cwd: Some("/repo".into()),
			..ReportInit::default()
		},
	);
	let command = first_line(&report);

	assert!(command.contains("file=lo%2Ccales/ko.json"), "{command}");
	// The message keeps its punctuation; only a property value may not.
	assert!(command.contains("Missing: here, and there."), "{command}");
}

#[test]
fn writes_a_path_github_can_match_whatever_the_runner_calls_a_separator() {
	let on_windows = one_issue_result(issue("D:\\repo\\locales\\ko.json", None, "Missing."));
	let report = render(
		&on_windows,
		reporter("github"),
		ReportInit {
			cwd: Some("D:\\repo".into()),
			..ReportInit::default()
		},
	);
	let command = first_line(&report);

	// GitHub matches an annotation against a repository path, which is always
	// written with forward slashes.
	assert!(command.contains("file=locales/ko.json"), "{command}");
}

#[test]
fn leaves_out_what_the_level_options_hid() {
	let report = render(
		&analyze(),
		Options {
			warn: Some(false),
			..reporter("github")
		},
		ReportInit::default(),
	);

	assert!(!report.contains("::warning "));
	assert!(report.contains("::error "));
}

// groupIssues

#[test]
fn puts_the_sections_that_fail_the_run_first() {
	let result = analyze();
	let issues: Vec<&Issue> = result.issues.iter().collect();
	let sections = group_issues(&issues, GroupBy::Code, "");

	assert!(sections.len() > 1);
	assert!(sections[0].counts.error > 0);
	assert_eq!(
		sections
			.iter()
			.map(|section| section.issues.len())
			.sum::<usize>(),
		result.issues.len()
	);
}

#[test]
fn collects_what_the_axis_cannot_name_into_one_section() {
	let general = create_issue(
		CheckCode::InvalidOptions,
		IssueInit {
			level: Some(Level::Warn),
			message: Some("bad".into()),
			..IssueInit::default()
		},
	);
	let sections = group_issues(&[&general], GroupBy::Locale, "");

	assert_eq!(sections[0].label, "(general)");
}

#[test]
fn orders_keys_by_their_code_units_whatever_locale_the_process_runs_in() {
	let issues: Vec<Issue> = ["apple", "a_b", "Zebra", "a-b"]
		.iter()
		.map(|key| {
			create_issue(
				CheckCode::NoKey,
				IssueInit {
					level: Some(Level::Error),
					locale: Some("ko".into()),
					key: Some(key.to_string()),
					message: Some("missing".into()),
					..IssueInit::default()
				},
			)
		})
		.collect();
	let refs: Vec<&Issue> = issues.iter().collect();
	let sections = group_issues(&refs, GroupBy::Locale, "");
	let keys: Vec<&str> = sections[0]
		.issues
		.iter()
		.map(|issue| issue.key.as_str())
		.collect();

	assert_eq!(keys, ["Zebra", "a-b", "a_b", "apple"]);
}

// column arithmetic

#[test]
fn counts_a_korean_or_japanese_character_as_two_columns() {
	assert_eq!(display_width("abc"), 3);
	assert_eq!(display_width("\u{d55c}\u{ad6d}\u{c5b4}"), 6);
	assert_eq!(display_width("\u{65e5}\u{672c}\u{8a9e}"), 6);
}

#[test]
fn gives_a_combining_mark_no_column_and_an_emoji_two() {
	assert_eq!(
		display_width("\u{e17}\u{e35}\u{e48}\u{e19}\u{e35}\u{e48}"),
		2
	);
	assert_eq!(
		display_width("\u{939}\u{93f}\u{928}\u{94d}\u{926}\u{940}"),
		5
	);
	assert_eq!(display_width("Save \u{1f680}"), 7);
	assert_eq!(display_width("e\u{301}"), 1);
}

#[test]
fn pads_to_a_column_count_rather_than_a_character_count() {
	assert_eq!(display_width(&pad_to("\u{d55c}\u{ad6d}\u{c5b4}", 10)), 10);
	assert_eq!(display_width(&pad_to("abc", 10)), 10);
}

#[test]
fn cuts_to_a_column_count_and_marks_the_cut() {
	assert_eq!(truncate("abcdefghij", 5), "ab...");
	assert_eq!(truncate("abc", 5), "abc");
	assert!(
		display_width(&truncate(
			"\u{d55c}\u{ad6d}\u{c5b4}\u{c785}\u{b2c8}\u{b2e4}",
			7
		)) <= 7
	);
}

// writing the report to a file

#[test]
fn creates_the_directory_and_writes_what_the_extension_asked_for() {
	let directory = OutputDir::new();
	let file = directory.join("nested").join("report.json");
	let result = check_translation_files(
		Some(&sample_path("locales-all-issues")),
		&Options {
			output: Some(file.to_string_lossy().into_owned()),
			..options_en()
		},
	);
	let written: Value = serde_json::from_str(&fs::read_to_string(&file).unwrap()).unwrap();

	assert_eq!(
		written["summary"]["error"].as_u64(),
		Some(result.summary.error as u64)
	);
	assert_eq!(
		written["issues"].as_array().map(Vec::len),
		Some(result.issues.len())
	);
}

// Through the binary, so the console takes colour and only the file is plain.
#[test]
fn never_writes_escape_codes_into_a_file() {
	let directory = OutputDir::new();
	let file = directory.join("report.txt");
	let console = run_coloured(&[
		&sample_path("locales-all-issues"),
		"--target",
		"en",
		"--output",
		&file.to_string_lossy(),
	]);

	// Colour was on, so a plain file was a choice rather than the default.
	assert!(has_ansi(&console));
	assert!(!has_ansi(&fs::read_to_string(&file).unwrap()));
}

#[test]
fn fails_the_run_when_the_report_cannot_be_written() {
	// A path whose parent is a file cannot be created.
	let output = Path::new(&sample_path("locales-no-issue"))
		.join("en.json")
		.join("report.txt");
	let result = check_translation_files(
		Some(&sample_path("locales-no-issue")),
		&Options {
			output: Some(output.to_string_lossy().into_owned()),
			..options_en()
		},
	);

	assert!(!result.success);
	assert!(result
		.issues
		.iter()
		.any(|issue| issue.message.contains("could not be written")));
}
