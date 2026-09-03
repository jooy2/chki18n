import type { CHECK_CODE, FILE_FORMAT, GROUP_BY, KEY_CASE, REPORTER } from '../constants.js';

export type AnyValueObject = { [key: string]: any };

/** A single check identifier (see `CHECK_CODE`). */
export type Chki18nCheckCode = (typeof CHECK_CODE)[keyof typeof CHECK_CODE];

/** Severity of a reported issue. `info` issues never fail a run. */
export type Chki18nLevel = 'error' | 'warn' | 'info';

/** On-disk layout of the translation files (see `FILE_FORMAT`). */
export type Chki18nFileFormat = (typeof FILE_FORMAT)[keyof typeof FILE_FORMAT];

/** Shape a finished result is rendered in (see `REPORTER`). */
export type Chki18nReporter = (typeof REPORTER)[keyof typeof REPORTER];

/** Axis a report groups its issues by (see `GROUP_BY`). */
export type Chki18nGroupBy = (typeof GROUP_BY)[keyof typeof GROUP_BY];

/** Case the segments of a translation key are written in (see `KEY_CASE`). */
export type Chki18nKeyCase = (typeof KEY_CASE)[keyof typeof KEY_CASE];

/**
 * Translation strings of one locale. Accepts both the nested shape read from a
 * file (`{ desc: { hello: 'Hi' } }`) and the flattened shape used internally
 * (`{ 'desc.hello': 'Hi' }`).
 */
export type TranslationMap = { [key: string]: any };

/** `group name -> locale -> strings`. A group is one comparable set of files. */
export type TranslationGroups = { [group: string]: { [locale: string]: TranslationMap } };

/** A translation file located by the scanner. */
export type Chki18nSourceFile = {
	path: string;
	relativePath: string;
	group: string;
	locale: string;
};

export type Chki18nIssue = {
	code: Chki18nCheckCode;
	level: Chki18nLevel;
	/** Locale the issue belongs to. Empty for issues that are not locale-bound. */
	locale: string;
	/** Flattened translation key. Empty for file/option level issues. */
	key: string;
	/** Group the key belongs to. `''` when the caller supplied a single set. */
	group: string;
	value?: string;
	targetValue?: string;
	/** Interpolation placeholder that triggered the issue. */
	interpolation?: string;
	/** The other key involved, e.g. the first key holding a duplicated value. */
	relatedKey?: string;
	/** Absolute path of the file the key came from, when known. */
	file?: string;
	/** Human readable, one line description of this specific occurrence. */
	message: string;
};

export type Chki18nLevelCount = { error: number; warn: number; info: number };

export type Chki18nSummary = Chki18nLevelCount & {
	total: number;
	byCode: Partial<Record<Chki18nCheckCode, number>>;
	byLocale: Record<string, Chki18nLevelCount>;
	byGroup: Record<string, Chki18nLevelCount>;
};

export type Chki18nResult = {
	/** `false` when at least one `error` level issue was found. */
	success: boolean;
	/** Every issue, in scan order. */
	issues: Chki18nIssue[];
	/** The same issues grouped by check code, for report style output. */
	issuesByCode: Partial<Record<Chki18nCheckCode, Chki18nIssue[]>>;
	summary: Chki18nSummary;
	/** Locale used as the comparison base. */
	target: string;
	/** Every locale that took part in the comparison. */
	locales: string[];
	/** Group names that took part in the comparison. */
	groups: string[];
	/** Number of distinct keys compared across all groups. */
	keyCount: number;
	/** Files read from disk. Empty when the input was supplied in memory. */
	files: Chki18nSourceFile[];
	/** Detected (or forced) on-disk layout. `null` for in-memory input. */
	fileFormat: Chki18nFileFormat | null;
	elapsedMs: number;
};

/**
 * Options shared by the CLI and the JavaScript API. Every CLI flag maps onto one
 * of these fields, so both entry points resolve through `resolveOptions`.
 */
export type Chki18nOptions = {
	/** Directory holding the translation files. */
	path?: string;
	/** Locale every other locale is compared against. Default `en`. */
	target?: string;
	/** Force an on-disk layout instead of detecting it. Default `auto`. */
	format?: Chki18nFileFormat;
	/** Only run these checks. Mutually exclusive with `ignoreChecks`. */
	checks?: Chki18nCheckCode[] | string[] | string;
	/** Run every check except these. */
	ignoreChecks?: Chki18nCheckCode[] | string[] | string;
	/**
	 * Report these checks at a different severity, e.g. `{ EMPTY_VALUE: 'error' }`
	 * to fail a run on an empty value. Also accepts the CLI's `CODE=level` list.
	 * Only comparison checks can be re-graded.
	 */
	levels?: Partial<Record<Chki18nCheckCode, Chki18nLevel>> | string[] | string;
	/** Opening delimiter of an interpolation placeholder. Default `{`. */
	interpolationPrefix?: string;
	/** Closing delimiter of an interpolation placeholder. Default `}`. */
	interpolationSuffix?: string;
	/** Directory names skipped while scanning. Replaces the default list. */
	exclude?: string[] | string;
	/**
	 * Directory of source files to search for key usages. Without it the
	 * `UNUSED_KEY` check has nothing to go on and reports nothing.
	 */
	source?: string;
	/**
	 * Case every segment of a key has to be written in, which is what the
	 * `KEY_NAMING` check compares against. Unset, that check reports nothing.
	 */
	keyCase?: Chki18nKeyCase;
	/**
	 * Levels a key may be nested, for the `KEY_DEPTH` check. `1` allows
	 * `folder`, `2` allows `attr.folder`. Unset, that check reports nothing.
	 */
	maxKeyDepth?: number | string;
	/**
	 * How many times longer or shorter than the target language a value may be
	 * before `SUSPICIOUS_LENGTH` reports it. `4` allows a quarter to four times.
	 * Unset, that check reports nothing.
	 */
	lengthRatio?: number | string;
	/** Treat the input as already flattened and skip the flatten pass. */
	flattened?: boolean;
	/** Shape the report is rendered in. Default `pretty`. */
	reporter?: Chki18nReporter;
	/** Axis the report groups its issues by. Default `locale`. */
	groupBy?: Chki18nGroupBy;
	/**
	 * Also write the report to this file. The extension picks the reporter —
	 * `.json` and `.md` have one of their own, anything else gets plain text —
	 * unless `reporter` names one, which always wins.
	 */
	output?: string;
	/** Colour the console report. Default `true` where the terminal allows it. */
	color?: boolean;
	/**
	 * Columns to lay the report out to. Defaults to the terminal's own width,
	 * then to `COLUMNS`, then to `DEFAULT_REPORT_WIDTH`.
	 */
	width?: number | string;
	/** Print progress and results to the console. Default `false`. */
	verbose?: boolean;
	/** Print info level log lines. Only meaningful with `verbose`. */
	info?: boolean;
	/** Print warn level log lines. Only meaningful with `verbose`. */
	warn?: boolean;
	/** Print debug log lines. */
	debug?: boolean;
};

/** Options after defaults, aliases and string forms have been resolved. */
export type Chki18nResolvedOptions = {
	path: string | null;
	target: string;
	format: Chki18nFileFormat;
	enabledChecks: Set<Chki18nCheckCode>;
	/** Severity overrides, or `null` when every check keeps its own. */
	levels: Partial<Record<Chki18nCheckCode, Chki18nLevel>> | null;
	interpolationPrefix: string;
	interpolationSuffix: string;
	exclude: Set<string>;
	source: string | null;
	keyCase: Chki18nKeyCase | null;
	maxKeyDepth: number | null;
	lengthRatio: number | null;
	reporter: Chki18nReporter;
	groupBy: Chki18nGroupBy;
	output: string | null;
	/** Reporter the `output` file gets. `null` when nothing is written. */
	outputReporter: Chki18nReporter | null;
	color: boolean;
	/** Columns asked for, or `null` to measure the terminal instead. */
	width: number | null;
	flattened: boolean;
	verbose: boolean;
	info: boolean;
	warn: boolean;
	debug: boolean;
};

/** Input accepted by `analyzeTranslations`. */
export type Chki18nInput = {
	/** Several comparable sets, e.g. one entry per translation file name. */
	groups?: TranslationGroups;
	/** A single set. Shorthand for `{ groups: { '': locales } }`. */
	locales?: { [locale: string]: TranslationMap };
	/** Maps a `group/locale` pair onto the file it was read from. */
	files?: Chki18nSourceFile[];
	/**
	 * Issues found while producing this input, e.g. a file that could not be
	 * parsed. They are reported alongside the comparison's own findings.
	 */
	issues?: Chki18nIssue[];
	/** Layout the input came from, carried through to the result. */
	fileFormat?: Chki18nFileFormat;
	/**
	 * Flattened keys nothing appears to reference, as `UNUSED_KEY` issues.
	 *
	 * Whether a key is used is a fact about the source tree rather than about
	 * the translations, so it is supplied rather than worked out here.
	 * `checkTranslationFiles` fills this in when given a `source` directory; an
	 * application that already knows can pass its own answer.
	 */
	unusedKeys?: string[];
};

/** One key of one group, as fed to the incremental `checkEntry`. */
export type Chki18nEntry = {
	key: string;
	/** `locale -> value`. The target locale's value is read from here too. */
	values: { [locale: string]: any };
	group?: string;
	/**
	 * Locales to compare. Defaults to the keys of `values`; pass it explicitly
	 * when a locale that owns no value still has to be reported as missing.
	 */
	locales?: string[];
};
