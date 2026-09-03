import { flatten } from 'flat';
import { CHECK_CODE } from '../constants.js';
import { resolveOptions } from '../options.js';
import { extractInterpolationKeys } from './interpolation.js';
import { findDuplicateKeys } from './duplicate.js';
import { applyLevelOverrides, createIssue } from './issue.js';
import { checkKeyShape } from './key.js';
import { buildResult } from './result.js';
import {
	extractNumbers,
	extractTags,
	findInvisibleCharacter,
	hasTranslatableText,
	nameOfInvisibleCharacter,
	scriptOfLocale
} from './value.js';
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

const times = (count: number): string => `${count} time${count === 1 ? '' : 's'}`;

/** `a`, `a and b`, `a, b and c` — a list as a sentence reads it. */
function listOf(items: string[]): string {
	if (items.length < 3) {
		return items.join(' and ');
	}

	return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** How often each item appears, for the checks that compare two multisets. */
function countOf(items: readonly string[]): Map<string, number> {
	const counts = new Map<string, number>();

	for (const item of items) {
		counts.set(item, (counts.get(item) ?? 0) + 1);
	}

	return counts;
}

/** The same items in the same numbers, whatever order they appear in. */
function sameItems(a: readonly string[], b: readonly string[]): boolean {
	if (a.length !== b.length) {
		return false;
	}

	// A translation almost always keeps the numbers in the order it found them,
	// so the answer is usually one walk and no allocation at all.
	for (let index = 0; index < a.length; index += 1) {
		if (a[index] !== b[index]) {
			return [...a].sort().join('\u0000') === [...b].sort().join('\u0000');
		}
	}

	return true;
}

/**
 * Markup tags by their lower case spelling, keeping the first spelling seen so
 * a message can quote the tag as it was actually written. HTML tag names are
 * case insensitive, so `<B>` and `<b>` are the same tag.
 */
function countTags(tags: readonly string[]): Map<string, { count: number; text: string }> {
	const counts = new Map<string, { count: number; text: string }>();

	for (const tag of tags) {
		const id = tag.toLowerCase();
		const found = counts.get(id);

		if (found) {
			found.count += 1;
			continue;
		}

		counts.set(id, { count: 1, text: tag });
	}

	return counts;
}

/**
 * Whether each comparison check is enabled, resolved once instead of asking the
 * enabled-set again for every key of every locale.
 */
type CheckFlags = {
	invalidValueType: boolean;
	noLocale: boolean;
	noKey: boolean;
	dummyKey: boolean;
	duplicateKey: boolean;
	unusedKey: boolean;
	emptyValue: boolean;
	noInterpolationKey: boolean;
	extraInterpolationKey: boolean;
	interpolationCount: boolean;
	tagMismatch: boolean;
	notTranslatedValue: boolean;
	untranslatedScript: boolean;
	duplicateValue: boolean;
	inconsistentValue: boolean;
	surroundingWhitespace: boolean;
	invisibleCharacter: boolean;
	missingNumber: boolean;
	numberMismatch: boolean;
};

type FileLookup = ((group: string, locale: string) => string | undefined) | null;

const buildCheckFlags = (enabled: Set<Chki18nCheckCode>): CheckFlags => ({
	invalidValueType: enabled.has(CHECK_CODE.INVALID_VALUE_TYPE),
	noLocale: enabled.has(CHECK_CODE.NO_LOCALE),
	noKey: enabled.has(CHECK_CODE.NO_KEY),
	dummyKey: enabled.has(CHECK_CODE.DUMMY_KEY),
	duplicateKey: enabled.has(CHECK_CODE.DUPLICATE_KEY),
	unusedKey: enabled.has(CHECK_CODE.UNUSED_KEY),
	emptyValue: enabled.has(CHECK_CODE.EMPTY_VALUE),
	noInterpolationKey: enabled.has(CHECK_CODE.NO_INTERPOLATION_KEY),
	extraInterpolationKey: enabled.has(CHECK_CODE.EXTRA_INTERPOLATION_KEY),
	interpolationCount: enabled.has(CHECK_CODE.INTERPOLATION_COUNT),
	tagMismatch: enabled.has(CHECK_CODE.TAG_MISMATCH),
	notTranslatedValue: enabled.has(CHECK_CODE.NOT_TRANSLATED_VALUE),
	untranslatedScript: enabled.has(CHECK_CODE.UNTRANSLATED_SCRIPT),
	duplicateValue: enabled.has(CHECK_CODE.DUPLICATE_VALUE),
	inconsistentValue: enabled.has(CHECK_CODE.INCONSISTENT_VALUE),
	surroundingWhitespace: enabled.has(CHECK_CODE.SURROUNDING_WHITESPACE),
	invisibleCharacter: enabled.has(CHECK_CODE.INVISIBLE_CHARACTER),
	missingNumber: enabled.has(CHECK_CODE.MISSING_NUMBER),
	numberMismatch: enabled.has(CHECK_CODE.NUMBER_MISMATCH)
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
 * Report the markup this value does not carry the way the target language does.
 * Counts rather than presence: a value that opens `<b>` twice and closes it once
 * renders as broken as one that dropped the tag altogether.
 */
function reportTagMismatch(
	issues: Chki18nIssue[],
	base: Partial<Chki18nIssue>,
	value: string,
	expected: Map<string, { count: number; text: string }>
): void {
	const found = countTags(extractTags(value));

	if (found.size < 1 && expected.size < 1) {
		return;
	}

	const missing: string[] = [];
	const extra: string[] = [];

	// One finding per direction rather than per tag: a dropped `<b>...</b>` is a
	// single mistake, and reporting its two halves separately reads as two.
	for (const [id, tag] of expected) {
		const count = found.get(id)?.count ?? 0;

		if (count < tag.count) {
			missing.push(
				count < 1 ? `\`${tag.text}\`` : `\`${tag.text}\` (${times(count)} of ${tag.count})`
			);
		}
	}

	for (const [id, tag] of found) {
		const count = expected.get(id)?.count ?? 0;

		if (tag.count > count) {
			extra.push(
				count < 1 ? `\`${tag.text}\`` : `\`${tag.text}\` (${times(tag.count)} of ${count})`
			);
		}
	}

	if (missing.length > 0) {
		issues.push(
			createIssue(CHECK_CODE.TAG_MISMATCH, {
				...base,
				value,
				message: `The ${missing.length === 1 ? 'tag' : 'tags'} ${listOf(missing)} of the target language ${missing.length === 1 ? 'is' : 'are'} missing from this value.`
			})
		);
	}

	if (extra.length > 0) {
		issues.push(
			createIssue(CHECK_CODE.TAG_MISMATCH, {
				...base,
				value,
				message: `The ${extra.length === 1 ? 'tag' : 'tags'} ${listOf(extra)} ${extra.length === 1 ? 'is' : 'are'} not in the target language.`
			})
		);
	}
}

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
	const targetNumbers =
		flags.numberMismatch && targetHasDigit ? extractNumbers(targetValue as string) : NO_KEYS;
	// Counted once per key rather than once per locale: what the target language
	// carries does not change while the locales are walked.
	const targetTagCounts =
		flags.tagMismatch && targetIsString ? countTags(extractTags(targetValue as string)) : null;
	const targetInterpolationCounts =
		flags.interpolationCount && targetInterpolations.length > 0
			? countOf(targetInterpolations)
			: null;
	const checkInterpolation =
		flags.noInterpolationKey || flags.extraInterpolationKey || flags.interpolationCount;

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

		if (flags.invisibleCharacter) {
			const invisible = findInvisibleCharacter(value);

			if (invisible) {
				issues.push(
					createIssue(CHECK_CODE.INVISIBLE_CHARACTER, {
						...base,
						value,
						message: `The value holds ${nameOfInvisibleCharacter(invisible)}, which nothing will draw.`
					})
				);
			}
		}

		if (targetIsString) {
			if (flags.notTranslatedValue && value === targetValue) {
				issues.push(createIssue(CHECK_CODE.NOT_TRANSLATED_VALUE, { ...base, value }));
			}

			if (flags.missingNumber && targetHasDigit && !DIGIT_PATTERN.test(value)) {
				issues.push(createIssue(CHECK_CODE.MISSING_NUMBER, { ...base, value }));
			}

			if (flags.numberMismatch && targetHasDigit && DIGIT_PATTERN.test(value)) {
				const numbers = extractNumbers(value);

				if (!sameItems(targetNumbers, numbers)) {
					issues.push(
						createIssue(CHECK_CODE.NUMBER_MISMATCH, {
							...base,
							value,
							message: `The target language uses ${targetNumbers.join(', ')} and this value uses ${numbers.join(', ')}.`
						})
					);
				}
			}

			if (targetTagCounts && (targetTagCounts.size > 0 || value.indexOf('<') !== -1)) {
				reportTagMismatch(issues, base, value, targetTagCounts);
			}

			// A value identical to the target language is already reported as
			// untranslated; saying it twice adds nothing.
			if (flags.untranslatedScript && value !== targetValue) {
				const script = scriptOfLocale(locale);

				if (
					script &&
					!script.test(value) &&
					hasTranslatableText(value, options.interpolationPrefix, options.interpolationSuffix)
				) {
					issues.push(createIssue(CHECK_CODE.UNTRANSLATED_SCRIPT, { ...base, value }));
				}
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

		// Only a repeated placeholder can differ in number, and the two checks
		// above already report one that is missing or unknown outright.
		if (
			!targetInterpolationCounts ||
			(targetInterpolations.length < 2 && currentInterpolations.length < 2)
		) {
			continue;
		}

		const currentCounts = countOf(currentInterpolations);

		for (const [interpolation, expected] of targetInterpolationCounts) {
			const found = currentCounts.get(interpolation);

			if (found === undefined || found === expected) {
				continue;
			}

			issues.push(
				createIssue(CHECK_CODE.INTERPOLATION_COUNT, {
					...base,
					value,
					interpolation,
					message: `The interpolation key \`${options.interpolationPrefix}${interpolation}${options.interpolationSuffix}\` is used ${times(found)} here and ${times(expected)} in the target language.`
				})
			);
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

/**
 * Report keys that share one target language string but are translated two
 * different ways. `DUPLICATE_VALUE` asks whether one locale repeats itself;
 * this asks the opposite question, and catches the terminology drift that turns
 * one `Save` button into two different words on two screens.
 */
function checkInconsistentValues(
	issues: Chki18nIssue[],
	group: string,
	localeNames: string[],
	maps: TranslationMap[],
	targetIndex: number,
	target: string,
	fileOf: FileLookup
): void {
	const targetMap = maps[targetIndex];
	const keysOfValue = new Map<string, string[]>();

	for (const key of Object.keys(targetMap)) {
		const value = targetMap[key];

		if (typeof value !== 'string' || value.length < 1) {
			continue;
		}

		const keys = keysOfValue.get(value);

		if (keys) {
			keys.push(key);
			continue;
		}

		keysOfValue.set(value, [key]);
	}

	for (const [targetValue, keys] of keysOfValue) {
		if (keys.length < 2) {
			continue;
		}

		for (let index = 0; index < localeNames.length; index += 1) {
			if (index === targetIndex) {
				continue;
			}

			const map = maps[index];
			let firstKey = '';
			let firstValue = '';

			for (const key of keys) {
				const value = map[key];

				// A key this locale does not have, or has not filled in, is
				// somebody else's finding.
				if (typeof value !== 'string' || value.length < 1) {
					continue;
				}

				if (!firstKey) {
					firstKey = key;
					firstValue = value;
					continue;
				}

				if (value === firstValue) {
					continue;
				}

				issues.push(
					createIssue(CHECK_CODE.INCONSISTENT_VALUE, {
						locale: localeNames[index],
						key,
						group,
						value,
						targetValue,
						relatedKey: firstKey,
						file: fileOf ? fileOf(group, localeNames[index]) : undefined,
						message: `The key \`${firstKey}\` has the same ${target} value but is translated as "${firstValue}".`
					})
				);
			}
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

			// Before flattening, because flattening is what hides it: two
			// definitions go in and one key comes out.
			if (options.enabledChecks.has(CHECK_CODE.DUPLICATE_KEY)) {
				for (const key of findDuplicateKeys(map)) {
					issues.push(
						createIssue(CHECK_CODE.DUPLICATE_KEY, {
							locale,
							group,
							key,
							message: `The key \`${key}\` is defined more than once, so one of its values is lost.`
						})
					);
				}
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
		// Collected before the comparison rather than during it: a group can only
		// be missing a language once every group has said which ones it has.
		const allLocales = new Set<string>();

		for (const group of groupNames) {
			for (const locale of Object.keys(groups[group])) {
				allLocales.add(locale);
			}
		}

		const fileOf = buildFileLookup(input?.files);
		// Supplied rather than worked out: whether a key is referenced is a fact
		// about the source tree, which the comparison never sees.
		const unusedKeys =
			flags.unusedKey && input?.unusedKeys?.length ? new Set(input.unusedKeys) : null;
		let keyCount = 0;

		for (const group of groupNames) {
			const localeMaps = groups[group];
			const localeNames = Object.keys(localeMaps);

			// Only worth asking with more than one group: with a single one, every
			// language that exists at all is in it by definition.
			if (flags.noLocale && groupNames.length > 1) {
				for (const locale of allLocales) {
					if (Object.hasOwn(localeMaps, locale)) {
						continue;
					}

					issues.push(
						createIssue(CHECK_CODE.NO_LOCALE, {
							locale,
							group,
							message: `\`${group}\` holds no translations for \`${locale}\`, so none of its keys exist there.`
						})
					);
				}
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
				// The shape of a key is the same in every language, so it is judged
				// once rather than once per locale.
				checkKeyShape(issues, key, group, resolved.options);

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

				// Not locale-bound: the key is unreferenced, not one language's
				// translation of it.
				if (unusedKeys?.has(key)) {
					issues.push(createIssue(CHECK_CODE.UNUSED_KEY, { key, group }));
				}
			}

			if (flags.duplicateValue) {
				checkDuplicateValues(issues, group, localeNames, maps, targetIndex, fileOf);
			}

			if (flags.inconsistentValue) {
				checkInconsistentValues(
					issues,
					group,
					localeNames,
					maps,
					targetIndex,
					resolved.options.target,
					fileOf
				);
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

		checkKeyShape(issues, entry?.key ?? '', entry?.group ?? '', resolved.options);
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
