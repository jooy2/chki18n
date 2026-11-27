//! A fast hash for the maps the analysis builds for itself.
//!
//! The standard library hashes with SipHash, which defends a map against keys
//! chosen to collide. The keys here are the translation keys and values of the
//! project being checked, which nobody picks to slow its own check down, and a
//! profile of a comparison spent a fifth of its time in SipHash. This is a
//! multiply and rotate over eight bytes at a time.

use std::collections::{HashMap, HashSet};
use std::hash::{BuildHasherDefault, Hasher};

use indexmap::IndexMap;

/// Folds each word into the state with a rotate, an exclusive or and a multiply
/// by a large odd constant, which spreads every input bit across the output.
#[derive(Clone, Copy, Debug, Default)]
pub struct FastHasher(u64);

const SEED: u64 = 0x51_7c_c1_b7_27_22_0a_95;

impl FastHasher {
	fn add(&mut self, word: u64) {
		self.0 = (self.0.rotate_left(5) ^ word).wrapping_mul(SEED);
	}
}

impl Hasher for FastHasher {
	fn write(&mut self, bytes: &[u8]) {
		let mut chunks = bytes.chunks_exact(8);

		for chunk in &mut chunks {
			let mut word = [0u8; 8];

			word.copy_from_slice(chunk);
			self.add(u64::from_le_bytes(word));
		}

		let rest = chunks.remainder();

		if !rest.is_empty() {
			let mut word = [0u8; 8];

			word[..rest.len()].copy_from_slice(rest);
			self.add(u64::from_le_bytes(word));
		}
	}

	fn write_u8(&mut self, byte: u8) {
		self.add(u64::from(byte));
	}

	fn write_usize(&mut self, value: usize) {
		self.add(value as u64);
	}

	fn finish(&self) -> u64 {
		self.0
	}
}

/// Builds a [FastHasher] for each map.
pub type FastBuild = BuildHasherDefault<FastHasher>;

/// A hash map on [FastHasher].
pub type FastMap<K, V> = HashMap<K, V, FastBuild>;

/// A hash set on [FastHasher].
pub type FastSet<K> = HashSet<K, FastBuild>;

/// An ordered map on [FastHasher].
pub type FastIndexMap<K, V> = IndexMap<K, V, FastBuild>;

#[cfg(test)]
mod tests {
	use super::*;
	use std::hash::Hash;

	fn hash_of(text: &str) -> u64 {
		let mut hasher = FastHasher::default();

		text.hash(&mut hasher);
		hasher.finish()
	}

	#[test]
	fn tells_near_keys_apart() {
		let keys = [
			"a",
			"b",
			"ab",
			"ba",
			"section1.group0.key1",
			"section1.group0.key2",
			"",
		];
		let hashes: FastSet<u64> = keys.iter().map(|key| hash_of(key)).collect();

		assert_eq!(hashes.len(), keys.len());
		assert_eq!(hash_of("same"), hash_of("same"));
	}
}
