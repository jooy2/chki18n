//! The few places where a report depends on how JavaScript writes a value:
//! numbers, JSON, rounding, and the order an object lists its keys in.
//!
//! The JavaScript package is the reference the others are held to, character
//! for character, so a value is shown here the way `String(value)`,
//! `JSON.stringify` and `toFixed` would show it there.

use serde_json::{Map, Value};

/// Whether a key is one a JavaScript object lists before every other: a whole
/// number below 2^32 - 1 written without a leading zero.
pub fn is_array_index(key: &str) -> bool {
	let bytes = key.as_bytes();

	if bytes.is_empty() || bytes.len() > 10 {
		return false;
	}

	if bytes[0] == b'0' {
		return bytes.len() == 1;
	}

	let mut value: u64 = 0;

	for &byte in bytes {
		if !byte.is_ascii_digit() {
			return false;
		}

		value = value * 10 + u64::from(byte - b'0');
	}

	value < 4_294_967_295
}

/// The keys of an object in the order a JavaScript object lists them: the
/// whole numbers first, ascending, then every other key in the order it was
/// written.
pub fn object_keys(map: &Map<String, Value>) -> Vec<&String> {
	if !map.keys().any(|key| is_array_index(key)) {
		return map.keys().collect();
	}

	let mut indices: Vec<&String> = map.keys().filter(|key| is_array_index(key)).collect();

	indices.sort_by_key(|key| key.parse::<u64>().unwrap_or(u64::MAX));
	indices.extend(map.keys().filter(|key| !is_array_index(key)));

	indices
}

/// The names of an ordered map in the order a JavaScript object would list
/// them, for the groups and locales an object holds there.
pub fn names_in_object_order<T>(map: &indexmap::IndexMap<String, T>) -> Vec<&String> {
	if !map.keys().any(|key| is_array_index(key)) {
		return map.keys().collect();
	}

	let mut indices: Vec<&String> = map.keys().filter(|key| is_array_index(key)).collect();

	indices.sort_by_key(|key| key.parse::<u64>().unwrap_or(u64::MAX));
	indices.extend(map.keys().filter(|key| !is_array_index(key)));

	indices
}

/// A number as JavaScript's `String(number)` writes it: the shortest digits
/// that read back as the same number, in plain notation from 10^-6 up to 10^21
/// and in exponent notation outside it.
pub fn number_to_string(number: f64) -> String {
	if number.is_nan() {
		return "NaN".into();
	}

	if number.is_infinite() {
		return if number > 0.0 {
			"Infinity".into()
		} else {
			"-Infinity".into()
		};
	}

	if number == 0.0 {
		return "0".into();
	}

	let sign = if number < 0.0 { "-" } else { "" };
	// Rust's exponent form already holds the shortest round-trip digits.
	let scientific = format!("{:e}", number.abs());
	let (mantissa, exponent) = scientific.split_once('e').unwrap_or((&scientific, "0"));
	let digits: String = mantissa.chars().filter(char::is_ascii_digit).collect();
	let digits = digits.trim_end_matches('0');
	let digits = if digits.is_empty() { "0" } else { digits };
	let k = digits.len() as i64;
	let n = exponent.parse::<i64>().unwrap_or(0) + 1;
	let body = if k <= n && n <= 21 {
		format!("{digits}{}", "0".repeat((n - k) as usize))
	} else if 0 < n && n <= 21 {
		format!("{}.{}", &digits[..n as usize], &digits[n as usize..])
	} else if -6 < n && n <= 0 {
		format!("0.{}{digits}", "0".repeat((-n) as usize))
	} else {
		let power = n - 1;
		let sign_of_power = if power < 0 { '-' } else { '+' };

		if k == 1 {
			format!("{digits}e{sign_of_power}{}", power.abs())
		} else {
			format!(
				"{}.{}e{sign_of_power}{}",
				&digits[..1],
				&digits[1..],
				power.abs()
			)
		}
	};

	format!("{sign}{body}")
}

/// A JSON number as JavaScript holds it, which is always a double.
pub fn number_of(value: &serde_json::Number) -> f64 {
	value.as_f64().unwrap_or(0.0)
}

/// A number with [digits] places after the point, the way JavaScript's
/// `toFixed` writes it: rounded on the exact value of the double, with a value
/// exactly halfway rounded away from zero. Rust's own formatting rounds that
/// case to the even digit, so `0.25` would read `0.2` here and `0.3` there.
pub fn to_fixed(number: f64, digits: usize) -> String {
	if !number.is_finite() {
		return number_to_string(number);
	}

	// Every double has an exact decimal expansion of at most 1074 places.
	let exact = format!("{:.1100}", number.abs());
	let (whole, fraction) = exact.split_once('.').unwrap_or((&exact, ""));
	let kept = &fraction[..digits.min(fraction.len())];
	let rest = &fraction[digits.min(fraction.len())..];
	let round_up = rest.as_bytes().first().is_some_and(|&first| first >= b'5');
	let mut number_digits: Vec<u8> = whole.bytes().chain(kept.bytes()).collect();

	if round_up {
		let mut index = number_digits.len();

		loop {
			if index == 0 {
				number_digits.insert(0, b'1');
				break;
			}

			index -= 1;

			if number_digits[index] == b'9' {
				number_digits[index] = b'0';
			} else {
				number_digits[index] += 1;
				break;
			}
		}
	}

	let text = String::from_utf8(number_digits).unwrap_or_default();
	let split = text.len() - digits;
	let body = if digits == 0 {
		text.clone()
	} else {
		format!("{}.{}", &text[..split], &text[split..])
	};
	let is_zero = body.bytes().all(|byte| byte == b'0' || byte == b'.');

	if number < 0.0 && !is_zero {
		format!("-{body}")
	} else {
		body
	}
}

/// A string as `JSON.stringify` quotes it.
pub fn quote_json(text: &str, into: &mut String) {
	into.push('"');

	for character in text.chars() {
		match character {
			'"' => into.push_str("\\\""),
			'\\' => into.push_str("\\\\"),
			'\u{8}' => into.push_str("\\b"),
			'\u{c}' => into.push_str("\\f"),
			'\n' => into.push_str("\\n"),
			'\r' => into.push_str("\\r"),
			'\t' => into.push_str("\\t"),
			control if (control as u32) < 0x20 => {
				into.push_str(&format!("\\u{:04x}", control as u32));
			}
			other => into.push(other),
		}
	}

	into.push('"');
}

/// A value as `JSON.stringify` writes it on one line.
pub fn stringify(value: &Value) -> String {
	let mut out = String::new();

	write_json(value, &mut out);

	out
}

fn write_json(value: &Value, out: &mut String) {
	match value {
		Value::Null => out.push_str("null"),
		Value::Bool(flag) => out.push_str(if *flag { "true" } else { "false" }),
		Value::Number(number) => out.push_str(&number_to_string(number_of(number))),
		Value::String(text) => quote_json(text, out),
		Value::Array(items) => {
			out.push('[');

			for (index, item) in items.iter().enumerate() {
				if index > 0 {
					out.push(',');
				}

				write_json(item, out);
			}

			out.push(']');
		}
		Value::Object(map) => {
			out.push('{');

			for (index, key) in object_keys(map).into_iter().enumerate() {
				if index > 0 {
					out.push(',');
				}

				quote_json(key, out);
				out.push(':');
				write_json(&map[key], out);
			}

			out.push('}');
		}
	}
}

/// A value as `JSON.stringify(value, null, indent)` writes it across lines.
pub fn stringify_pretty(value: &Value, indent: &str) -> String {
	let mut out = String::new();

	write_pretty(value, indent, 0, &mut out);

	out
}

fn write_pretty(value: &Value, indent: &str, depth: usize, out: &mut String) {
	let newline = |out: &mut String, depth: usize| {
		out.push('\n');
		out.push_str(&indent.repeat(depth));
	};

	match value {
		Value::Array(items) if !items.is_empty() => {
			out.push('[');

			for (index, item) in items.iter().enumerate() {
				if index > 0 {
					out.push(',');
				}

				newline(out, depth + 1);
				write_pretty(item, indent, depth + 1, out);
			}

			newline(out, depth);
			out.push(']');
		}
		Value::Object(map) if !map.is_empty() => {
			out.push('{');

			for (index, key) in object_keys(map).into_iter().enumerate() {
				if index > 0 {
					out.push(',');
				}

				newline(out, depth + 1);
				quote_json(key, out);
				out.push_str(": ");
				write_pretty(&map[key], indent, depth + 1, out);
			}

			newline(out, depth);
			out.push('}');
		}
		other => write_json(other, out),
	}
}

/// A value as text, the way a report shows it whatever its original type: a
/// string as it is, an object or an array as JSON, anything else as
/// `String(value)` writes it.
pub fn display_value(value: &Value) -> String {
	match value {
		Value::String(text) => text.clone(),
		Value::Array(_) | Value::Object(_) => stringify(value),
		Value::Null => "null".into(),
		Value::Bool(flag) => flag.to_string(),
		Value::Number(number) => number_to_string(number_of(number)),
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn writes_numbers_the_way_javascript_does() {
		let cases = [
			(0.0, "0"),
			(1.0, "1"),
			(-1.5, "-1.5"),
			(123456789.0, "123456789"),
			(0.1, "0.1"),
			(0.000001, "0.000001"),
			(0.0000001, "1e-7"),
			(1.5e-7, "1.5e-7"),
			(1e21, "1e+21"),
			(123e20, "1.23e+22"),
			(1e20, "100000000000000000000"),
			(9007199254740993.0, "9007199254740992"),
			(0.1 + 0.2, "0.30000000000000004"),
		];

		for (number, expected) in cases {
			assert_eq!(number_to_string(number), expected, "{number}");
		}
	}

	#[test]
	fn rounds_a_tie_away_from_zero_like_to_fixed() {
		assert_eq!(to_fixed(0.25, 1), "0.3");
		assert_eq!(to_fixed(2.25, 1), "2.3");
		assert_eq!(to_fixed(0.35, 1), "0.3");
		assert_eq!(to_fixed(9.96, 1), "10.0");
		assert_eq!(to_fixed(1.0, 1), "1.0");
		assert_eq!(to_fixed(4.0 / 3.0, 1), "1.3");
		assert_eq!(to_fixed(-0.25, 1), "-0.3");
		assert_eq!(to_fixed(-0.01, 1), "0.0");
	}

	#[test]
	fn lists_whole_number_keys_first() {
		let value: Value = serde_json::from_str(r#"{"b":1,"10":2,"a":3,"2":4,"01":5}"#).unwrap();
		let keys: Vec<&str> = object_keys(value.as_object().unwrap())
			.into_iter()
			.map(String::as_str)
			.collect();

		assert_eq!(keys, ["2", "10", "b", "a", "01"]);
	}

	#[test]
	fn writes_json_the_way_stringify_does() {
		let value: Value =
			serde_json::from_str(r#"{"a":[1,2.5,"x\n\u0001"],"1":null,"b":{"c":true}}"#).unwrap();

		assert_eq!(
			stringify(&value),
			r#"{"1":null,"a":[1,2.5,"x\n\u0001"],"b":{"c":true}}"#
		);
	}
}
