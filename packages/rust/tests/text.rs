// The report measures, wraps and cuts every line it draws, so those helpers keep
// a running width and cut once instead of joining and measuring again. Each is
// held here to the way it used to answer, over strings built from the
// characters that sit on an edge of one of them: marks of no width, and wide
// characters on both planes.

use chki18n::core::width::{char_width, display_width};
use chki18n::reporter::text::{truncate, wrap};

fn reference_truncate(text: &str, max: usize) -> String {
	if display_width(text) <= max {
		return text.to_string();
	}

	let room = max.saturating_sub(3).max(1);
	let mut width = 0;
	let mut kept = String::new();

	for character in text.chars() {
		let next = width + char_width(character);

		if next > room {
			break;
		}

		width = next;
		kept.push(character);
	}

	format!("{kept}...")
}

fn reference_wrap(text: &str, width: usize) -> Vec<String> {
	if width < 8 {
		return vec![text.to_string()];
	}

	let mut lines = Vec::new();
	let mut line = String::new();

	for word in text.split(' ') {
		if line.is_empty() {
			line = word.to_string();
		} else if display_width(&line) + 1 + display_width(word) > width {
			lines.push(line);
			line = word.to_string();
		} else {
			line.push(' ');
			line.push_str(word);
		}
	}

	if !line.is_empty() {
		lines.push(line);
	}

	lines
}

// The JavaScript corpus also holds the lone surrogates U+D800 and U+DC00, which
// a Rust string cannot.
const ALPHABET: [&str; 19] = [
	"a",
	"Z",
	"0",
	".",
	" ",
	" ",
	" ",
	"\t",
	"\n",
	"\u{301}",
	"\u{1160}",
	"\u{fe0f}",
	"\u{e0100}",
	"\u{ac00}",
	"\u{3042}",
	"\u{ff01}",
	"\u{20000}",
	"\u{1f600}",
	"\u{e9}",
];

/// A fixed sequence of pseudo-random strings, the same on every run.
fn corpus() -> Vec<String> {
	// In floating point, as the JavaScript generator computes it.
	let mut seed: f64 = 20261127.0;
	let mut next = |limit: usize| -> usize {
		seed = (seed * 1103515245.0 + 12345.0) % 2147483648.0;

		(seed % limit as f64) as usize
	};
	let mut strings: Vec<String> = vec![String::new()];

	strings.extend(ALPHABET.iter().map(|character| character.to_string()));

	for _ in 0..20000 {
		let length = next(24);
		let mut text = String::new();

		for _ in 0..length {
			text.push_str(ALPHABET[next(ALPHABET.len())]);
		}

		strings.push(text);
	}

	strings
}

#[test]
fn cuts_a_value_at_the_end_where_it_always_was() {
	for text in corpus() {
		for max in [0, 1, 4, 5, 8, 13] {
			assert_eq!(
				truncate(&text, max),
				reference_truncate(&text, max),
				"{text:?} at {max}"
			);
		}
	}
}

#[test]
fn wraps_a_value_where_it_always_was() {
	for text in corpus() {
		for width in [7, 8, 10, 16] {
			assert_eq!(
				wrap(&text, width),
				reference_wrap(&text, width),
				"{text:?} at {width}"
			);
		}
	}
}
