/**
 * What a scan does not look at.
 *
 * Two questions, kept together because both are answered from a path alone:
 * whether a directory is one the walk should not enter, and whether a file is
 * one it should not read. Neither needs the file system, so the rules are the
 * same wherever they are applied — the directory scanner, the unused-key scan,
 * or a caller colouring a folder picker of its own.
 */

/** A path as forward-slash segments, with empty ones and `.` dropped. */
export function pathSegments(path: string): string[] {
	const segments: string[] = [];

	for (const segment of path.replace(/\\/g, '/').split('/')) {
		if (segment.length > 0 && segment !== '.') {
			segments.push(segment);
		}
	}

	return segments;
}

/**
 * Whether `name` matches `pattern`, where `*` stands for any run of characters
 * and everything else is literal. Case is ignored, because the file systems
 * these names come from mostly ignore it too.
 */
export function matchesNamePattern(name: string, pattern: string): boolean {
	const subject = name.toLowerCase();
	const parts = pattern.toLowerCase().split('*');

	if (parts.length === 1) {
		return subject === parts[0];
	}

	const first = parts[0];
	const last = parts[parts.length - 1];

	if (!subject.startsWith(first) || !subject.endsWith(last)) {
		return false;
	}

	let index = first.length;

	for (let position = 1; position < parts.length - 1; position += 1) {
		const part = parts[position];

		if (part.length < 1) {
			continue;
		}

		const found = subject.indexOf(part, index);

		if (found === -1) {
			return false;
		}

		index = found + part.length;
	}

	// The parts matched in order, but the first and the last may have claimed
	// the same characters: `ab` must not match `a*b*b`.
	return index + last.length <= subject.length;
}

/**
 * A test for the directories a walk should not enter, over the candidate's path
 * relative to the root, its own name last.
 *
 * An entry of one segment names a directory at any depth, which is what makes
 * `node_modules` mean every `node_modules` there is. An entry of more names a
 * path from the root, matching that directory and everything under it, which is
 * what lets a project exclude its own `src/legacy` without excluding a `legacy`
 * belonging to something else.
 */
export function createPathExcluder(
	entries: Iterable<string>
): (segments: readonly string[]) => boolean {
	const names = new Set<string>();
	const paths: string[][] = [];

	for (const entry of entries) {
		const segments = pathSegments(entry);

		if (segments.length === 1) {
			names.add(segments[0]);
		} else if (segments.length > 1) {
			paths.push(segments);
		}
	}

	return (segments) => {
		for (const segment of segments) {
			if (names.has(segment)) {
				return true;
			}
		}

		return paths.some(
			(path) =>
				path.length <= segments.length && path.every((segment, at) => segment === segments[at])
		);
	};
}

/** A test for the files a walk should not read, over the file's own name. */
export function createFileExcluder(patterns: Iterable<string>): (name: string) => boolean {
	const exact = new Set<string>();
	const globs: string[] = [];

	for (const pattern of patterns) {
		if (pattern.length < 1) {
			continue;
		}

		if (pattern.includes('*')) {
			globs.push(pattern);
		} else {
			exact.add(pattern.toLowerCase());
		}
	}

	return (name) => {
		const subject = name.toLowerCase();

		return exact.has(subject) || globs.some((pattern) => matchesNamePattern(subject, pattern));
	};
}
