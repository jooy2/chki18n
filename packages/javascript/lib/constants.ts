import type { Chki18nCheckCode, Chki18nLevel, Chki18nReporter } from './_types/global.js';

export const CHECK_CODE = {
	UNKNOWN: 'UNKNOWN',
	INVALID_OPTIONS: 'INVALID_OPTIONS',
	INVALID_FILE: 'INVALID_FILE',
	INVALID_VALUE_TYPE: 'INVALID_VALUE_TYPE',
	NO_LOCALE: 'NO_LOCALE',
	NO_KEY: 'NO_KEY',
	DUMMY_KEY: 'DUMMY_KEY',
	DUPLICATE_KEY: 'DUPLICATE_KEY',
	UNUSED_KEY: 'UNUSED_KEY',
	UNDEFINED_KEY: 'UNDEFINED_KEY',
	NO_PLURAL_FORM: 'NO_PLURAL_FORM',
	KEY_NAMING: 'KEY_NAMING',
	KEY_DEPTH: 'KEY_DEPTH',
	EMPTY_VALUE: 'EMPTY_VALUE',
	NO_INTERPOLATION_KEY: 'NO_INTERPOLATION_KEY',
	EXTRA_INTERPOLATION_KEY: 'EXTRA_INTERPOLATION_KEY',
	INTERPOLATION_COUNT: 'INTERPOLATION_COUNT',
	TAG_MISMATCH: 'TAG_MISMATCH',
	NOT_TRANSLATED_VALUE: 'NOT_TRANSLATED_VALUE',
	UNTRANSLATED_SCRIPT: 'UNTRANSLATED_SCRIPT',
	DUPLICATE_VALUE: 'DUPLICATE_VALUE',
	INCONSISTENT_VALUE: 'INCONSISTENT_VALUE',
	SURROUNDING_WHITESPACE: 'SURROUNDING_WHITESPACE',
	INVISIBLE_CHARACTER: 'INVISIBLE_CHARACTER',
	MISSING_NUMBER: 'MISSING_NUMBER',
	NUMBER_MISMATCH: 'NUMBER_MISMATCH',
	SUSPICIOUS_LENGTH: 'SUSPICIOUS_LENGTH'
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
	[CHECK_CODE.NO_LOCALE]: {
		level: 'error',
		summary: 'Some languages have no file in a group at all',
		description: 'This group holds no translations for the language, so none of its keys exist.'
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
	[CHECK_CODE.DUPLICATE_KEY]: {
		level: 'error',
		summary: 'Some keys are defined more than once',
		description: 'The key is defined twice, so one of its two values is silently lost.'
	},
	[CHECK_CODE.UNUSED_KEY]: {
		level: 'info',
		summary: 'The following keys were not found in the scanned source files',
		description: 'Nothing in the scanned sources appears to reference this key.'
	},
	[CHECK_CODE.KEY_NAMING]: {
		level: 'warn',
		summary: 'Some keys are not named the way the project asked',
		description: 'The key is not written in the case `keyCase` asks for.'
	},
	[CHECK_CODE.KEY_DEPTH]: {
		level: 'warn',
		summary: 'Some keys are nested deeper than the project allows',
		description: 'The key has more levels than `maxKeyDepth` allows.'
	},
	[CHECK_CODE.UNDEFINED_KEY]: {
		level: 'warn',
		summary: 'The scanned source files ask for keys nothing defines',
		description: 'The source calls for this key and no language file defines it.'
	},
	[CHECK_CODE.NO_PLURAL_FORM]: {
		level: 'warn',
		summary: 'Some keys are missing a plural form their language needs',
		description: 'The language needs a plural form of this key that the file does not define.'
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
	[CHECK_CODE.INTERPOLATION_COUNT]: {
		level: 'error',
		summary: 'Some values use an interpolation key a different number of times',
		description:
			'The value repeats an interpolation key more or fewer times than the target language.'
	},
	[CHECK_CODE.TAG_MISMATCH]: {
		level: 'warn',
		summary: 'Some values do not carry the same markup as the target language',
		description: 'The markup tags of this value are not the ones the target language uses.'
	},
	[CHECK_CODE.NOT_TRANSLATED_VALUE]: {
		level: 'warn',
		summary: 'Some keys have the same value as the target language',
		description:
			'The value is identical to the target language, so the translation may be incomplete.'
	},
	[CHECK_CODE.UNTRANSLATED_SCRIPT]: {
		level: 'warn',
		summary: 'Some values are not written in the script of their language',
		description: 'The value holds no character of the script this language is written in.'
	},
	[CHECK_CODE.DUPLICATE_VALUE]: {
		level: 'warn',
		summary: 'Some keys have duplicate values',
		description: 'Another key in the same locale already uses this value.'
	},
	[CHECK_CODE.INCONSISTENT_VALUE]: {
		level: 'warn',
		summary: 'Some keys with one shared original are translated differently',
		description: 'Another key with the same target language value is translated differently here.'
	},
	[CHECK_CODE.SURROUNDING_WHITESPACE]: {
		level: 'warn',
		summary: 'Some values begin or end with whitespace',
		description: 'The value has leading or trailing whitespace, which is usually accidental.'
	},
	[CHECK_CODE.INVISIBLE_CHARACTER]: {
		level: 'warn',
		summary: 'Some values hold a character nothing will draw',
		description: 'The value holds a zero width, bidirectional or non-breaking character.'
	},
	[CHECK_CODE.MISSING_NUMBER]: {
		level: 'warn',
		summary: 'Some values dropped a number the target language has',
		description: 'The target language value contains digits but this value does not.'
	},
	[CHECK_CODE.NUMBER_MISMATCH]: {
		level: 'warn',
		summary: 'Some values changed a number the target language has',
		description: 'The numbers in this value are not the ones the target language uses.'
	},
	[CHECK_CODE.SUSPICIOUS_LENGTH]: {
		level: 'info',
		summary: 'Some values are far longer or shorter than the target language',
		description: 'The value is further from the target language length than `lengthRatio` allows.'
	}
};

/**
 * Checks that compare translation data, in report order. `INVALID_*` and
 * `UNKNOWN` are excluded: they report how the run itself went and cannot be
 * switched off through `checks` / `ignoreChecks`.
 */
export const ANALYZE_CHECK_CODES: Chki18nCheckCode[] = [
	CHECK_CODE.INVALID_VALUE_TYPE,
	CHECK_CODE.NO_LOCALE,
	CHECK_CODE.NO_KEY,
	CHECK_CODE.DUMMY_KEY,
	CHECK_CODE.DUPLICATE_KEY,
	CHECK_CODE.UNUSED_KEY,
	CHECK_CODE.UNDEFINED_KEY,
	CHECK_CODE.NO_PLURAL_FORM,
	CHECK_CODE.KEY_NAMING,
	CHECK_CODE.KEY_DEPTH,
	CHECK_CODE.EMPTY_VALUE,
	CHECK_CODE.NO_INTERPOLATION_KEY,
	CHECK_CODE.EXTRA_INTERPOLATION_KEY,
	CHECK_CODE.INTERPOLATION_COUNT,
	CHECK_CODE.TAG_MISMATCH,
	CHECK_CODE.NOT_TRANSLATED_VALUE,
	CHECK_CODE.UNTRANSLATED_SCRIPT,
	CHECK_CODE.DUPLICATE_VALUE,
	CHECK_CODE.INCONSISTENT_VALUE,
	CHECK_CODE.SURROUNDING_WHITESPACE,
	CHECK_CODE.INVISIBLE_CHARACTER,
	CHECK_CODE.MISSING_NUMBER,
	CHECK_CODE.NUMBER_MISMATCH,
	CHECK_CODE.SUSPICIOUS_LENGTH
];

/**
 * Checks that need to see every key of a locale at once, so they cannot be
 * answered by `checkEntry`, which is handed one key at a time.
 */
export const CROSS_KEY_CHECK_CODES: Chki18nCheckCode[] = [
	CHECK_CODE.DUPLICATE_VALUE,
	// Two keys have to be seen together for one to be the other's disagreement,
	// and a language missing from a group is a fact about the whole group.
	CHECK_CODE.INCONSISTENT_VALUE,
	CHECK_CODE.NO_LOCALE,
	// A key can only be seen twice by looking at the whole file, and whether one
	// is referenced is a fact about the source tree rather than about the key.
	CHECK_CODE.DUPLICATE_KEY,
	CHECK_CODE.UNUSED_KEY,
	// Whether the source asks for a key is a fact about the source tree, and a
	// language needs every form of a plural key before any of them is right.
	CHECK_CODE.UNDEFINED_KEY,
	CHECK_CODE.NO_PLURAL_FORM
];

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

/** Case a project writes the segments of its translation keys in. */
export const KEY_CASE = {
	/** `attr-folder`. */
	KEBAB: 'kebab',
	/** `attrFolder`. */
	CAMEL: 'camel',
	/** `attr_folder`. */
	SNAKE: 'snake'
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

/**
 * Extensions the unused-key scan will read, as an allowlist rather than a
 * blocklist of binaries: an unknown binary decoded as UTF-8 could contain a
 * key's bytes by chance and wrongly mark it used, so anything unrecognised is
 * skipped.
 */
export const SOURCE_EXTENSIONS = [
	// Web and app source
	'js',
	'jsx',
	'mjs',
	'cjs',
	'ts',
	'tsx',
	'mts',
	'cts',
	'vue',
	'svelte',
	'astro',
	'html',
	'htm',
	'xml',
	'xhtml',
	'php',
	'rb',
	'py',
	'go',
	'rs',
	'java',
	'kt',
	'kts',
	'swift',
	'dart',
	'cs',
	'ex',
	'exs',
	// Styles and templates
	'css',
	'scss',
	'sass',
	'less',
	'styl',
	'hbs',
	'ejs',
	'pug',
	'twig',
	'erb',
	'liquid',
	// Data and docs that can carry a key
	'json',
	'jsonc',
	'json5',
	'yaml',
	'yml',
	'toml',
	'md',
	'mdx',
	'txt'
];

/**
 * Names a translation call goes by, for the `UNDEFINED_KEY` scan. `t('key')`
 * covers i18next, react-i18next and vue-i18n, including `i18n.t` and a `t`
 * bound by `useTranslation`, since a call is matched wherever the name ends.
 */
export const TRANSLATION_FUNCTIONS = ['t', '$t', 'translate'];

/** Files above this size are skipped by the unused-key scan. */
export const SOURCE_MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * How a finished result is rendered. The checks and the counts are the same
 * whichever one is chosen; only the shape of the text changes.
 */
export const REPORTER = {
	/** Grouped, coloured sections, meant to be read in a terminal. */
	PRETTY: 'pretty',
	/** One line per issue, for grepping and for editor integrations. */
	LIST: 'list',
	/** The whole result object, for another tool to parse. */
	JSON: 'json',
	/** Tables, for pasting into a pull request or a report. */
	MARKDOWN: 'markdown',
	/** Workflow commands, so GitHub Actions annotates the files themselves. */
	GITHUB: 'github'
} as const;

export const DEFAULT_REPORTER = REPORTER.PRETTY;

/** The axis a report groups its issues by. */
export const GROUP_BY = {
	/** One section per language. What a translator works through. */
	LOCALE: 'locale',
	/** One section per check code. What a maintainer fixes in one pass. */
	CODE: 'code',
	/** One section per comparable set of files. */
	GROUP: 'group',
	/** One section per translation file on disk. */
	FILE: 'file',
	/** No sections at all. */
	NONE: 'none'
} as const;

export const DEFAULT_GROUP_BY = GROUP_BY.LOCALE;

/**
 * The reporter an `output` file name implies. Anything not listed here is
 * treated as plain text and gets the default reporter without its colours.
 */
export const REPORTER_BY_EXTENSION: Record<string, Chki18nReporter> = {
	json: REPORTER.JSON,
	md: REPORTER.MARKDOWN,
	markdown: REPORTER.MARKDOWN
};

/** Width a report is laid out at when the terminal does not report its own. */
export const DEFAULT_REPORT_WIDTH = 96;

/**
 * Widest a report lays itself out to when the width was measured rather than
 * asked for. A very wide terminal would otherwise put the counts so far from
 * the labels that the two stop reading as one line. `width` overrides it.
 */
export const MAX_MEASURED_REPORT_WIDTH = 120;
