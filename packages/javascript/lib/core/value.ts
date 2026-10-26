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

/**
 * The zero of every set of decimal digits Unicode 17 defines, each followed by
 * the nine digits after it. A translation into Arabic, Hindi or Japanese often
 * writes its numbers in that language's own digits, and `٣` says the same as
 * `3`. Written out rather than read from the runtime: each package runs on a
 * different Unicode version, and the three must agree on what a digit is.
 */
const DIGIT_ZEROS = [
	0x30, 0x660, 0x6f0, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0xde6,
	0xe50, 0xed0, 0xf20, 0x1040, 0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0, 0x1a80, 0x1a90, 0x1b50,
	0x1bb0, 0x1c40, 0x1c50, 0xa620, 0xa8d0, 0xa900, 0xa9d0, 0xa9f0, 0xaa50, 0xabf0, 0xff10, 0x104a0,
	0x10d30, 0x10d40, 0x11066, 0x110f0, 0x11136, 0x111d0, 0x112f0, 0x11450, 0x114d0, 0x11650, 0x116c0,
	0x116d0, 0x116da, 0x11730, 0x118e0, 0x11950, 0x11bf0, 0x11c50, 0x11d50, 0x11da0, 0x11de0, 0x11f50,
	0x16130, 0x16a60, 0x16ac0, 0x16b50, 0x16d70, 0x1ccf0, 0x1d7ce, 0x1d7d8, 0x1d7e2, 0x1d7ec, 0x1d7f6,
	0x1e140, 0x1e2f0, 0x1e4f0, 0x1e5f1, 0x1e950, 0x1fbf0
];

const ASCII_DIGIT_PATTERN = /[0-9]/;

const ASCII_NUMBER_PATTERN = /[0-9]+/g;

/**
 * Anything at or past the first digit outside ASCII. A value without one, which
 * is every value in a Latin, Greek or Cyrillic script, can only hold ASCII
 * digits, and the regular expressions for those are the fastest way to them.
 */
const BEYOND_ASCII_DIGITS_PATTERN = /[^\u0000-\u065f]/;

/**
 * The value of a digit of any script, or `-1` for a character that is not one.
 * Read off the table rather than matched against a character class built from
 * it: a value is walked once either way, and the walk is several times faster.
 */
function digitValueOf(code: number): number {
	if (code >= 0x30 && code <= 0x39) {
		return code - 0x30;
	}

	if (code < DIGIT_ZEROS[1]) {
		return -1;
	}

	let low = 0;
	let high = DIGIT_ZEROS.length - 1;

	// The last zero at or below the character is the one its set would start from.
	while (low < high) {
		const middle = (low + high + 1) >> 1;

		if (DIGIT_ZEROS[middle] <= code) {
			low = middle;
		} else {
			high = middle - 1;
		}
	}

	const value = code - DIGIT_ZEROS[low];

	return value <= 9 ? value : -1;
}

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

/** Whether a value holds a digit of any script. */
export function hasDigit(value: string): boolean {
	if (ASCII_DIGIT_PATTERN.test(value)) {
		return true;
	}

	if (!BEYOND_ASCII_DIGITS_PATTERN.test(value)) {
		return false;
	}

	for (let index = 0; index < value.length; index += 1) {
		const code = value.codePointAt(index) ?? 0;

		if (digitValueOf(code) !== -1) {
			return true;
		}

		if (code > 0xffff) {
			index += 1;
		}
	}

	return false;
}

/**
 * Runs of digits a value carries, as they are written and as text so `03` and
 * `3` stay apart. A run may be written in any script's digits.
 */
export function extractNumbers(value: string): readonly string[] {
	if (!BEYOND_ASCII_DIGITS_PATTERN.test(value)) {
		return value.match(ASCII_NUMBER_PATTERN) ?? NOTHING;
	}

	let numbers: string[] | null = null;
	let start = -1;

	for (let index = 0; index <= value.length; index += 1) {
		const code = index < value.length ? (value.codePointAt(index) ?? 0) : -1;
		const isDigit = code !== -1 && digitValueOf(code) !== -1;

		if (isDigit && start === -1) {
			start = index;
		} else if (!isDigit && start !== -1) {
			(numbers ??= []).push(value.slice(start, index));
			start = -1;
		}

		if (code > 0xffff) {
			index += 1;
		}
	}

	return numbers ?? NOTHING;
}

/** A run of digits in ASCII, so `٠٣` and `03` compare equal. */
export function asciiDigitsOf(digits: string): string {
	if (!BEYOND_ASCII_DIGITS_PATTERN.test(digits)) {
		return digits;
	}

	let ascii = '';
	let changed = false;

	for (const char of digits) {
		const code = char.codePointAt(0) ?? 0;
		const value = digitValueOf(code);

		changed ||= code !== 0x30 + value;
		ascii += String.fromCharCode(0x30 + value);
	}

	return changed ? ascii : digits;
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
