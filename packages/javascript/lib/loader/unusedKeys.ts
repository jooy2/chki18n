/**
 * Which translation keys nothing in the source tree appears to reference.
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
import { SOURCE_EXTENSIONS, SOURCE_MAX_FILE_BYTES } from '../constants.js';
import { pluralBaseOf } from '../core/plural.js';
import type { Chki18nResolvedOptions } from '../_types/global.js';

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
	/** How many files were actually read. */
	scannedFileCount: number;
};

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

	if (keysByLeaf.size < 1) {
		return { unusedKeys: [], scannedFileCount: 0 };
	}

	// Shrinks as leaves turn up. Searching only what is still missing is what
	// keeps this cheap: in a real project most keys are found in the first
	// handful of files, and every later file costs one search per remaining leaf.
	const remaining = new Set(keysByLeaf.keys());
	const skip = new Set(skipFiles);
	let scannedFileCount = 0;

	const walk = async (directory: string): Promise<void> => {
		if (remaining.size < 1) {
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
			if (remaining.size < 1) {
				return;
			}

			if (entry.name.startsWith('.') || options.exclude.has(entry.name)) {
				continue;
			}

			const path = join(directory, entry.name);

			if (entry.isDirectory()) {
				await walk(path);
				continue;
			}

			if (!isScannableName(entry.name) || skip.has(path)) {
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
		}
	};

	// Absolute from here on, so `skipFiles` (which are absolute) compare equal.
	await walk(resolve(sourcePath));

	const unusedKeys: string[] = [];

	for (const leaf of remaining) {
		unusedKeys.push(...(keysByLeaf.get(leaf) ?? []));
	}

	return { unusedKeys, scannedFileCount };
}
