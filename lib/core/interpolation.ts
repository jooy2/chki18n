import { getGroupKeys } from 'qsu';

/** Shared empty result so the fast path never allocates. */
const NO_KEYS: readonly string[] = Object.freeze([]);

/**
 * Interpolation keys used by a value, e.g. `['name']` for `Hello {name}`.
 *
 * `getGroupKeys` walks the string character by character, which is the single
 * most repeated operation of an analysis, so values that cannot possibly hold a
 * placeholder are rejected up front by one `indexOf`.
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

	return getGroupKeys(value, prefix, suffix);
}
