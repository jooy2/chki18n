import type { Chki18nCheckCode, Chki18nLevel } from './_types/global.js';

export const CHECK_CODE = {
	UNKNOWN: 'UNKNOWN',
	INVALID_OPTIONS: 'INVALID_OPTIONS',
	INVALID_FILE: 'INVALID_FILE',
	INVALID_VALUE_TYPE: 'INVALID_VALUE_TYPE',
	NO_KEY: 'NO_KEY',
	DUMMY_KEY: 'DUMMY_KEY',
	EMPTY_VALUE: 'EMPTY_VALUE',
	NO_INTERPOLATION_KEY: 'NO_INTERPOLATION_KEY',
	EXTRA_INTERPOLATION_KEY: 'EXTRA_INTERPOLATION_KEY',
	NOT_TRANSLATED_VALUE: 'NOT_TRANSLATED_VALUE',
	DUPLICATE_VALUE: 'DUPLICATE_VALUE',
	SURROUNDING_WHITESPACE: 'SURROUNDING_WHITESPACE',
	MISSING_NUMBER: 'MISSING_NUMBER'
} as const;

/**
 * Everything a consumer needs to render a check without hard-coding strings:
 * its severity, a heading for a list of occurrences, and what it means.
 * `summary` is what the CLI prints above a group of issues.
 */
export const CHECK_META: Record<
	Chki18nCheckCode,
	{ level: Chki18nLevel; summary: string; description: string }
> = {
	[CHECK_CODE.UNKNOWN]: {
		level: 'error',
		summary: 'An unexpected problem occurred',
		description: 'Unknown error.'
	},
	[CHECK_CODE.INVALID_OPTIONS]: {
		level: 'warn',
		summary: 'Some options could not be used as given',
		description: 'The option value is missing or not usable.'
	},
	[CHECK_CODE.INVALID_FILE]: {
		level: 'error',
		summary: 'Some translation files could not be read',
		description: 'The file is missing, empty, unreadable or not valid JSON.'
	},
	[CHECK_CODE.INVALID_VALUE_TYPE]: {
		level: 'warn',
		summary: 'Some values are not translatable strings',
		description: 'The value is not a string, so it cannot be compared or translated.'
	},
	[CHECK_CODE.NO_KEY]: {
		level: 'error',
		summary: 'Some translation files did not include the following keys',
		description: 'The key exists in the target language but is missing here.'
	},
	[CHECK_CODE.DUMMY_KEY]: {
		level: 'warn',
		summary: 'The following keys do not exist in the target language',
		description: 'The key is missing from the target language, so it may be unused.'
	},
	[CHECK_CODE.EMPTY_VALUE]: {
		level: 'warn',
		summary: 'The value for the following items is empty',
		description: 'The key is defined but its value is an empty string.'
	},
	[CHECK_CODE.NO_INTERPOLATION_KEY]: {
		level: 'error',
		summary: 'The interpolation key does not match the target language',
		description: 'An interpolation key of the target language is missing from this value.'
	},
	[CHECK_CODE.EXTRA_INTERPOLATION_KEY]: {
		level: 'error',
		summary: 'Some values use interpolation keys the target language does not have',
		description: 'This value has an interpolation key that the target language does not define.'
	},
	[CHECK_CODE.NOT_TRANSLATED_VALUE]: {
		level: 'warn',
		summary: 'Some keys have the same value as the target language',
		description:
			'The value is identical to the target language, so the translation may be incomplete.'
	},
	[CHECK_CODE.DUPLICATE_VALUE]: {
		level: 'warn',
		summary: 'Some keys have duplicate values',
		description: 'Another key in the same locale already uses this value.'
	},
	[CHECK_CODE.SURROUNDING_WHITESPACE]: {
		level: 'warn',
		summary: 'Some values begin or end with whitespace',
		description: 'The value has leading or trailing whitespace, which is usually accidental.'
	},
	[CHECK_CODE.MISSING_NUMBER]: {
		level: 'warn',
		summary: 'Some values dropped a number the target language has',
		description: 'The target language value contains digits but this value does not.'
	}
};

/**
 * Checks that compare translation data, in report order. `INVALID_*` and
 * `UNKNOWN` are excluded: they report how the run itself went and cannot be
 * switched off through `checks` / `ignoreChecks`.
 */
export const ANALYZE_CHECK_CODES: Chki18nCheckCode[] = [
	CHECK_CODE.INVALID_VALUE_TYPE,
	CHECK_CODE.NO_KEY,
	CHECK_CODE.DUMMY_KEY,
	CHECK_CODE.EMPTY_VALUE,
	CHECK_CODE.NO_INTERPOLATION_KEY,
	CHECK_CODE.EXTRA_INTERPOLATION_KEY,
	CHECK_CODE.NOT_TRANSLATED_VALUE,
	CHECK_CODE.DUPLICATE_VALUE,
	CHECK_CODE.SURROUNDING_WHITESPACE,
	CHECK_CODE.MISSING_NUMBER
];

/**
 * Checks that need to see every key of a locale at once, so they cannot be
 * answered by `checkEntry`, which is handed one key at a time.
 */
export const CROSS_KEY_CHECK_CODES: Chki18nCheckCode[] = [CHECK_CODE.DUPLICATE_VALUE];

/** How translation files are laid out on disk. */
export const FILE_FORMAT = {
	/** Decide by looking at the scanned paths. */
	AUTO: 'auto',
	/** One file per locale: `en.json`, `ko.json`. */
	SINGLE: 'single',
	/** One folder per locale: `en/common.json`, `ko/common.json`. */
	FOLDER: 'folder',
	/** One file holding every locale at the top level: `{ "en": {...} }`. */
	NESTED: 'nested'
} as const;

export const DEFAULT_TARGET_LOCALE = 'en';

export const DEFAULT_INTERPOLATION_PREFIX = '{';

export const DEFAULT_INTERPOLATION_SUFFIX = '}';

/** Directory names never worth scanning for translation files. */
export const DEFAULT_EXCLUDE_DIRS = [
	'node_modules',
	'dist',
	'build',
	'out',
	'coverage',
	'.git',
	'.next',
	'.nuxt',
	'.svelte-kit',
	'.turbo',
	'.cache'
];

/** File extensions the scanner reads. */
export const SUPPORTED_EXTENSIONS = ['json'];
