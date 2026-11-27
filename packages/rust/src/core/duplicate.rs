//! Flattening nested translations into dotted keys, and the keys that end up
//! defined twice on the way.
//!
//! `{ "a": { "b": 1 }, "a.b": 2 }` flattens to `{ "a.b": 2 }`: two definitions
//! went in and one value came out. One walk answers every question below, so
//! the keys counted are exactly the keys the comparison sees. An object or an
//! array with anything in it is descended into; everything else, an empty
//! object or array included, is a leaf and keeps its value.

use std::collections::HashSet;

use indexmap::IndexSet;
use serde_json::{Map, Value};

use crate::core::js::object_keys;
use crate::types::TranslationMap;

/// The character between the segments of a flattened key.
pub const KEY_SEPARATOR: &str = ".";

fn walk<'a>(value: &'a Value, path: String, visit: &mut impl FnMut(String, &'a Value)) {
	match value {
		Value::Object(map) if !map.is_empty() => {
			for key in object_keys(map) {
				walk(&map[key.as_str()], join(&path, key), visit);
			}
		}
		Value::Array(items) if !items.is_empty() => {
			for (index, item) in items.iter().enumerate() {
				walk(item, join(&path, &index.to_string()), visit);
			}
		}
		_ => visit(path, value),
	}
}

/// Every leaf below an object, with its flattened key, in the order a
/// JavaScript object reaches the keys.
fn walk_map<'a>(map: &'a Map<String, Value>, visit: &mut impl FnMut(String, &'a Value)) {
	for key in object_keys(map) {
		walk(&map[key.as_str()], key.clone(), visit);
	}
}

/// Every leaf below [translations]. A value that is neither an object nor an
/// array with something in it has no leaves below it.
fn walk_leaves<'a>(translations: &'a Value, visit: &mut impl FnMut(String, &'a Value)) {
	match translations {
		Value::Object(map) => walk_map(map, visit),
		Value::Array(items) => {
			for (index, item) in items.iter().enumerate() {
				walk(item, index.to_string(), visit);
			}
		}
		_ => {}
	}
}

fn join(path: &str, segment: &str) -> String {
	if path.is_empty() {
		segment.to_string()
	} else {
		format!("{path}{KEY_SEPARATOR}{segment}")
	}
}

/// Adds one leaf to a flat map, noting a key it already holds.
fn add_leaf(flat: &mut TranslationMap, duplicates: &mut Vec<String>, key: String, value: &Value) {
	if flat.contains_key(&key) && !duplicates.contains(&key) {
		duplicates.push(key.clone());
	}

	flat.insert(key, value.clone());
}

/// The flattened translations, and every key that was defined more than once
/// on the way, in the order the second definitions were met.
pub fn flatten_with_duplicates(translations: &Value) -> (TranslationMap, Vec<String>) {
	let mut flat = Map::new();
	let mut duplicates: Vec<String> = Vec::new();

	walk_leaves(translations, &mut |key, value| {
		add_leaf(&mut flat, &mut duplicates, key, value)
	});

	(flat, duplicates)
}

/// [flatten_with_duplicates] for the object one locale's translations are.
pub fn flatten_object(map: &TranslationMap) -> (TranslationMap, Vec<String>) {
	let mut flat = Map::new();
	let mut duplicates: Vec<String> = Vec::new();

	walk_map(map, &mut |key, value| {
		add_leaf(&mut flat, &mut duplicates, key, value)
	});

	(flat, duplicates)
}

/// Flattens nested translations into the dotted keys the comparison works on.
pub fn flatten_translations(translations: &Value) -> TranslationMap {
	flatten_with_duplicates(translations).0
}

/// Every flattened key an object will produce, added to [into].
pub fn collect_flat_keys(translations: &Value, into: &mut IndexSet<String>) {
	walk_leaves(translations, &mut |key, _| {
		into.insert(key);
	});
}

/// Every flattened key defined more than once, in the order they are reached.
pub fn find_duplicate_keys(translations: &Value) -> Vec<String> {
	let mut seen = HashSet::new();
	let mut duplicates: Vec<String> = Vec::new();

	walk_leaves(translations, &mut |key, _| {
		if !seen.insert(key.clone()) && !duplicates.contains(&key) {
			duplicates.push(key);
		}
	});

	duplicates
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::core::js::object_keys;

	#[test]
	fn flattens_in_the_order_a_javascript_object_keeps() {
		let value: Value = serde_json::from_str(
			r#"{"b": {"c": "1"}, "404": "x", "list": ["p", {"q": "r"}], "e": {}}"#,
		)
		.unwrap();
		let flat = flatten_translations(&value);
		let keys: Vec<&str> = object_keys(&flat).into_iter().map(String::as_str).collect();

		assert_eq!(keys, ["404", "b.c", "list.0", "list.1.q", "e"]);
		assert_eq!(flat["e"], serde_json::json!({}));
	}

	#[test]
	fn names_a_key_defined_twice() {
		let value: Value = serde_json::from_str(r#"{"a": {"b": "1"}, "a.b": "2"}"#).unwrap();
		let (flat, duplicates) = flatten_with_duplicates(&value);

		assert_eq!(duplicates, ["a.b"]);
		assert_eq!(flat["a.b"], "2");
		assert_eq!(find_duplicate_keys(&value), ["a.b"]);
	}
}
