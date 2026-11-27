//! The Rust side of `tools/bench/run.mjs`: times each step over the generated
//! data and prints the medians as one line of JSON.
//!
//! ```text
//! cargo run --release --example bench -- <data dir> <runs>
//! ```

use std::fs;
use std::path::Path;
use std::time::Instant;

use chki18n::reporter::context::ReportInit;
use chki18n::{
	check_translation_files, create_analyzer, flatten_translations, format_result, Input, Options,
};
use indexmap::IndexMap;
use serde_json::Value;

const LOCALES: [&str; 5] = ["en", "ko", "ja", "de", "ru"];

fn median(runs: usize, mut step: impl FnMut()) -> f64 {
	for _ in 0..3 {
		step();
	}

	let mut times: Vec<f64> = (0..runs)
		.map(|_| {
			let started_at = Instant::now();

			step();
			started_at.elapsed().as_secs_f64() * 1000.0
		})
		.collect();

	times.sort_by(f64::total_cmp);

	times[times.len() / 2]
}

fn main() {
	let arguments: Vec<String> = std::env::args().skip(1).collect();
	let data_dir = Path::new(&arguments[0]);
	let runs: usize = arguments[1].parse().unwrap_or(10);
	let locales_dir = data_dir.join("locales");
	let source_dir = data_dir.join("src");
	let texts: Vec<String> = LOCALES
		.iter()
		.map(|locale| {
			fs::read_to_string(locales_dir.join(format!("{locale}.json"))).unwrap_or_default()
		})
		.collect();
	let nested: Vec<Value> = texts
		.iter()
		.map(|text| serde_json::from_str(text).unwrap_or(Value::Null))
		.collect();
	let flat: IndexMap<String, _> = LOCALES
		.iter()
		.zip(&nested)
		.map(|(locale, value)| (locale.to_string(), flatten_translations(value)))
		.collect();
	let options = Options {
		target: Some("en".into()),
		..Options::default()
	};
	let analyzer = create_analyzer(&Options {
		flattened: Some(true),
		..options.clone()
	});
	let input = Input {
		locales: Some(flat),
		..Input::default()
	};
	let result = analyzer.analyze(&input);
	let locales_path = locales_dir.to_string_lossy().into_owned();
	let with_source = Options {
		source: Some(source_dir.to_string_lossy().into_owned()),
		..options.clone()
	};
	let report = ReportInit {
		color: Some(false),
		width: Some(100),
		..ReportInit::default()
	};
	let steps = [
		(
			"parse",
			median(runs, || {
				for text in &texts {
					serde_json::from_str::<Value>(text).ok();
				}
			}),
		),
		(
			"flatten",
			median(runs, || {
				for value in &nested {
					flatten_translations(value);
				}
			}),
		),
		(
			"analyze",
			median(runs, || {
				analyzer.analyze(&input);
			}),
		),
		(
			"format",
			median(runs, || {
				format_result(&result, &analyzer.options, &report);
			}),
		),
		(
			"check",
			median(runs, || {
				check_translation_files(Some(&locales_path), &options);
			}),
		),
		(
			"check + source",
			median(runs, || {
				check_translation_files(Some(&locales_path), &with_source);
			}),
		),
	];
	let times: Vec<String> = steps
		.iter()
		.map(|(name, ms)| format!("\"{name}\":{ms}"))
		.collect();

	println!("{{\"issues\":{},{}}}", result.issues.len(), times.join(","));
}
