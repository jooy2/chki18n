//! Which plural forms a language needs, and how a key names one.

/// A plural form a language may need.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum PluralCategory {
	Zero,
	One,
	Two,
	Few,
	Many,
	Other,
}

impl PluralCategory {
	/// `zero`, `one`, `two`, `few`, `many` or `other`.
	pub fn as_str(self) -> &'static str {
		match self {
			PluralCategory::Zero => "zero",
			PluralCategory::One => "one",
			PluralCategory::Two => "two",
			PluralCategory::Few => "few",
			PluralCategory::Many => "many",
			PluralCategory::Other => "other",
		}
	}

	/// The category a suffix names exactly, or `None`.
	pub fn parse(text: &str) -> Option<PluralCategory> {
		match text {
			"zero" => Some(PluralCategory::Zero),
			"one" => Some(PluralCategory::One),
			"two" => Some(PluralCategory::Two),
			"few" => Some(PluralCategory::Few),
			"many" => Some(PluralCategory::Many),
			"other" => Some(PluralCategory::Other),
			_ => None,
		}
	}
}

use PluralCategory::{Few, Many, One, Other, Two, Zero};

const ONLY_OTHER: &[PluralCategory] = &[Other];

const ONE_OTHER: &[PluralCategory] = &[One, Other];

const ORDINAL_INFIX: &str = "_ordinal";

const LEGACY_PLURAL_SUFFIX: &str = "plural";

/// The cardinal forms each language needs, by its language subtag.
const CATEGORIES_OF_LANGUAGE: &[(&str, &[PluralCategory])] = &[
	("af", ONE_OTHER),
	("am", ONE_OTHER),
	("ar", &[Zero, One, Two, Few, Many, Other]),
	("az", ONE_OTHER),
	("be", &[One, Few, Many, Other]),
	("bg", ONE_OTHER),
	("bn", ONE_OTHER),
	("bs", &[One, Few, Other]),
	("ca", ONE_OTHER),
	("cs", &[One, Few, Many, Other]),
	("cy", &[Zero, One, Two, Few, Many, Other]),
	("da", ONE_OTHER),
	("de", ONE_OTHER),
	("el", ONE_OTHER),
	("en", ONE_OTHER),
	("es", ONE_OTHER),
	("et", ONE_OTHER),
	("eu", ONE_OTHER),
	("fa", ONE_OTHER),
	("fi", ONE_OTHER),
	("fr", ONE_OTHER),
	("ga", &[One, Two, Few, Many, Other]),
	("gu", ONE_OTHER),
	("ha", ONE_OTHER),
	("hi", ONE_OTHER),
	("hr", &[One, Few, Other]),
	("hu", ONE_OTHER),
	("hy", ONE_OTHER),
	("id", ONLY_OTHER),
	("is", ONE_OTHER),
	("it", ONE_OTHER),
	("ja", ONLY_OTHER),
	("ka", ONE_OTHER),
	("kk", ONE_OTHER),
	("km", ONLY_OTHER),
	("kn", ONE_OTHER),
	("ko", ONLY_OTHER),
	("ky", ONE_OTHER),
	("lo", ONLY_OTHER),
	("lt", &[One, Few, Many, Other]),
	("lv", &[Zero, One, Other]),
	("ml", ONE_OTHER),
	("mn", ONE_OTHER),
	("mr", ONE_OTHER),
	("ms", ONLY_OTHER),
	("my", ONLY_OTHER),
	("nb", ONE_OTHER),
	("ne", ONE_OTHER),
	("nl", ONE_OTHER),
	("nn", ONE_OTHER),
	("no", ONE_OTHER),
	("pl", &[One, Few, Many, Other]),
	("pt", ONE_OTHER),
	("ro", &[One, Few, Other]),
	("ru", &[One, Few, Many, Other]),
	("si", ONE_OTHER),
	("sk", &[One, Few, Many, Other]),
	("sl", &[One, Two, Few, Other]),
	("sq", ONE_OTHER),
	("sr", &[One, Few, Other]),
	("sv", ONE_OTHER),
	("sw", ONE_OTHER),
	("ta", ONE_OTHER),
	("te", ONE_OTHER),
	("th", ONLY_OTHER),
	("tr", ONE_OTHER),
	("uk", &[One, Few, Many, Other]),
	("ur", ONE_OTHER),
	("uz", ONE_OTHER),
	("vi", ONLY_OTHER),
	("zh", ONLY_OTHER),
	("zu", ONE_OTHER),
];

/// A plural key cut into the key it is a form of and the form it names.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PluralParts<'a> {
	/// `item` for `item_one`.
	pub base: &'a str,
	/// `one` for `item_one`.
	pub category: PluralCategory,
}

/// The cardinal forms a locale's language needs, or `None` for a language the
/// table does not cover, which is never judged.
pub fn plural_categories_of(locale: &str) -> Option<&'static [PluralCategory]> {
	let lower = locale.to_lowercase();
	let language = lower.split(['-', '_']).next()?;

	CATEGORIES_OF_LANGUAGE
		.iter()
		.find(|(name, _)| *name == language)
		.map(|(_, forms)| *forms)
}

/// The base and the form of an i18next plural key such as `item_one`, or `None`
/// for a key that names no form.
pub fn plural_parts_of(key: &str) -> Option<PluralParts<'_>> {
	let separator = key.rfind('_')?;

	if separator < 1 {
		return None;
	}

	let category = PluralCategory::parse(&key[separator + 1..])?;

	Some(PluralParts {
		base: &key[..separator],
		category,
	})
}

/// Whether a base is that of an ordinal key: `place_ordinal` of
/// `place_ordinal_one`.
pub fn is_ordinal_base(base: &str) -> bool {
	base.len() > ORDINAL_INFIX.len() && base.ends_with(ORDINAL_INFIX)
}

/// The key the source asks for a plural key by: `item` for `item_one`,
/// `place` for `place_ordinal_one`, and `item` for the legacy `item_plural`.
pub fn plural_base_of(key: &str) -> Option<&str> {
	if let Some(parts) = plural_parts_of(key) {
		return Some(if is_ordinal_base(parts.base) {
			&parts.base[..parts.base.len() - ORDINAL_INFIX.len()]
		} else {
			parts.base
		});
	}

	let separator = key.rfind('_')?;

	(separator > 0 && &key[separator + 1..] == LEGACY_PLURAL_SUFFIX).then(|| &key[..separator])
}

/// Whether a locale uses a cardinal form. A language the table does not cover
/// is assumed to use every form, so it is never judged.
pub fn uses_plural_category(locale: &str, category: PluralCategory) -> bool {
	plural_categories_of(locale).is_none_or(|categories| categories.contains(&category))
}

/// Whether a locale uses the form a plural key names. An ordinal key is only
/// ever required in `other`.
pub fn uses_plural_form(locale: &str, parts: &PluralParts<'_>) -> bool {
	if is_ordinal_base(parts.base) {
		parts.category == PluralCategory::Other
	} else {
		uses_plural_category(locale, parts.category)
	}
}

/// The forms a locale needs of one base, or `None` for a language the table
/// does not cover.
pub fn plural_forms_needed(locale: &str, base: &str) -> Option<&'static [PluralCategory]> {
	let categories = plural_categories_of(locale)?;

	Some(if is_ordinal_base(base) {
		ONLY_OTHER
	} else {
		categories
	})
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn reads_the_form_a_suffixed_key_names() {
		assert_eq!(
			plural_parts_of("item_one"),
			Some(PluralParts {
				base: "item",
				category: PluralCategory::One
			})
		);
		assert_eq!(plural_parts_of("_one"), None);
		assert_eq!(plural_parts_of("item_ones"), None);
		assert_eq!(plural_base_of("place_ordinal_one"), Some("place"));
		assert_eq!(plural_base_of("item_plural"), Some("item"));
		assert_eq!(plural_base_of("item"), None);
	}

	#[test]
	fn knows_which_forms_a_language_needs() {
		assert_eq!(plural_categories_of("ko-KR"), Some(ONLY_OTHER));
		assert!(uses_plural_category("xx", PluralCategory::Few));
		assert!(!uses_plural_category("en", PluralCategory::Few));
		assert_eq!(plural_forms_needed("ru", "place_ordinal"), Some(ONLY_OTHER));
	}
}
