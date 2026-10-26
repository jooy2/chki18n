import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { compareText } from '../core/order.js';

/** A file a walk reached. */
export type WalkedFile = {
	path: string;
	/** Path segments relative to the walk's root, file name last. */
	segments: string[];
};

export type WalkOptions = {
	/** Whether to stay out of a directory, given its segments from the root. */
	isExcludedDirectory: (segments: readonly string[]) => boolean;
	/** Whether a file is one the walk hands out. */
	isWanted: (file: WalkedFile) => boolean;
	/** Told about a directory that could not be listed, the root included. */
	onUnreadable?: (directory: string) => void;
};

/**
 * Every wanted file below `root`, depth first and in name order.
 *
 * `readdir` answers in whatever order the file system keeps, so sorting is what
 * makes two walks of one tree, on two machines or in two packages, meet its
 * files in the same order. Hidden entries are tooling state and are never
 * entered, and a symbolic link to a directory is not followed: one that points
 * back up the tree would never end.
 */
export async function* walkFiles(
	root: string,
	options: WalkOptions
): AsyncGenerator<WalkedFile, void, undefined> {
	const walk = async function* (
		directory: string,
		segments: string[]
	): AsyncGenerator<WalkedFile, void, undefined> {
		let entries;

		try {
			entries = await readdir(directory, { withFileTypes: true });
		} catch {
			options.onUnreadable?.(directory);
			return;
		}

		entries.sort((a, b) => compareText(a.name, b.name));

		for (const entry of entries) {
			if (entry.name.startsWith('.')) {
				continue;
			}

			const path = join(directory, entry.name);
			const entrySegments = [...segments, entry.name];

			if (entry.isDirectory()) {
				if (!options.isExcludedDirectory(entrySegments)) {
					yield* walk(path, entrySegments);
				}

				continue;
			}

			const file = { path, segments: entrySegments };

			if (options.isWanted(file)) {
				yield file;
			}
		}
	};

	yield* walk(root, []);
}

/** The extension of a file name, lower cased, or `''` for a name without one. */
export function extensionOf(name: string): string {
	const dot = name.lastIndexOf('.');

	// `.gitignore` is a name that begins with a dot, not a file of that type.
	return dot < 1 ? '' : name.slice(dot + 1).toLowerCase();
}
