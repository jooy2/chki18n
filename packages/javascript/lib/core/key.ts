import { CHECK_CODE, KEY_CASE } from '../constants.js';
import { createIssue } from './issue.js';
import type { Chki18nIssue, Chki18nKeyCase, Chki18nResolvedOptions } from '../_types/global.js';

/** The separator `flat` puts between the levels of a nested key. */
const SEGMENT_SEPARATOR = '.';

const SEGMENT_PATTERN: Record<Chki18nKeyCase, RegExp> = {
	[KEY_CASE.KEBAB]: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
	[KEY_CASE.CAMEL]: /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$/,
	[KEY_CASE.SNAKE]: /^[a-z0-9]+(?:_[a-z0-9]+)*$/
};

/**
 * What i18next appends to a key to pick a plural form or a context. These are
 * written with an underscore whatever case the project uses for its keys, so a
 * kebab-case project still writes `item-count_one`.
 */
const LIBRARY_SUFFIXES = new Set([
	'zero',
	'one',
	'two',
	'few',
	'many',
	'other',
	'plural',
	'ordinal',
	'interval',
	'male',
	'female'
]);

/** The segment without the plural or context suffix a library added to it. */
function withoutLibrarySuffix(segment: string, keyCase: Chki18nKeyCase): string {
	if (keyCase === KEY_CASE.SNAKE) {
		return segment;
	}

	const separator = segment.lastIndexOf('_');

	if (separator < 1 || !LIBRARY_SUFFIXES.has(segment.slice(separator + 1))) {
		return segment;
	}

	return segment.slice(0, separator);
}

/**
 * Check the shape of a key rather than what it translates to: the case its
 * segments are written in, and how deeply it is nested. Both are off until the
 * project says what it wants, because neither has a right answer on its own.
 *
 * Reported once per key rather than once per locale: a key is named the same
 * everywhere, so one badly named key is one finding, not one per language.
 */
export function checkKeyShape(
	issues: Chki18nIssue[],
	key: string,
	group: string,
	options: Chki18nResolvedOptions
): void {
	// Asked of every key of every group, so the case where the project has said
	// nothing costs nothing: not even splitting the key into its segments.
	if (!key || (options.maxKeyDepth === null && options.keyCase === null)) {
		return;
	}

	const segments = key.split(SEGMENT_SEPARATOR);

	if (
		options.maxKeyDepth !== null &&
		segments.length > options.maxKeyDepth &&
		options.enabledChecks.has(CHECK_CODE.KEY_DEPTH)
	) {
		issues.push(
			createIssue(CHECK_CODE.KEY_DEPTH, {
				key,
				group,
				message: `The key is ${segments.length} levels deep, and \`maxKeyDepth\` allows ${options.maxKeyDepth}.`
			})
		);
	}

	if (options.keyCase === null || !options.enabledChecks.has(CHECK_CODE.KEY_NAMING)) {
		return;
	}

	const pattern = SEGMENT_PATTERN[options.keyCase];

	for (const segment of segments) {
		if (pattern.test(withoutLibrarySuffix(segment, options.keyCase))) {
			continue;
		}

		issues.push(
			createIssue(CHECK_CODE.KEY_NAMING, {
				key,
				group,
				message:
					segments.length > 1
						? `The part \`${segment}\` is not written in ${options.keyCase} case.`
						: `The key is not written in ${options.keyCase} case.`
			})
		);

		// One finding per key. Naming a second bad segment of the same key adds
		// nothing to what has to be done about it.
		return;
	}
}
