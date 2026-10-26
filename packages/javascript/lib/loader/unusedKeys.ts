/**
 * What the source tree says about the translation keys: which ones nothing
 * references, and which ones it asks for that nothing defines.
 *
 * The search is for a key's **leaf segment** — `desc.hello` is looked up as
 * `hello` — because code very often resolves a nested key by its last segment
 * alone, through a scoped `t('hello')` or a namespace bound higher up. Matching
 * the whole dotted key would report those as unused, and a check that cries
 * wolf on working code is worse than one that misses something.
 *
 * That trade also decides the severity: this can only ever be a hint, so
 * `UNUSED_KEY` is reported at `info` and never fails a run.
 */

import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CHECK_CODE, SOURCE_EXTENSIONS, SOURCE_MAX_FILE_BYTES } from '../constants.js';
import { createFileExcluder, createPathExcluder } from '../core/exclude.js';
import { pluralBaseOf } from '../core/plural.js';
import { extensionOf, walkFiles } from './walk.js';
import type { Chki18nKeyUsage, Chki18nResolvedOptions } from '../_types/global.js';

const EXTENSIONS = new Set(SOURCE_EXTENSIONS);

/**
 * `desc.hello` → `hello`, and `desc.item_one` → `item`.
 *
 * The plural suffix comes off because no source file writes it: the code asks
 * for `item` and the runtime picks the form. Searching for `item_one` would
 * report every plural key in the project as unused.
 */
export const leafOfKey = (key: string): string => {
	const index = key.lastIndexOf('.');
	const leaf = index === -1 ? key : key.slice(index + 1);

	return pluralBaseOf(leaf) ?? leaf;
};

const isScannableName = (name: string): boolean => EXTENSIONS.has(extensionOf(name));

/**
 * The characters a key segment is nearly always spelled with. Any occurrence of
 * a leaf spelled only with them sits inside one unbroken run of them, so the
 * runs of a file are all that has to be read to find it.
 */
const WORD_RUN_PATTERN = /[A-Za-z0-9_$-]+/g;

const WORD_ONLY_PATTERN = /^[A-Za-z0-9_$-]+$/;

/**
 * A search that takes out of `remaining` every leaf a text holds, as plain
 * substrings, the way `includes` would find them.
 *
 * Asking `includes` once per leaf per file costs the number of leaves times the
 * size of the tree: a thousand files and five thousand unused keys took sixteen
 * seconds. Instead each run of word characters is cut into the pieces as long
 * as some leaf is and looked up in a set, and a run met in an earlier file is
 * not cut again, since identifiers repeat from file to file. A leaf with any
 * other character in it is still found with `includes`.
 */
function createLeafSearch(remaining: Set<string>): (text: string) => void {
	const words = new Set<string>();
	const others = new Set<string>();

	for (const leaf of remaining) {
		(WORD_ONLY_PATTERN.test(leaf) ? words : others).add(leaf);
	}

	const lengths = [...new Set([...words].map((leaf) => leaf.length))].sort((a, b) => a - b);
	const seenRuns = new Set<string>();

	return (text) => {
		if (words.size > 0) {
			for (const [run] of text.matchAll(WORD_RUN_PATTERN)) {
				if (seenRuns.has(run)) {
					continue;
				}

				seenRuns.add(run);

				for (const length of lengths) {
					if (length > run.length) {
						break;
					}

					for (let at = 0; at + length <= run.length; at += 1) {
						const piece = run.slice(at, at + length);

						if (words.delete(piece)) {
							remaining.delete(piece);
						}
					}
				}
			}
		}

		for (const leaf of others) {
			if (text.includes(leaf)) {
				others.delete(leaf);
				remaining.delete(leaf);
			}
		}
	};
}

export type Chki18nUsageScan = {
	/** Keys whose leaf segment was found in no scanned file. */
	unusedKeys: string[];
	/** Keys the source asks for that no translation file defines. */
	undefinedKeys: Chki18nKeyUsage[];
	/** How many files were actually read. */
	scannedFileCount: number;
};

/** A key written as the first argument of a translation call, or as `i18nKey`. */
const CALL_PATTERNS = (names: string[]): RegExp[] => [
	new RegExp(
		`(?:${names.map((name) => `${/^\w/.test(name) ? '\\b' : ''}${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).join('|')})\\s*\\(\\s*(['"\`])([^'"\`\\r\\n]*)\\1`,
		'g'
	),
	/\bi18nKey\s*=\s*\{?\s*(['"`])([^'"`\r\n]*)\1/g
];

/**
 * Keys a file asks a translation function for. A template literal holding an
 * expression is skipped: the key is only known at run time, and guessing at it
 * would report a working call as broken.
 */
function callsIn(content: string, patterns: RegExp[]): Set<string> {
	const keys = new Set<string>();

	for (const pattern of patterns) {
		pattern.lastIndex = 0;

		let found = pattern.exec(content);

		while (found) {
			const key = found[2];

			if (key.length > 0 && !key.includes('${')) {
				// `t('common:attr.folder')` names a namespace this comparison does
				// not have, and the key it wants is the part after it.
				keys.add(key.slice(key.indexOf(':') + 1));
			}

			found = pattern.exec(content);
		}
	}

	return keys;
}

/**
 * Every way a defined key can be addressed: in full, by its plural base, and by
 * any run of segments that ends either. A `t` bound with a `keyPrefix`, or a namespace loaded higher up,
 * asks for `folder` rather than `attr.folder`, and reporting that as undefined
 * would cry wolf on working code — the same trade the unused scan makes.
 */
function addressesOf(keys: string[]): Set<string> {
	const addresses = new Set<string>();

	const add = (key: string) => {
		addresses.add(key);

		let separator = key.indexOf('.');

		while (separator !== -1) {
			addresses.add(key.slice(separator + 1));
			separator = key.indexOf('.', separator + 1);
		}
	};

	for (const key of keys) {
		add(key);

		// The source asks for `item`, never for `item_one`: the runtime picks the
		// form, so the base is an address of the key as much as the key is.
		const base = pluralBaseOf(key);

		if (base) {
			add(base);
		}
	}

	return addresses;
}

/**
 * Search `sourcePath` for each key, and report the ones never found.
 *
 * `skipFiles` are the project's own translation files: a key appears verbatim in
 * the file that defines it, so searching those would mark every key used and the
 * scan would never report anything.
 */
export async function findUnusedKeys(
	sourcePath: string,
	keys: string[],
	options: Chki18nResolvedOptions,
	skipFiles: Iterable<string> = []
): Promise<Chki18nUsageScan> {
	// One leaf can belong to several keys (`a.name` and `b.name`), so the answer
	// is looked up per leaf and applied to every key that shares it.
	const keysByLeaf = new Map<string, string[]>();

	for (const key of keys) {
		const leaf = leafOfKey(key);

		if (leaf.length > 0) {
			const bucket = keysByLeaf.get(leaf);

			if (bucket) {
				bucket.push(key);
			} else {
				keysByLeaf.set(leaf, [key]);
			}
		}
	}

	// Only worth reading every file for; the unused scan can stop as soon as the
	// last leaf turns up, and this one cannot.
	const wantsUndefined = options.enabledChecks.has(CHECK_CODE.UNDEFINED_KEY);
	const addresses = wantsUndefined ? addressesOf(keys) : null;
	const patterns = wantsUndefined ? CALL_PATTERNS(options.translateFunctions) : [];
	const undefinedKeys: Chki18nKeyUsage[] = [];
	const reported = new Set<string>();

	if (keysByLeaf.size < 1 && !wantsUndefined) {
		return { unusedKeys: [], undefinedKeys, scannedFileCount: 0 };
	}

	// Shrinks as leaves turn up, and the scan stops reading once it is empty.
	const remaining = new Set(keysByLeaf.keys());
	const searchLeaves = createLeafSearch(remaining);
	const skip = new Set(skipFiles);
	const isExcludedDirectory = createPathExcluder(options.exclude);
	const isExcludedFile = createFileExcluder(options.excludeFiles);
	let scannedFileCount = 0;

	// Absolute from here on, so `skipFiles` (which are absolute) compare equal.
	// There is no `onUnreadable`: a folder that cannot be read degrades the scan
	// rather than failing it.
	const walk = walkFiles(resolve(sourcePath), {
		isExcludedDirectory,
		// The path excluder answers for a file too, because this walk has always
		// let `exclude` name one; `excludeFiles` is the pattern form of the same
		// question.
		isWanted: ({ path, segments }) =>
			isScannableName(segments[segments.length - 1]) &&
			!isExcludedDirectory(segments) &&
			!isExcludedFile(segments[segments.length - 1]) &&
			!skip.has(path)
	});

	for await (const { path } of walk) {
		if (remaining.size < 1 && !wantsUndefined) {
			break;
		}

		let content: string;

		try {
			if ((await stat(path)).size > SOURCE_MAX_FILE_BYTES) {
				continue;
			}

			content = await readFile(path, { encoding: 'utf-8' });
		} catch {
			continue;
		}

		scannedFileCount += 1;

		if (remaining.size > 0) {
			searchLeaves(content);
		}

		if (!addresses) {
			continue;
		}

		for (const key of callsIn(content, patterns)) {
			if (addresses.has(key) || reported.has(key)) {
				continue;
			}

			reported.add(key);
			undefinedKeys.push({ key, file: path });
		}
	}

	const unusedKeys: string[] = [];

	for (const leaf of remaining) {
		unusedKeys.push(...(keysByLeaf.get(leaf) ?? []));
	}

	return { unusedKeys, undefinedKeys, scannedFileCount };
}
