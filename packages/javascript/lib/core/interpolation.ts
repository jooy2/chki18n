/** Shared empty result so the fast path never allocates. */
const NO_KEYS: readonly string[] = Object.freeze([]);

/**
 * A placeholder name is written by a developer, so it is spelled the way an
 * identifier is. Anything else between the delimiters is prose that happens to
 * sit between them, not a placeholder.
 */
const KEY_PATTERN = /^[A-Za-z0-9_$-]*$/;

/** Whether the character at `at` is escaped by an odd number of backslashes. */
function isEscaped(text: string, at: number): boolean {
	let count = 0;

	for (let index = at - 1; index >= 0 && text[index] === '\\'; index -= 1) {
		count += 1;
	}

	return count % 2 === 1;
}

/**
 * Whether `delimiter` starts at `at` as a delimiter rather than as text. An
 * escaped one is text, and so is a doubled one-character delimiter: `{{name}}`
 * holds no key as far as `{` and `}` are concerned, which is what makes
 * `interpolationPrefix: '{{'` a real setting rather than a formality.
 */
function isDelimiterAt(text: string, at: number, delimiter: string, single: boolean): boolean {
	if (!text.startsWith(delimiter, at) || isEscaped(text, at)) {
		return false;
	}

	return !single || (text[at - 1] !== delimiter && text[at + 1] !== delimiter);
}

/**
 * Interpolation keys used by a value, e.g. `['name']` for `Hello {name}`.
 *
 * This is the single most repeated operation of an analysis, so values that
 * cannot possibly hold a placeholder are rejected up front by one `indexOf`,
 * and the rest jump from one delimiter to the next rather than walking every
 * character. The two delimiters may differ in length, as `%{` and `}` do.
 */
export function extractInterpolationKeys(
	value: unknown,
	prefix: string,
	suffix: string
): readonly string[] {
	if (typeof value !== 'string' || value.length < prefix.length + suffix.length) {
		return NO_KEYS;
	}

	if (value.indexOf(prefix) === -1 || value.indexOf(suffix) === -1) {
		return NO_KEYS;
	}

	// One string cannot tell an opening delimiter from a closing one.
	if (!prefix || !suffix || prefix === suffix) {
		return NO_KEYS;
	}

	const single = prefix.length === 1 && suffix.length === 1;
	const keys: string[] = [];
	let at = value.indexOf(prefix);

	while (at !== -1) {
		if (!isDelimiterAt(value, at, prefix, single)) {
			at = value.indexOf(prefix, at + 1);
			continue;
		}

		const from = at + prefix.length;
		let close = value.indexOf(suffix, from);

		while (close !== -1 && !isDelimiterAt(value, close, suffix, single)) {
			close = value.indexOf(suffix, close + 1);
		}

		if (close === -1) {
			at = value.indexOf(prefix, at + 1);
			continue;
		}

		const key = value.slice(from, close);

		if (key.indexOf(prefix) === -1 && key.indexOf(suffix) === -1 && KEY_PATTERN.test(key)) {
			keys.push(key);
		}

		at = value.indexOf(prefix, close + suffix.length);
	}

	return keys;
}

/** An opening and closing delimiter pair, as `interpolationPrefix` takes them. */
export type Chki18nDelimiters = { prefix: string; suffix: string };

/**
 * The delimiter pairs `detectInterpolationDelimiters` knows, in the order it
 * believes them. A doubled pair comes before its single form, or `{{name}}`
 * would be read as `{` wrapped around `{name`.
 */
export const INTERPOLATION_DELIMITERS: readonly Chki18nDelimiters[] = [
	{ prefix: '{{', suffix: '}}' },
	{ prefix: '{', suffix: '}' },
	{ prefix: '[[', suffix: ']]' },
	{ prefix: '[', suffix: ']' },
	{ prefix: '((', suffix: '))' },
	{ prefix: '(', suffix: ')' },
	{ prefix: '<<', suffix: '>>' },
	{ prefix: '<', suffix: '>' }
];

/** The opening characters of every pair above, as one test per character. */
const isOpener = (character: string): boolean =>
	character === '{' || character === '[' || character === '(' || character === '<';

/**
 * Characters an interpolation key can start with, which is how a placeholder
 * name is spelled everywhere else in this library. Deliberately narrow: it is
 * what tells `{name}` apart from the `{"` of the JSON holding it, which is the
 * whole reason this can be pointed at a file's raw text.
 */
const isKeyStart = (character: string): boolean =>
	(character >= 'a' && character <= 'z') ||
	(character >= 'A' && character <= 'Z') ||
	(character >= '0' && character <= '9') ||
	character === '_' ||
	character === '$';

/**
 * Guess which delimiters a text writes its interpolation keys with, or `null`
 * when nothing in it looks like one.
 *
 * This is a suggestion to offer a user, not a decision to act on: a text that
 * uses none can only be guessed at, and one that mixes two answers with the
 * first pair of the list above that it holds. Reach for it when a project is
 * being set up and `interpolationPrefix` has nobody to ask.
 */
export function detectInterpolationDelimiters(text: string): Chki18nDelimiters | null {
	// One pass over the text, then the priority order is applied to what it saw.
	// Probing the candidates one at a time would read a large file eight times.
	const seen = new Set<string>();

	for (let at = 0; at < text.length; at += 1) {
		const open = text[at];

		if (!isOpener(open)) {
			continue;
		}

		let end = at + 1;

		while (text[end] === open) {
			end += 1;
		}

		let key = end;

		// `{{ name }}` is as common as `{{name}}`, and the space belongs to the
		// style rather than to the delimiter.
		while (text[key] === ' ') {
			key += 1;
		}

		if (key < text.length && isKeyStart(text[key])) {
			// A run of three or more is read as the doubled form, the way a run of
			// one is read as the single one.
			seen.add(end - at > 1 ? `${open}${open}` : open);

			// Nothing later in the text can outrank the first candidate, so a file
			// written in it is answered by its first placeholder.
			if (seen.has(INTERPOLATION_DELIMITERS[0].prefix)) {
				break;
			}
		}

		at = end - 1;
	}

	if (seen.size < 1) {
		return null;
	}

	return INTERPOLATION_DELIMITERS.find((candidate) => seen.has(candidate.prefix)) ?? null;
}
