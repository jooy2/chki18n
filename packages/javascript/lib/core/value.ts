/**
 * What a translation value can be measured on beyond its text: the markup it
 * carries, the numbers in it, the characters nothing will draw, and the script
 * it is written in. Kept apart from the analyzer so each one can be tested and
 * reused on its own.
 *
 * Every character class here is written as escapes rather than as the
 * characters themselves. Some of them are invisible, and a source file that
 * holds one is a source file nobody can review.
 */

/** Shared empty result so a value with nothing to find never allocates. */
const NOTHING: readonly string[] = Object.freeze([]);

/**
 * Markup tags, as they are written. The character after the `<` may not be a
 * space, so prose comparing two numbers is not mistaken for a tag.
 */
const TAG_PATTERN = /<\/?[^<>\s][^<>]*>/g;

const NUMBER_PATTERN = /\d+/g;

/**
 * Characters that take no space and are invisible in a review: zero width
 * joiners and spaces, the byte order mark, and the bidirectional controls a
 * copy out of a right-to-left editor leaves behind. The non-breaking space is
 * here too, because it looks exactly like the ordinary space it is not.
 */
const INVISIBLE_PATTERN = /[\u00a0\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/;

const NAMED_INVISIBLE: Record<string, string> = {
	'\u00a0': 'a non-breaking space',
	'\u200b': 'a zero width space',
	'\u200c': 'a zero width non-joiner',
	'\u200d': 'a zero width joiner',
	'\u200e': 'a left-to-right mark',
	'\u200f': 'a right-to-left mark',
	'\ufeff': 'a byte order mark'
};

const LETTER_PATTERN = /\p{L}/u;

const SCRIPT_CACHE = new Map<string, RegExp | null>();

/**
 * The script each language is written in, for the languages whose script says
 * something a comparison can act on. A language written in the Latin alphabet
 * is left out: there would be nothing to tell it apart from an English string
 * nobody translated.
 */
const SCRIPT_OF_LANGUAGE: Record<string, RegExp> = {
	am: /[\u1200-\u137f]/,
	ar: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/,
	be: /[\u0400-\u04ff]/,
	bg: /[\u0400-\u04ff]/,
	bn: /[\u0980-\u09ff]/,
	el: /[\u0370-\u03ff\u1f00-\u1fff]/,
	fa: /[\u0600-\u06ff\u0750-\u077f]/,
	he: /[\u0590-\u05ff]/,
	hi: /[\u0900-\u097f]/,
	hy: /[\u0530-\u058f]/,
	ja: /[\u3040-\u30ff\u31f0-\u31ff\u4e00-\u9fff]/,
	ka: /[\u10a0-\u10ff]/,
	kk: /[\u0400-\u04ff]/,
	km: /[\u1780-\u17ff]/,
	ko: /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/,
	ky: /[\u0400-\u04ff]/,
	lo: /[\u0e80-\u0eff]/,
	mk: /[\u0400-\u04ff]/,
	ml: /[\u0d00-\u0d7f]/,
	mn: /[\u0400-\u04ff]/,
	my: /[\u1000-\u109f]/,
	ne: /[\u0900-\u097f]/,
	ru: /[\u0400-\u04ff]/,
	si: /[\u0d80-\u0dff]/,
	ta: /[\u0b80-\u0bff]/,
	te: /[\u0c00-\u0c7f]/,
	th: /[\u0e00-\u0e7f]/,
	uk: /[\u0400-\u04ff]/,
	ur: /[\u0600-\u06ff\u0750-\u077f]/,
	zh: /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
};

/** Markup tags a value carries, in the order they appear. */
export function extractTags(value: string): readonly string[] {
	if (value.indexOf('<') === -1) {
		return NOTHING;
	}

	return value.match(TAG_PATTERN) ?? NOTHING;
}

/** Runs of digits a value carries, as text so `03` and `3` stay apart. */
export function extractNumbers(value: string): readonly string[] {
	return value.match(NUMBER_PATTERN) ?? NOTHING;
}

/** The first character in a value that nothing will draw, if there is one. */
export function findInvisibleCharacter(value: string): string | null {
	const found = INVISIBLE_PATTERN.exec(value);

	return found ? found[0] : null;
}

/** How to name an invisible character in a message, since it cannot be shown. */
export function nameOfInvisibleCharacter(char: string): string {
	const code = (char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0');

	return `${NAMED_INVISIBLE[char] ?? 'a bidirectional control'} (U+${code})`;
}

/**
 * The script a locale's translations are expected to be written in, or `null`
 * when the locale writes in the Latin alphabet, is not listed, or names a
 * script of its own — `sr-Latn` is Serbian written in Latin, and asking it for
 * Cyrillic would be wrong.
 */
export function scriptOfLocale(locale: string): RegExp | null {
	// Asked once per value of every locale, and the answer only ever depends on
	// the tag. A project has a handful of locales, so the cache stays tiny.
	const cached = SCRIPT_CACHE.get(locale);

	if (cached !== undefined) {
		return cached;
	}

	const parts = locale.toLowerCase().split(/[-_]/);
	const script = parts.includes('latn') ? null : (SCRIPT_OF_LANGUAGE[parts[0]] ?? null);

	SCRIPT_CACHE.set(locale, script);

	return script;
}

/**
 * Whether a value holds a word of its own, once the parts that are never
 * translated are taken out. A value that is only a placeholder, a tag or a
 * number cannot be judged on the script it is written in.
 */
export function hasTranslatableText(value: string, prefix: string, suffix: string): boolean {
	let text = value.replace(TAG_PATTERN, ' ');
	let start = text.indexOf(prefix);

	// A placeholder name is written by the developer and stays in English, so
	// leaving it in would let it answer for the whole value.
	while (start !== -1) {
		const end = text.indexOf(suffix, start + prefix.length);

		if (end === -1) {
			break;
		}

		text = `${text.slice(0, start)} ${text.slice(end + suffix.length)}`;
		start = text.indexOf(prefix);
	}

	return LETTER_PATTERN.test(text);
}
