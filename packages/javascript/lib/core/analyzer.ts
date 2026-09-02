import { flatten } from 'flat';
import { CHECK_CODE } from '../constants.js';
import { resolveOptions } from '../options.js';
import { extractInterpolationKeys } from './interpolation.js';
import { applyLevelOverrides, createIssue } from './issue.js';
import { buildResult } from './result.js';
import type {
	Chki18nCheckCode,
	Chki18nEntry,
	Chki18nInput,
	Chki18nIssue,
	Chki18nOptions,
	Chki18nResolvedOptions,
	Chki18nResult,
	Chki18nSourceFile,
	TranslationGroups,
	TranslationMap
} from '../_types/global.js';

const DIGIT_PATTERN = /\d/;

const SURROUNDING_WHITESPACE_PATTERN = /^\s|\s$/;

const NO_KEYS: readonly string[] = Object.freeze([]);

/**
 * Whether each comparison check is enabled, resolved once instead of asking the
 * enabled-set again for every key of every locale.
 */
type CheckFlags = {
	invalidValueType: boolean;
	noKey: boolean;
	dummyKey: boolean;
	emptyValue: boolean;
	noInterpolationKey: boolean;
	extraInterpolationKey: boolean;
	notTranslatedValue: boolean;
	duplicateValue: boolean;
	surroundingWhitespace: boolean;
	missingNumber: boolean;
};

type FileLookup = ((group: string, locale: string) => string | undefined) | null;

const buildCheckFlags = (enabled: Set<Chki18nCheckCode>): CheckFlags => ({
	invalidValueType: enabled.has(CHECK_CODE.INVALID_VALUE_TYPE),
	noKey: enabled.has(CHECK_CODE.NO_KEY),
	dummyKey: enabled.has(CHECK_CODE.DUMMY_KEY),
	emptyValue: enabled.has(CHECK_CODE.EMPTY_VALUE),
	noInterpolationKey: enabled.has(CHECK_CODE.NO_INTERPOLATION_KEY),
	extraInterpolationKey: enabled.has(CHECK_CODE.EXTRA_INTERPOLATION_KEY),
	notTranslatedValue: enabled.has(CHECK_CODE.NOT_TRANSLATED_VALUE),
	duplicateValue: enabled.has(CHECK_CODE.DUPLICATE_VALUE),
	surroundingWhitespace: enabled.has(CHECK_CODE.SURROUNDING_WHITESPACE),
	missingNumber: enabled.has(CHECK_CODE.MISSING_NUMBER)
});

/** Values are reported as text, whatever their original type was. */
const asDisplayValue = (value: unknown): string | undefined => {
	if (value === undefined) {
		return undefined;
	}

	return typeof value === 'string' ? value : String(value);
};

const buildFileLookup = (files?: Chki18nSourceFile[]): FileLookup => {
	if (!files || files.length < 1) {
		return null;
	}

	const paths = new Map<string, string>();

	for (const file of files) {
		paths.set(`${file.group} ${file.locale}`, file.path);
	}

	return (group, locale) => paths.get(`${group} ${locale}`);
};

/**
 * Compare one key across every locale.
 *
 * Locales are addressed by index into three parallel arrays rather than by one
 * object per key: a full analysis calls this once per key per group, so the
 * caller can refill the same arrays instead of allocating on every iteration.
 */
function checkKeySlots(
	issues: Chki18nIssue[],
	key: string,
	group: string,
	localeNames: string[],
	values: unknown[],
	present: boolean[],
	targetIndex: number,
	flags: CheckFlags,
	options: Chki18nResolvedOptions,
	fileOf: FileLookup
): void {
	const hasTargetKey = targetIndex !== -1 && present[targetIndex];
	const targetValue = hasTargetKey ? values[targetIndex] : undefined;
	const targetIsString = typeof targetValue === 'string';
	const targetText = asDisplayValue(targetValue);
	const targetInterpolations = targetIsString
		? extractInterpolationKeys(
				targetValue,
				options.interpolationPrefix,
				options.interpolationSuffix
			)
		: NO_KEYS;
	const targetHasDigit = targetIsString && DIGIT_PATTERN.test(targetValue as string);
	const checkInterpolation = flags.noInterpolationKey || flags.extraInterpolationKey;

	for (let index = 0; index < localeNames.length; index += 1) {
		if (index === targetIndex) {
			continue;
		}

		const locale = localeNames[index];
		const value = values[index];
		const file = fileOf ? fileOf(group, locale) : undefined;
		const base = { locale, key, group, file, targetValue: targetText };

		if (!present[index]) {
			if (hasTargetKey && flags.noKey) {
				issues.push(createIssue(CHECK_CODE.NO_KEY, base));
			}

			continue;
		}

		const text = asDisplayValue(value);

		if (!hasTargetKey && flags.dummyKey) {
			issues.push(createIssue(CHECK_CODE.DUMMY_KEY, { ...base, value: text }));
		}

		if (typeof value !== 'string') {
			if (flags.invalidValueType) {
				issues.push(
					createIssue(CHECK_CODE.INVALID_VALUE_TYPE, {
						...base,
						value: text,
						message: `The value is ${value === null ? '`null`' : `a \`${typeof value}\``}, not a translatable string.`
					})
				);
			}

			continue;
		}

		if (value.length < 1) {
			if (flags.emptyValue) {
				issues.push(createIssue(CHECK_CODE.EMPTY_VALUE, { ...base, value }));
			}

			continue;
		}

		if (flags.surroundingWhitespace && SURROUNDING_WHITESPACE_PATTERN.test(value)) {
			issues.push(createIssue(CHECK_CODE.SURROUNDING_WHITESPACE, { ...base, value }));
		}

		if (targetIsString) {
			if (flags.notTranslatedValue && value === targetValue) {
				issues.push(createIssue(CHECK_CODE.NOT_TRANSLATED_VALUE, { ...base, value }));
			}

			if (flags.missingNumber && targetHasDigit && !DIGIT_PATTERN.test(value)) {
				issues.push(createIssue(CHECK_CODE.MISSING_NUMBER, { ...base, value }));
			}
		}

		if (!hasTargetKey || !checkInterpolation) {
			continue;
		}

		const currentInterpolations = extractInterpolationKeys(
			value,
			options.interpolationPrefix,
			options.interpolationSuffix
		);

		if (flags.noInterpolationKey) {
			for (const interpolation of targetInterpolations) {
				if (currentInterpolations.includes(interpolation)) {
					continue;
				}

				issues.push(
					createIssue(CHECK_CODE.NO_INTERPOLATION_KEY, {
						...base,
						value,
						interpolation,
						message: `The interpolation key \`${options.interpolationPrefix}${interpolation}${options.interpolationSuffix}\` of the target language is missing from this value.`
					})
				);
			}
		}

		if (flags.extraInterpolationKey) {
			for (const interpolation of currentInterpolations) {
				if (targetInterpolations.includes(interpolation)) {
					continue;
				}

				issues.push(
					createIssue(CHECK_CODE.EXTRA_INTERPOLATION_KEY, {
						...base,
						value,
						interpolation,
						message: `The interpolation key \`${options.interpolationPrefix}${interpolation}${options.interpolationSuffix}\` is not defined by the target language.`
					})
				);
			}
		}
	}
}

/**
 * Report keys of one locale that repeat a value another key already uses. This
 * is the one check that has to see a whole locale at once, so it cannot live in
 * `checkKeySlots`. A `Map` keyed by the value keeps it linear.
 */
function checkDuplicateValues(
	issues: Chki18nIssue[],
	group: string,
	localeNames: string[],
	maps: TranslationMap[],
	targetIndex: number,
	fileOf: FileLookup
): void {
	for (let index = 0; index < localeNames.length; index += 1) {
		const locale = localeNames[index];
		const map = maps[index];
		const firstKeyOfValue = new Map<string, string>();

		for (const key of Object.keys(map)) {
			const value = map[key];

			if (typeof value !== 'string' || value.length < 1) {
				continue;
			}

			const firstKey = firstKeyOfValue.get(value);

			if (firstKey === undefined) {
				firstKeyOfValue.set(value, key);
				continue;
			}

			issues.push(
				createIssue(CHECK_CODE.DUPLICATE_VALUE, {
					locale,
					key,
					group,
					value,
					targetValue: asDisplayValue(maps[targetIndex]?.[key]),
					relatedKey: firstKey,
					file: fileOf ? fileOf(group, locale) : undefined,
					message: `The key \`${firstKey}\` in the same locale already uses this value.`
				})
			);
		}
	}
}

/** Keys of every locale, target language first so reports follow its order. */
export const collectKeys = (maps: TranslationMap[], targetIndex: number): string[] => {
	const keys: string[] = [];
	const seen = new Set<string>();

	const collect = (map: TranslationMap) => {
		for (const key of Object.keys(map)) {
			if (seen.has(key)) {
				continue;
			}

			seen.add(key);
			keys.push(key);
		}
	};

	if (targetIndex !== -1) {
		collect(maps[targetIndex]);
	}

	for (let index = 0; index < maps.length; index += 1) {
		if (index !== targetIndex) {
			collect(maps[index]);
		}
	}

	return keys;
};

/**
 * Bring the input into the `group -> locale -> flat map` shape the analysis
 * works on. With `flattened` the caller's objects are used as they are, which is
 * what makes analysing data already held in memory allocation free.
 */
export function prepareGroups(
	input: Chki18nInput,
	options: Chki18nResolvedOptions,
	issues: Chki18nIssue[]
): TranslationGroups {
	const source: TranslationGroups = input.groups ?? { '': input.locales ?? {} };
	const prepared: TranslationGroups = {};

	for (const group of Object.keys(source)) {
		const locales = source[group] ?? {};
		const preparedLocales: { [locale: string]: TranslationMap } = {};

		for (const locale of Object.keys(locales)) {
			const map = locales[locale];

			if (!map || typeof map !== 'object') {
				issues.push(
					createIssue(CHECK_CODE.INVALID_FILE, {
						locale,
						group,
						message: `The translations of \`${locale}\` are not an object.`
					})
				);
				continue;
			}

			if (options.flattened) {
				preparedLocales[locale] = map;
				continue;
			}

			try {
				preparedLocales[locale] = flatten(map);
			} catch {
				issues.push(
					createIssue(CHECK_CODE.INVALID_FILE, {
						locale,
						group,
						message: `The translations of \`${locale}\` could not be flattened. Invalid translate key or i18n format.`
					})
				);
			}
		}

		prepared[group] = preparedLocales;
	}

	return prepared;
}

export type Chki18nAnalyzer = {
	/** The options every call of this analyzer runs with. */
	readonly options: Chki18nResolvedOptions;
	/** Issues raised while resolving those options, replayed into every result. */
	readonly optionIssues: Chki18nIssue[];
	/** Compare a whole set of translations held in memory. */
	analyze: (input: Chki18nInput) => Chki18nResult;
	/**
	 * Compare a single key across locales. Cross-key checks (`DUPLICATE_VALUE`)
	 * cannot be answered from one key and are never reported here.
	 */
	checkEntry: (entry: Chki18nEntry) => Chki18nIssue[];
};

/**
 * A reusable analyzer bound to one set of options.
 *
 * Prefer this over calling `analyzeTranslations` repeatedly: the options, the
 * enabled checks and the interpolation delimiters are resolved once, so a caller
 * re-checking after every edit pays only for the comparison itself.
 */
export function createAnalyzer(options?: Chki18nOptions): Chki18nAnalyzer {
	const resolved = resolveOptions(options);
	const flags = buildCheckFlags(resolved.options.enabledChecks);

	const analyze = (input: Chki18nInput): Chki18nResult => {
		const startedAt = Date.now();
		// Whatever produced the input may already have found problems (an
		// unreadable file, say); they belong in the same report.
		const issues: Chki18nIssue[] = [...(input?.issues ?? []), ...resolved.issues];
		const groups = prepareGroups(input ?? {}, resolved.options, issues);
		const groupNames = Object.keys(groups);
		const allLocales = new Set<string>();
		const fileOf = buildFileLookup(input?.files);
		let keyCount = 0;

		for (const group of groupNames) {
			const localeMaps = groups[group];
			const localeNames = Object.keys(localeMaps);

			for (const locale of localeNames) {
				allLocales.add(locale);
			}

			const targetIndex = localeNames.indexOf(resolved.options.target);

			if (targetIndex === -1) {
				issues.push(
					createIssue(CHECK_CODE.INVALID_OPTIONS, {
						level: 'error',
						group,
						message: `The target language \`${resolved.options.target}\` was not found${group ? ` in \`${group}\`` : ''}. There is nothing to compare against.`
					})
				);
				continue;
			}

			const maps = localeNames.map((locale) => localeMaps[locale]);
			const keys = collectKeys(maps, targetIndex);
			const values: unknown[] = new Array(maps.length);
			const present: boolean[] = new Array(maps.length);

			keyCount += keys.length;

			for (const key of keys) {
				for (let index = 0; index < maps.length; index += 1) {
					const exists = Object.hasOwn(maps[index], key);

					present[index] = exists;
					values[index] = exists ? maps[index][key] : undefined;
				}

				checkKeySlots(
					issues,
					key,
					group,
					localeNames,
					values,
					present,
					targetIndex,
					flags,
					resolved.options,
					fileOf
				);
			}

			if (flags.duplicateValue) {
				checkDuplicateValues(issues, group, localeNames, maps, targetIndex, fileOf);
			}
		}

		applyLevelOverrides(issues, resolved.options.levels);

		return buildResult(issues, resolved.options, {
			locales: [...allLocales],
			groups: groupNames,
			keyCount,
			files: input?.files ?? [],
			fileFormat: input?.fileFormat ?? null,
			elapsedMs: Date.now() - startedAt
		});
	};

	const checkEntry = (entry: Chki18nEntry): Chki18nIssue[] => {
		const issues: Chki18nIssue[] = [];
		const entryValues = entry?.values ?? {};
		const localeNames = entry?.locales ?? Object.keys(entryValues);
		const values: unknown[] = new Array(localeNames.length);
		const present: boolean[] = new Array(localeNames.length);

		for (let index = 0; index < localeNames.length; index += 1) {
			const exists = Object.hasOwn(entryValues, localeNames[index]);

			present[index] = exists;
			values[index] = exists ? entryValues[localeNames[index]] : undefined;
		}

		checkKeySlots(
			issues,
			entry?.key ?? '',
			entry?.group ?? '',
			localeNames,
			values,
			present,
			localeNames.indexOf(resolved.options.target),
			flags,
			resolved.options,
			null
		);

		return applyLevelOverrides(issues, resolved.options.levels);
	};

	return {
		options: resolved.options,
		optionIssues: resolved.issues,
		analyze,
		checkEntry
	};
}

/**
 * Compare translations held in memory. Does no file system work at all, so this
 * is the entry point to use when the strings are already loaded.
 */
export function analyzeTranslations(input: Chki18nInput, options?: Chki18nOptions): Chki18nResult {
	return createAnalyzer(options).analyze(input);
}
