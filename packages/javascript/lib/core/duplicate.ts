/**
 * Flattening nested translations into dotted keys, and the keys that end up
 * defined twice on the way.
 *
 * `{ "a": { "b": 1 }, "a.b": 2 }` flattens to `{ "a.b": 2 }`: two definitions
 * went in and one value came out, with nothing said about the one that lost.
 * The same happens to `{ "a": ["x"], "a.0": "y" }`. Both are easy to write by
 * hand and impossible to see afterwards, since by the time anything reads the
 * translations there is only one key left.
 *
 * One walk answers all three questions below, so the keys counted are exactly
 * the keys the comparison sees. An object or array with anything in it is
 * descended into; everything else, an empty object or array included, is a
 * leaf and keeps its value.
 */
import type { TranslationMap } from '../_types/global.js';

/** Whether flattening descends into a value: a plain object or an array with something in it. */
const isBranch = (value: unknown): value is Record<string, unknown> => {
	const tag = Object.prototype.toString.call(value);

	return (
		(tag === '[object Object]' || tag === '[object Array]') &&
		Object.keys(value as object).length > 0
	);
};

/** Every leaf below `translations`, with its flattened key, in the order the keys are reached. */
function walkLeaves(translations: unknown, visit: (key: string, value: unknown) => void): void {
	const walk = (value: unknown, path: string): void => {
		if (!isBranch(value)) {
			visit(path, value);
			return;
		}

		for (const key of Object.keys(value)) {
			walk(value[key], path ? `${path}.${key}` : key);
		}
	};

	if (isBranch(translations)) {
		for (const key of Object.keys(translations)) {
			walk(translations[key], key);
		}
	}
}

/**
 * Sets a key the way a parsed file holds it. A plain assignment of `__proto__`
 * would replace the object's prototype instead of adding a key, and the key
 * would be gone.
 */
function assign(map: TranslationMap, key: string, value: unknown): void {
	if (key === '__proto__') {
		Object.defineProperty(map, key, {
			value,
			enumerable: true,
			writable: true,
			configurable: true
		});
		return;
	}

	map[key] = value;
}

/**
 * The translations as the flat map the comparison works on, and the keys more
 * than one definition produced, in the order they are first reached. Where two
 * definitions produce one key the later one wins, as it does once the file is
 * read back.
 */
export function flattenWithDuplicates(translations: unknown): {
	translations: TranslationMap;
	duplicates: string[];
} {
	const flat: TranslationMap = {};
	let duplicates: string[] | null = null;

	walkLeaves(translations, (key, value) => {
		if (Object.hasOwn(flat, key) && !(duplicates ??= []).includes(key)) {
			duplicates.push(key);
		}

		assign(flat, key, value);
	});

	return { translations: flat, duplicates: duplicates ?? [] };
}

/** Nested translations as the dotted keys the comparison works on. */
export function flattenTranslations(translations: unknown): TranslationMap {
	return flattenWithDuplicates(translations).translations;
}

/** Every flattened key an object will produce, added to `into`. */
export function collectFlatKeys(translations: unknown, into: Set<string>): Set<string> {
	walkLeaves(translations, (key) => into.add(key));

	return into;
}

/**
 * Flattened keys that more than one definition produces, in the order they are
 * first reached, or an empty array for the overwhelmingly common case.
 */
export function findDuplicateKeys(translations: unknown): string[] {
	const seen = new Set<string>();
	let duplicates: string[] | null = null;

	walkLeaves(translations, (key) => {
		if (!seen.has(key)) {
			seen.add(key);
		} else if (!(duplicates ??= []).includes(key)) {
			duplicates.push(key);
		}
	});

	return duplicates ?? [];
}
