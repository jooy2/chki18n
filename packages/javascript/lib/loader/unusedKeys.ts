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

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { CHECK_CODE, SOURCE_EXTENSIONS, SOURCE_MAX_FILE_BYTES } from '../constants.js';
import { createFileExcluder, createPathExcluder } from '../core/exclude.js';
import { pluralBaseOf } from '../core/plural.js';
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

const isScannableName = (name: string): boolean => {
	const dot = name.lastIndexOf('.');

	return dot > 0 && EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
};

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

	// Shrinks as leaves turn up. Searching only what is still missing is what
	// keeps this cheap: in a real project most keys are found in the first
	// handful of files, and every later file costs one search per remaining leaf.
	const remaining = new Set(keysByLeaf.keys());
	const skip = new Set(skipFiles);
	const isExcludedDirectory = createPathExcluder(options.exclude);
	const isExcludedFile = createFileExcluder(options.excludeFiles);
	let scannedFileCount = 0;

	const walk = async (directory: string, segments: string[]): Promise<void> => {
		if (remaining.size < 1 && !wantsUndefined) {
			return;
		}

		let entries;

		try {
			entries = await readdir(directory, { withFileTypes: true });
		} catch {
			// A folder that cannot be read should degrade the scan, not fail it.
			return;
		}

		for (const entry of entries) {
			if (remaining.size < 1 && !wantsUndefined) {
				return;
			}

			if (entry.name.startsWith('.')) {
				continue;
			}

			const path = join(directory, entry.name);

			if (entry.isDirectory()) {
				if (!isExcludedDirectory([...segments, entry.name])) {
					await walk(path, [...segments, entry.name]);
				}

				continue;
			}

			// The path excluder answers for a file too, because this walk has always
			// let `exclude` name one; `excludeFiles` is the pattern form of the
			// same question.
			if (
				!isScannableName(entry.name) ||
				isExcludedDirectory([...segments, entry.name]) ||
				isExcludedFile(entry.name) ||
				skip.has(path)
			) {
				continue;
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

			for (const leaf of remaining) {
				if (content.includes(leaf)) {
					remaining.delete(leaf);
				}
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
	};

	// Absolute from here on, so `skipFiles` (which are absolute) compare equal.
	await walk(resolve(sourcePath), []);

	const unusedKeys: string[] = [];

	for (const leaf of remaining) {
		unusedKeys.push(...(keysByLeaf.get(leaf) ?? []));
	}

	return { unusedKeys, undefinedKeys, scannedFileCount };
}
