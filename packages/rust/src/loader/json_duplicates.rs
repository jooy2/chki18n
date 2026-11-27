//! Keys written twice inside one JSON object.
//!
//! `{"a": 1, "a": 2}` is valid JSON, and a parser answers `{"a": 2}` without a
//! word about the first one. It is what a botched merge conflict or a
//! hand-edited file leaves behind, so it is found here, in the text, before
//! parsing throws the duplicate away.
//!
//! This is a scanner rather than a parser: it tracks strings, nesting and which
//! strings are keys, and ignores everything else about the grammar. The file is
//! parsed for real straight afterwards, so malformed input is not this
//! function's problem; it just has to not report nonsense when it sees some.

use std::collections::HashSet;

/// A duplicated key, at the path its object sits at.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct JsonDuplicateKey {
	/// Dotted path of the key, from the document root.
	pub path: String,
	/// 1-based line the second definition is on.
	pub line: usize,
}

/// One object or array the scanner is inside.
struct Frame<'a> {
	/// Keys already seen in this object. `None` inside an array.
	keys: Option<HashSet<&'a str>>,
	/// Path of the object itself.
	path: String,
	/// Key the next value belongs to, once one has been read.
	pending_key: Option<&'a str>,
	/// Position of the current element, inside an array.
	index: usize,
}

fn join(path: &str, segment: &str) -> String {
	if path.is_empty() {
		segment.to_string()
	} else {
		format!("{path}.{segment}")
	}
}

/// Reads a JSON string starting at the opening quote: its text between the
/// quotes, where it ends, and how many line breaks it holds. Escapes are kept as
/// they are written: an unescaped comparison is enough to tell two keys apart.
fn read_string(text: &str, start: usize) -> (&str, usize, usize) {
	let bytes = text.as_bytes();
	let mut index = start + 1;
	let mut lines = 0;

	while index < bytes.len() {
		match bytes[index] {
			b'\\' => {
				// Whatever it escapes, it is not a closing quote.
				if bytes.get(index + 1) == Some(&b'\n') {
					lines += 1;
				}

				index += 2;
			}
			b'"' => return (&text[start + 1..index], index + 1, lines),
			byte => {
				if byte == b'\n' {
					lines += 1;
				}

				index += 1;
			}
		}
	}

	(text.get(start + 1..).unwrap_or(""), index, lines)
}

/// Every key written twice in one JSON document, in the order they are reached.
pub fn find_duplicate_json_keys(text: &str) -> Vec<JsonDuplicateKey> {
	let bytes = text.as_bytes();
	let mut duplicates = Vec::new();
	let mut stack: Vec<Frame<'_>> = Vec::new();
	let mut index = 0;
	let mut line = 1;
	// Whether the next string is a key: true just inside an object, and again
	// after every comma in one.
	let mut expect_key = false;

	while index < bytes.len() {
		match bytes[index] {
			b'\n' => {
				line += 1;
				index += 1;
			}
			b'"' => {
				let (value, end, lines) = read_string(text, index);

				if let Some(frame) = stack.last_mut() {
					if expect_key {
						if let Some(keys) = frame.keys.as_mut() {
							if !keys.insert(value) {
								duplicates.push(JsonDuplicateKey {
									path: join(&frame.path, value),
									line,
								});
							}

							frame.pending_key = Some(value);
							expect_key = false;
						}
					}
				}

				// Count the newlines a multi-line string swallowed.
				line += lines;
				index = end;
			}
			open @ (b'{' | b'[') => {
				let path = match stack.last() {
					None => String::new(),
					Some(parent) => {
						// An element of an array is addressed by its position, the way
						// flattening writes it: `list.0.label`.
						let segment = match &parent.keys {
							None => Some(parent.index.to_string()),
							Some(_) => parent.pending_key.map(str::to_string),
						};

						match segment {
							None => parent.path.clone(),
							Some(segment) => join(&parent.path, &segment),
						}
					}
				};
				let is_object = open == b'{';

				stack.push(Frame {
					keys: is_object.then(HashSet::new),
					path,
					pending_key: None,
					index: 0,
				});
				expect_key = is_object;
				index += 1;
			}
			b'}' | b']' => {
				stack.pop();
				expect_key = false;
				index += 1;
			}
			b',' => {
				if let Some(frame) = stack.last_mut() {
					if frame.keys.is_none() {
						frame.index += 1;
					}
				}

				expect_key = stack.last().is_some_and(|frame| frame.keys.is_some());
				index += 1;
			}
			_ => index += 1,
		}
	}

	duplicates
}

#[cfg(test)]
mod tests {
	use super::*;

	fn duplicate(path: &str, line: usize) -> JsonDuplicateKey {
		JsonDuplicateKey {
			path: path.into(),
			line,
		}
	}

	#[test]
	fn finds_a_key_written_twice() {
		assert_eq!(
			find_duplicate_json_keys(r#"{"a": 1, "a": 2}"#),
			[duplicate("a", 1)]
		);
		assert_eq!(
			find_duplicate_json_keys("{\n  \"a\": 1,\n\n  \"a\": 2\n}")[0].line,
			4
		);
		assert_eq!(
			find_duplicate_json_keys(r#"{"list": [{"y": 1}, {"x": 1, "x": 2}]}"#),
			[duplicate("list.1.x", 1)]
		);
		assert_eq!(
			find_duplicate_json_keys(r#"{"x": {"a": 1, "a": 2}}"#),
			[duplicate("x.a", 1)]
		);
		assert!(find_duplicate_json_keys(r#"{"x": {"a": 1}, "y": {"a": 2}}"#).is_empty());
		assert!(find_duplicate_json_keys(r#"{"a": "b", "b": "b"}"#).is_empty());
		assert!(find_duplicate_json_keys(r#"{"a": ["k", "k"]}"#).is_empty());
		assert_eq!(
			find_duplicate_json_keys(r#"{"a\"b": 1, "a\"b": 2}"#).len(),
			1
		);
	}

	#[test]
	fn keeps_count_of_lines_and_stops_at_an_open_string() {
		assert_eq!(
			find_duplicate_json_keys("{\"a\": \"one\ntwo\",\n\"a\": 2}")[0].line,
			3
		);
		assert_eq!(
			find_duplicate_json_keys("{\"a\": \"one\\\ntwo\",\n\"a\": 2}")[0].line,
			3
		);
		assert_eq!(
			find_duplicate_json_keys(r#"{"a": 1, "a"#),
			[duplicate("a", 1)]
		);
		assert!(find_duplicate_json_keys(r#"{"a": "b\"#).is_empty());
	}
}
