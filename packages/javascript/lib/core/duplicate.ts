/**
 * Keys that end up defined twice, which flattening then silently resolves.
 *
 * `{ "a": { "b": 1 }, "a.b": 2 }` flattens to `{ "a.b": 2 }`: two definitions
 * went in and one value came out, with nothing said about the one that lost.
 * The same happens to `{ "a": ["x"], "a.0": "y" }`. Both are easy to write by
 * hand and impossible to see afterwards, since by the time anything reads the
 * translations there is only one key left.
 *
 * The walk mirrors what `flat` does — an object or array with anything in it is
 * descended into, everything else (including an empty object or array) is a
 * leaf — so the paths counted here are exactly the keys that will exist.
 */

const isBranch = (value: unknown): boolean =>
	value !== null && typeof value === 'object' && Object.keys(value as object).length > 0;

/** Every flattened key an object will produce, added to `into`. */
export function collectFlatKeys(translations: unknown, into: Set<string>): Set<string> {
	const walk = (value: unknown, path: string): void => {
		if (isBranch(value)) {
			for (const key of Object.keys(value as object)) {
				walk((value as Record<string, unknown>)[key], path ? `${path}.${key}` : key);
			}

			return;
		}

		if (path) {
			into.add(path);
		}
	};

	walk(translations, '');

	return into;
}

/**
 * Flattened keys that more than one definition produces, in the order they are
 * first reached. Returns an empty array for the overwhelmingly common case, and
 * allocates nothing while doing so.
 */
export function findDuplicateKeys(translations: unknown): string[] {
	if (!isBranch(translations)) {
		return [];
	}

	const seen = new Set<string>();
	let duplicates: string[] | null = null;

	const walk = (value: unknown, path: string): void => {
		if (isBranch(value)) {
			for (const key of Object.keys(value as object)) {
				walk((value as Record<string, unknown>)[key], path ? `${path}.${key}` : key);
			}

			return;
		}

		if (seen.has(path)) {
			if (!duplicates) {
				duplicates = [];
			}

			if (!duplicates.includes(path)) {
				duplicates.push(path);
			}

			return;
		}

		seen.add(path);
	};

	walk(translations, '');

	return duplicates ?? [];
}
