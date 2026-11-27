//! Searching a source tree for the keys it uses, and for the keys it asks for
//! that nothing defines.

use std::fs;
use std::path::Path;

use indexmap::{IndexMap, IndexSet};

use crate::core::hash::{FastBuild, FastMap, FastSet};

use crate::constants::{CheckCode, SOURCE_EXTENSIONS, SOURCE_MAX_FILE_BYTES};
use crate::core::chars::{is_space, is_word_byte};
use crate::core::exclude::{create_file_excluder, create_path_excluder};
use crate::core::plural::plural_base_of;
use crate::loader::walk::{extension_of, resolve_path, walk_files, WalkItem, WalkedFile};
use crate::options::ResolvedOptions;
use crate::types::KeyUsage;

/// What one walk of a source tree found.
#[derive(Clone, Debug, Default)]
pub struct UsageScan {
	/// Keys nothing in the tree appears to reference.
	pub unused_keys: Vec<String>,
	/// Keys the tree asks for that nothing defines, with the first file asking.
	pub undefined_keys: Vec<KeyUsage>,
	/// How many files were read.
	pub scanned_file_count: usize,
}

/// The last segment of a key, by its plural base: what the source writes to
/// ask for it. `attr.item_one` is asked for as `item`.
pub fn leaf_of_key(key: &str) -> &str {
	let leaf = key.rfind('.').map_or(key, |index| &key[index + 1..]);

	plural_base_of(leaf).unwrap_or(leaf)
}

fn is_scannable_name(name: &str) -> bool {
	SOURCE_EXTENSIONS.contains(&extension_of(name).as_str())
}

/// The two bytes of [text] at [at], as one number a set can hold.
fn head_of(text: &[u8], at: usize) -> u16 {
	(u16::from(text[at]) << 8) | u16::from(text[at + 1])
}

/// A search that takes out of `remaining` every leaf a text holds, as plain
/// substrings, the way `contains` would find them.
///
/// Each run of word characters is cut into the pieces as long as some leaf is
/// and looked up in a set, and a run met in an earlier file is not cut again,
/// since identifiers repeat from file to file. A piece whose first two
/// characters start no leaf is passed over without being cut out at all. A leaf
/// with any other character in it is searched for on its own.
struct LeafSearch {
	words: FastSet<String>,
	others: IndexSet<String>,
	lengths: Vec<usize>,
	heads: FastSet<u16>,
	seen_runs: FastSet<String>,
}

impl LeafSearch {
	fn new(remaining: &FastSet<String>) -> LeafSearch {
		let mut words = FastSet::default();
		let mut others = IndexSet::new();

		for leaf in remaining {
			if !leaf.is_empty() && leaf.bytes().all(is_word_byte) {
				words.insert(leaf.clone());
			} else {
				others.insert(leaf.clone());
			}
		}

		let mut lengths: Vec<usize> = words
			.iter()
			.map(String::len)
			.collect::<FastSet<_>>()
			.into_iter()
			.collect();

		lengths.sort_unstable();

		let heads = words
			.iter()
			.filter(|leaf| leaf.len() > 1)
			.map(|leaf| head_of(leaf.as_bytes(), 0))
			.collect();

		LeafSearch {
			words,
			others,
			lengths,
			heads,
			seen_runs: FastSet::default(),
		}
	}

	fn search_run(&mut self, run: &str, remaining: &mut FastSet<String>) {
		let bytes = run.as_bytes();

		for &length in &self.lengths {
			if length > bytes.len() {
				break;
			}

			for at in 0..=bytes.len() - length {
				if length > 1 && !self.heads.contains(&head_of(bytes, at)) {
					continue;
				}

				let piece = &run[at..at + length];

				if self.words.remove(piece) {
					remaining.remove(piece);
				}
			}
		}
	}

	fn search(&mut self, text: &str, remaining: &mut FastSet<String>) {
		let bytes = text.as_bytes();
		let mut index = 0;

		// Once every such leaf has turned up, no run can take out another.
		while index < bytes.len() && !self.words.is_empty() {
			if !is_word_byte(bytes[index]) {
				index += 1;
				continue;
			}

			let start = index;

			while index < bytes.len() && is_word_byte(bytes[index]) {
				index += 1;
			}

			let run = &text[start..index];

			if self.seen_runs.insert(run.to_string()) {
				self.search_run(run, remaining);
			}
		}

		self.others.retain(|leaf| {
			if text.contains(leaf.as_str()) {
				remaining.remove(leaf);
				false
			} else {
				true
			}
		});
	}
}

/// Whether the byte before [at] ends a word, so a name that starts with a word
/// character matches only at the start of one, as `\b` asks.
fn starts_word(text: &[u8], at: usize) -> bool {
	at == 0 || !(text[at - 1].is_ascii_alphanumeric() || text[at - 1] == b'_')
}

/// Skips the characters `\s` matches from byte [at].
fn skip_spaces(text: &str, mut at: usize) -> usize {
	while let Some(character) = text[at..].chars().next() {
		if !is_space(character) {
			break;
		}

		at += character.len_utf8();
	}

	at
}

/// A quoted key starting at byte [at], as `(['"`])([^'"`\r\n]*)\1` reads it:
/// the key and the byte after its closing quote.
fn quoted_at(text: &str, at: usize) -> Option<(&str, usize)> {
	let bytes = text.as_bytes();
	let quote = *bytes.get(at)?;

	if !matches!(quote, b'\'' | b'"' | b'`') {
		return None;
	}

	let end = bytes[at + 1..]
		.iter()
		.position(|byte| matches!(byte, b'\'' | b'"' | b'`' | b'\r' | b'\n'))
		.map(|offset| at + 1 + offset)?;

	(bytes[end] == quote).then(|| (&text[at + 1..end], end + 1))
}

/// A translation call at byte [at]: one of [names], then `(` and a quoted key.
fn call_at<'a>(text: &'a str, at: usize, names: &[String]) -> Option<(&'a str, usize)> {
	let bytes = text.as_bytes();

	for name in names {
		let needs_boundary = name
			.as_bytes()
			.first()
			.is_some_and(|&byte| byte.is_ascii_alphanumeric() || byte == b'_');

		if !text[at..].starts_with(name.as_str()) || (needs_boundary && !starts_word(bytes, at)) {
			continue;
		}

		let open = skip_spaces(text, at + name.len());

		if bytes.get(open) != Some(&b'(') {
			continue;
		}

		if let Some(found) = quoted_at(text, skip_spaces(text, open + 1)) {
			return Some(found);
		}
	}

	None
}

/// An `i18nKey="key"` attribute at byte [at], as a `<Trans>` component writes it.
fn attribute_at(text: &str, at: usize) -> Option<(&str, usize)> {
	let bytes = text.as_bytes();

	if !text[at..].starts_with("i18nKey") || !starts_word(bytes, at) {
		return None;
	}

	let equals = skip_spaces(text, at + "i18nKey".len());

	if bytes.get(equals) != Some(&b'=') {
		return None;
	}

	let mut value = skip_spaces(text, equals + 1);

	if bytes.get(value) == Some(&b'{') {
		value = skip_spaces(text, value + 1);
	}

	quoted_at(text, value)
}

/// Looks for one way of asking for a key at a byte of a text.
type Finder<'n> = dyn Fn(&str, usize) -> Option<(&str, usize)> + 'n;

/// Every key the text asks for, by a translation call first and by an
/// `i18nKey` attribute after, the way the two patterns of the JavaScript
/// package find them. A key built at run time is left alone, and a namespace
/// written in front of a key is cut off.
fn calls_in(content: &str, names: &[String]) -> IndexSet<String, FastBuild> {
	let mut keys = IndexSet::default();
	let finders: [&Finder<'_>; 2] = [&|text, at| call_at(text, at, names), &|text, at| {
		attribute_at(text, at)
	}];

	for find in finders {
		let mut at = 0;

		while at < content.len() {
			if !content.is_char_boundary(at) {
				at += 1;
				continue;
			}

			match find(content, at) {
				Some((key, end)) => {
					if !key.is_empty() && !key.contains("${") {
						// `t('common:attr.folder')` names a namespace this comparison does
						// not have, and the key it wants is the part after it.
						let cut = key.find(':').map_or(0, |colon| colon + 1);

						keys.insert(key[cut..].to_string());
					}

					at = end;
				}
				None => at += 1,
			}
		}
	}

	keys
}

/// The last segment of a dotted key: `folder` for `attr.folder`.
fn last_segment_of(key: &str) -> &str {
	key.rfind('.').map_or(key, |dot| &key[dot + 1..])
}

/// Every way a defined key can be addressed: in full, by its plural base, and by
/// any run of segments that ends either. Every such address ends with the last
/// segment of the key it addresses, so the keys are filed under that segment.
struct Addresses {
	keys_by_last: FastMap<String, Vec<String>>,
}

impl Addresses {
	fn new(keys: &[String]) -> Addresses {
		let mut keys_by_last: FastMap<String, Vec<String>> = FastMap::default();
		let mut file = |key: &str| {
			keys_by_last
				.entry(last_segment_of(key).to_string())
				.or_default()
				.push(key.to_string());
		};

		for key in keys {
			file(key);

			// The source asks for `item`, never for `item_one`.
			if let Some(base) = plural_base_of(key) {
				file(base);
			}
		}

		Addresses { keys_by_last }
	}

	fn contains(&self, address: &str) -> bool {
		self.keys_by_last
			.get(last_segment_of(address))
			.is_some_and(|keys| {
				keys.iter().any(|key| {
					key == address
						|| (key.len() > address.len()
							&& key.ends_with(address)
							&& key.as_bytes()[key.len() - address.len() - 1] == b'.')
				})
			})
	}
}

/// The text of a source file, or `None` when it is too large to search or cannot
/// be read as text.
fn read_source(path: &str) -> Option<String> {
	let metadata = fs::metadata(path).ok()?;

	if metadata.len() > SOURCE_MAX_FILE_BYTES {
		return None;
	}

	let bytes = fs::read(path).ok()?;

	Some(crate::loader::walk::text_of(bytes))
}

/// How many source files are read before the ones read are searched.
const READ_BATCH: usize = 256;

/// The text of each file of [batch], read on as many threads as the machine
/// offers, in the order of [batch].
fn read_sources(batch: &[WalkedFile]) -> Vec<Option<String>> {
	let threads = std::thread::available_parallelism()
		.map_or(1, usize::from)
		.clamp(1, 8);
	let share = batch.len().div_ceil(threads).max(1);

	std::thread::scope(|scope| {
		let workers: Vec<_> = batch
			.chunks(share)
			.map(|part| {
				scope.spawn(move || {
					part.iter()
						.map(|file| read_source(&file.path))
						.collect::<Vec<_>>()
				})
			})
			.collect();

		workers
			.into_iter()
			.flat_map(|worker| worker.join().unwrap_or_default())
			.collect()
	})
}

/// Searches [source_path] for each key, and reports the ones never found and
/// the ones the source asks for that nothing defines.
///
/// [skip_files] are the project's own translation files: a key appears verbatim
/// in the file that defines it, so searching those would mark every key used.
pub fn find_unused_keys(
	source_path: &Path,
	keys: &[String],
	options: &ResolvedOptions,
	skip_files: &[String],
) -> UsageScan {
	// One leaf can belong to several keys (`a.name` and `b.name`), so the answer
	// is looked up per leaf and applied to every key that shares it.
	let mut keys_by_leaf: IndexMap<String, Vec<String>> = IndexMap::new();

	for key in keys {
		let leaf = leaf_of_key(key);

		if !leaf.is_empty() {
			keys_by_leaf
				.entry(leaf.to_string())
				.or_default()
				.push(key.clone());
		}
	}

	// Only worth reading every file for; the unused scan can stop as soon as the
	// last leaf turns up, and this one cannot.
	let wants_undefined = options.enabled_checks.contains(&CheckCode::UndefinedKey);
	let addresses = wants_undefined.then(|| Addresses::new(keys));
	let mut undefined_keys = Vec::new();
	let mut reported: FastSet<String> = FastSet::default();

	if keys_by_leaf.is_empty() && !wants_undefined {
		return UsageScan::default();
	}

	// Shrinks as leaves turn up, and the scan stops reading once it is empty. A
	// hash set, since a leaf is taken out of it every time one turns up; the order
	// the unused keys are reported in comes from `keys_by_leaf` instead.
	let mut remaining: FastSet<String> = keys_by_leaf.keys().cloned().collect();
	let mut search = LeafSearch::new(&remaining);
	let skip: FastSet<&String> = skip_files.iter().collect();
	let is_excluded_directory = create_path_excluder(&options.exclude);
	let is_excluded_file = create_file_excluder(&options.exclude_files);
	let mut scanned_file_count = 0;
	// The path excluder answers for a file too, because this walk has always let
	// `exclude` name one; `excludeFiles` is the pattern form of the same question.
	let is_wanted = |file: &WalkedFile| {
		let name = file.segments.last().map(String::as_str).unwrap_or("");

		is_scannable_name(name)
			&& !is_excluded_directory(&file.segments)
			&& !is_excluded_file(name)
			&& !skip.contains(&file.path)
	};

	// A folder that cannot be read degrades the scan rather than failing it.
	// Absolute from here on, so `skip_files` (which are absolute) compare equal and
	// an undefined key names the file it came from in full.
	let root = resolve_path(&source_path.to_string_lossy());

	let files: Vec<WalkedFile> = walk_files(&root, &is_excluded_directory, &is_wanted)
		.into_iter()
		.filter_map(|item| match item {
			WalkItem::File(file) => Some(file),
			WalkItem::Unreadable(_) => None,
		})
		.collect();

	// Read a batch at a time on several threads, then searched one file after
	// another in the order of the walk, which is what decides the file an
	// undefined key is reported against. A read spends most of its time waiting
	// on the file system, and waiting for one file at a time adds those waits up.
	'batches: for batch in files.chunks(READ_BATCH) {
		if remaining.is_empty() && !wants_undefined {
			break;
		}

		for (file, content) in batch.iter().zip(read_sources(batch)) {
			if remaining.is_empty() && !wants_undefined {
				break 'batches;
			}

			let Some(content) = content else {
				continue;
			};

			scanned_file_count += 1;

			if !remaining.is_empty() {
				search.search(&content, &mut remaining);
			}

			let Some(addresses) = &addresses else {
				continue;
			};

			for key in calls_in(&content, &options.translate_functions) {
				if addresses.contains(&key) || reported.contains(&key) {
					continue;
				}

				reported.insert(key.clone());
				undefined_keys.push(KeyUsage {
					key,
					file: Some(file.path.clone()),
				});
			}
		}
	}

	// In the order the leaves were first met, which is the order a JavaScript
	// `Set` keeps its remaining entries in.
	let unused_keys = keys_by_leaf
		.into_iter()
		.filter(|(leaf, _)| remaining.contains(leaf))
		.flat_map(|(_, keys)| keys)
		.collect();

	UsageScan {
		unused_keys,
		undefined_keys,
		scanned_file_count,
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	fn names() -> Vec<String> {
		["t", "$t", "translate"]
			.iter()
			.map(|name| name.to_string())
			.collect()
	}

	#[test]
	fn finds_the_calls_a_source_makes() {
		let found = calls_in(
			"t('a.b'); $t(\"c\"); translate( `d` ); xt('no'); i18n.t('e'); t('f\"); t(`${x}`); t('ns:g')",
			&names(),
		);

		assert_eq!(
			found.into_iter().collect::<Vec<_>>(),
			["a.b", "c", "d", "e", "g"]
		);
	}

	#[test]
	fn finds_a_trans_attribute() {
		let found = calls_in(
			r#"<Trans i18nKey="a.b" /> <Trans i18nKey={'c'} />"#,
			&names(),
		);

		assert_eq!(found.into_iter().collect::<Vec<_>>(), ["a.b", "c"]);
	}

	#[test]
	fn answers_addresses_by_whole_segments() {
		let keys: Vec<String> = ["menu.file.save", "top.list.place_ordinal_one"]
			.iter()
			.map(|key| key.to_string())
			.collect();
		let addresses = Addresses::new(&keys);

		for address in ["menu.file.save", "file.save", "save", "place", "list.place"] {
			assert!(addresses.contains(address), "{address}");
		}

		for address in ["le.save", ".save", "menu.file", "list.place_ordinal"] {
			assert!(!addresses.contains(address), "{address}");
		}
	}
}
