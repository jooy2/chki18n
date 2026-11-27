use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::{Map, Value};

static NEXT_DIR: AtomicUsize = AtomicUsize::new(0);

/// A directory of translations whose report is far larger than the 64 KB a
/// pipe holds at once, removed when the test ends however it ends.
struct LargeSample(PathBuf);

impl LargeSample {
	fn new() -> LargeSample {
		let nanos = SystemTime::now()
			.duration_since(UNIX_EPOCH)
			.map_or(0, |elapsed| elapsed.as_nanos());
		let path = std::env::temp_dir().join(format!(
			"chki18n-cli-{}-{nanos}-{}",
			std::process::id(),
			NEXT_DIR.fetch_add(1, Ordering::Relaxed)
		));
		let mut en = Map::new();
		let mut ko = Map::new();

		// Every Korean value is left untranslated.
		for index in 0..3000 {
			let value = Value::String(format!("Value number {index}"));

			en.insert(format!("group.key{index}"), value.clone());
			ko.insert(format!("group.key{index}"), value);
		}

		fs::create_dir_all(&path).unwrap();
		fs::write(
			path.join("en.json"),
			serde_json::to_string(&Value::Object(en)).unwrap(),
		)
		.unwrap();
		fs::write(
			path.join("ko.json"),
			serde_json::to_string(&Value::Object(ko)).unwrap(),
		)
		.unwrap();

		LargeSample(path)
	}

	fn path(&self) -> String {
		self.0.to_string_lossy().into_owned()
	}
}

impl Drop for LargeSample {
	fn drop(&mut self) {
		fs::remove_dir_all(&self.0).ok();
	}
}

/// Runs the command line with its output on a pipe, as a CI runner reads it.
fn run_cli(args: &[&str]) -> (Option<i32>, String) {
	let output = Command::new(env!("CARGO_BIN_EXE_chki18n"))
		.args(args)
		.output()
		.unwrap();

	(
		output.status.code(),
		String::from_utf8(output.stdout).unwrap(),
	)
}

#[test]
fn writes_the_whole_report_into_a_pipe_before_it_exits() {
	let sample = LargeSample::new();
	let (code, stdout) = run_cli(&[&sample.path(), "--target", "en", "--reporter", "json"]);
	let result: Value = serde_json::from_str(&stdout).unwrap();

	assert!(stdout.len() > 64 * 1024);
	assert_eq!(
		result["issuesByCode"]["NOT_TRANSLATED_VALUE"]
			.as_array()
			.map(Vec::len),
		Some(3000)
	);
	assert_eq!(code, Some(0));
}

#[test]
fn exits_with_1_when_an_error_level_issue_was_found() {
	let sample = LargeSample::new();
	let (code, _) = run_cli(&[&sample.path(), "--target", "fr", "--reporter", "list"]);

	assert_eq!(code, Some(1));
}
