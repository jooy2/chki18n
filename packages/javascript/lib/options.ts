import {
	ANALYZE_CHECK_CODES,
	CHECK_CODE,
	DEFAULT_EXCLUDE_DIRS,
	DEFAULT_GROUP_BY,
	DEFAULT_INTERPOLATION_PREFIX,
	DEFAULT_INTERPOLATION_SUFFIX,
	DEFAULT_REPORTER,
	DEFAULT_TARGET_LOCALE,
	FILE_FORMAT,
	GROUP_BY,
	REPORTER
} from './constants.js';
import { createIssue } from './core/issue.js';
import type {
	AnyValueObject,
	Chki18nCheckCode,
	Chki18nFileFormat,
	Chki18nGroupBy,
	Chki18nIssue,
	Chki18nLevel,
	Chki18nOptions,
	Chki18nReporter,
	Chki18nResolvedOptions
} from './_types/global.js';

/**
 * The single definition of every option. The CLI builds its parser and its help
 * text from this table and the JavaScript API resolves the same fields, so a
 * flag and its option counterpart can never drift apart.
 */
export const OPTION_DEFINITIONS: {
	/** CLI flag, without the leading dashes. */
	flag: string;
	/** Field name on `Chki18nOptions`. */
	option: keyof Chki18nOptions;
	type: 'string' | 'boolean' | 'list';
	/** Placeholder shown in the usage text for value taking flags. */
	valueName?: string;
	description: string;
}[] = [
	{
		flag: 'path',
		option: 'path',
		type: 'string',
		valueName: '<dir>',
		description: 'The directory where the files to be scanned are located (required)'
	},
	{
		flag: 'target',
		option: 'target',
		type: 'string',
		valueName: '<locale>',
		description: `The language every other language is compared against (default: \`${DEFAULT_TARGET_LOCALE}\`)`
	},
	{
		flag: 'format',
		option: 'format',
		type: 'string',
		valueName: '<format>',
		description: 'Layout of the translation files: `auto`, `single`, `folder` or `nested`'
	},
	{
		flag: 'checks',
		option: 'checks',
		type: 'list',
		valueName: '<codes>',
		description: 'Run only these comma separated check codes'
	},
	{
		flag: 'ignore-checks',
		option: 'ignoreChecks',
		type: 'list',
		valueName: '<codes>',
		description: 'Run every check except these comma separated check codes'
	},
	{
		flag: 'levels',
		option: 'levels',
		type: 'list',
		valueName: '<code=level>',
		description: 'Report a check at another severity, e.g. `EMPTY_VALUE=error`'
	},
	{
		flag: 'interpolation-prefix',
		option: 'interpolationPrefix',
		type: 'string',
		valueName: '<str>',
		description: `Opening delimiter of an interpolation key (default: \`${DEFAULT_INTERPOLATION_PREFIX}\`)`
	},
	{
		flag: 'interpolation-suffix',
		option: 'interpolationSuffix',
		type: 'string',
		valueName: '<str>',
		description: `Closing delimiter of an interpolation key (default: \`${DEFAULT_INTERPOLATION_SUFFIX}\`)`
	},
	{
		flag: 'exclude',
		option: 'exclude',
		type: 'list',
		valueName: '<dirs>',
		description: 'Comma separated directory names to skip while scanning'
	},
	{
		flag: 'source',
		option: 'source',
		type: 'string',
		valueName: '<dir>',
		description: 'Search this directory of source files for key usages (enables `UNUSED_KEY`)'
	},
	{
		flag: 'reporter',
		option: 'reporter',
		type: 'string',
		valueName: '<name>',
		description: `How to render the report: \`${Object.values(REPORTER).join('`, `')}\``
	},
	{
		flag: 'group-by',
		option: 'groupBy',
		type: 'string',
		valueName: '<axis>',
		description: `Group the reported issues by \`${Object.values(GROUP_BY).join('`, `')}\``
	},
	{
		flag: 'no-color',
		option: 'color',
		type: 'boolean',
		description: 'Do not colour the output'
	},
	{
		flag: 'no-info',
		option: 'info',
		type: 'boolean',
		description: 'Do not show info messages'
	},
	{
		flag: 'no-warn',
		option: 'warn',
		type: 'boolean',
		description: 'Do not show warning messages'
	},
	{
		flag: 'debug',
		option: 'debug',
		type: 'boolean',
		description: 'Show debug messages'
	}
];

const toCamelCase = (str: string): string => str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** Accepts `['A','B']`, `'A,B'` and `'A B'` alike. */
const toList = (value: unknown): string[] => {
	if (Array.isArray(value)) {
		return value.flatMap((item) => toList(item));
	}

	if (typeof value !== 'string') {
		return [];
	}

	return value
		.split(/[,\s]+/)
		.map((item) => item.trim())
		.filter(Boolean);
};

const CHECK_CODE_VALUES = new Set<string>(Object.values(CHECK_CODE));

const LEVEL_VALUES = new Set<string>(['error', 'warn', 'info']);

const REPORTER_VALUES = new Set<string>(Object.values(REPORTER));

const GROUP_BY_VALUES = new Set<string>(Object.values(GROUP_BY));

/**
 * Read raw CLI arguments (as produced by minimist) into the option shape shared
 * with the JavaScript API. `--path` and a bare positional argument mean the
 * same thing, and negated booleans (`--no-warn`) arrive already inverted.
 */
export function argsToOptions(args: AnyValueObject): Chki18nOptions {
	const options: AnyValueObject = {};

	for (const definition of OPTION_DEFINITIONS) {
		// `--no-warn` is parsed as `warn: false`, so read the positive name.
		const flag = definition.flag.replace(/^no-/, '');
		const value = args[flag] ?? args[toCamelCase(flag)];

		if (value === undefined) {
			continue;
		}

		options[definition.option] = value;
	}

	if (!options.path && args._?.length) {
		options.path = String(args._[0]);
	}

	return options as Chki18nOptions;
}

/** Usage text for `--help`, generated from `OPTION_DEFINITIONS`. */
export function buildUsageText(binName: string): string {
	const lines = OPTION_DEFINITIONS.map((definition) => {
		const flag = `--${definition.flag}${definition.valueName ? ` ${definition.valueName}` : ''}`;

		return `  ${flag.padEnd(32)}${definition.description}`;
	});

	return [
		`Usage: \`${binName} [options]\` or \`${binName} [options] <targetDirectory>\``,
		'',
		'Options:',
		...lines,
		'  --help                          Show this message',
		'  --version                       Show the installed version',
		'',
		`Check codes: ${ANALYZE_CHECK_CODES.join(', ')}`
	].join('\n');
}

/**
 * Fill in defaults and normalise the loose forms an option may take, so that
 * everything downstream reads a single resolved shape. Anything unusable is
 * reported as an `INVALID_OPTIONS` issue instead of throwing: a typo in one
 * flag should not stop the rest of the scan.
 */
export function resolveOptions(
	options?: Chki18nOptions,
	defaults?: Partial<Chki18nOptions>
): { options: Chki18nResolvedOptions; issues: Chki18nIssue[] } {
	const raw: Chki18nOptions = { ...defaults, ...options };
	const issues: Chki18nIssue[] = [];

	const invalid = (message: string) =>
		issues.push(createIssue(CHECK_CODE.INVALID_OPTIONS, { message }));

	let target = raw.target;

	if (!target) {
		// Reported so a caller can see which language it ended up comparing
		// against, but at `info`: leaving `target` out is a default, not a fault.
		issues.push(
			createIssue(CHECK_CODE.INVALID_OPTIONS, {
				level: 'info',
				message: `No target language is specified. Defaulting to \`${DEFAULT_TARGET_LOCALE}\`.`
			})
		);
		target = DEFAULT_TARGET_LOCALE;
	}

	let format = (raw.format ?? FILE_FORMAT.AUTO) as Chki18nFileFormat;

	if (!Object.values(FILE_FORMAT).includes(format)) {
		invalid(`Unknown format \`${format}\`. Defaulting to \`${FILE_FORMAT.AUTO}\`.`);
		format = FILE_FORMAT.AUTO;
	}

	const readCheckCodes = (value: unknown, optionName: string): Chki18nCheckCode[] => {
		const codes: Chki18nCheckCode[] = [];

		for (const item of toList(value)) {
			const code = item.toUpperCase();

			if (!CHECK_CODE_VALUES.has(code)) {
				invalid(`Unknown check code \`${item}\` in \`${optionName}\` was ignored.`);
				continue;
			}

			codes.push(code as Chki18nCheckCode);
		}

		return codes;
	};

	const only = readCheckCodes(raw.checks, 'checks');
	const ignored = readCheckCodes(raw.ignoreChecks, 'ignoreChecks');
	let enabledChecks: Set<Chki18nCheckCode>;

	if (only.length > 0) {
		if (ignored.length > 0) {
			invalid('`checks` and `ignoreChecks` cannot be used together. `ignoreChecks` was ignored.');
		}

		enabledChecks = new Set(only);
	} else {
		enabledChecks = new Set(ANALYZE_CHECK_CODES);

		for (const code of ignored) {
			enabledChecks.delete(code);
		}
	}

	// `CODE=level` pairs from the CLI, or a plain object from the API.
	const levelEntries =
		raw.levels && !Array.isArray(raw.levels) && typeof raw.levels === 'object'
			? Object.entries(raw.levels).map(([code, level]) => `${code}=${level}`)
			: toList(raw.levels);
	let levels: Partial<Record<Chki18nCheckCode, Chki18nLevel>> | null = null;

	for (const entry of levelEntries) {
		const [rawCode, rawLevel] = entry.split('=');
		const code = rawCode?.trim().toUpperCase() as Chki18nCheckCode;
		const level = rawLevel?.trim().toLowerCase() as Chki18nLevel;

		if (!ANALYZE_CHECK_CODES.includes(code)) {
			invalid(`\`${rawCode}\` in \`levels\` is not a check whose severity can be changed.`);
			continue;
		}

		if (!LEVEL_VALUES.has(level)) {
			invalid(`\`${rawLevel}\` is not a level. Use \`error\`, \`warn\` or \`info\`.`);
			continue;
		}

		(levels ??= {})[code] = level;
	}

	const interpolationPrefix = raw.interpolationPrefix || DEFAULT_INTERPOLATION_PREFIX;
	const interpolationSuffix = raw.interpolationSuffix || DEFAULT_INTERPOLATION_SUFFIX;

	const excludeList = toList(raw.exclude);

	/** Reads one of the closed value sets, falling back rather than failing. */
	const readChoice = <T extends string>(
		value: unknown,
		allowed: Set<string>,
		fallback: T,
		optionName: string
	): T => {
		if (value === undefined || value === null || value === '') {
			return fallback;
		}

		const choice = String(value).trim().toLowerCase();

		if (!allowed.has(choice)) {
			invalid(`Unknown \`${optionName}\` value \`${value}\`. Defaulting to \`${fallback}\`.`);

			return fallback;
		}

		return choice as T;
	};

	const reporter = readChoice<Chki18nReporter>(
		raw.reporter,
		REPORTER_VALUES,
		DEFAULT_REPORTER,
		'reporter'
	);

	return {
		options: {
			path: raw.path || null,
			target,
			format,
			enabledChecks,
			levels,
			interpolationPrefix,
			interpolationSuffix,
			exclude: new Set(excludeList.length > 0 ? excludeList : DEFAULT_EXCLUDE_DIRS),
			source: raw.source || null,
			reporter,
			groupBy: readChoice<Chki18nGroupBy>(
				raw.groupBy,
				GROUP_BY_VALUES,
				DEFAULT_GROUP_BY,
				'groupBy'
			),
			color: raw.color !== false,
			flattened: raw.flattened === true,
			verbose: raw.verbose === true,
			info: raw.info !== false,
			warn: raw.warn !== false,
			debug: raw.debug === true
		},
		issues
	};
}
