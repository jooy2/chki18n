import { collectKeys, createAnalyzer, prepareGroups } from './analyzer.js';
import type {
	Chki18nEntry,
	Chki18nFileFormat,
	Chki18nInput,
	Chki18nIssue,
	Chki18nOptions,
	Chki18nResolvedOptions,
	Chki18nResult,
	Chki18nSourceFile,
	TranslationGroups,
	TranslationMap
} from '../_types/global.js';

export type Chki18nSession = {
	/** The options every check of this session runs with. */
	readonly options: Chki18nResolvedOptions;
	/** Every locale the session holds. */
	readonly locales: string[];
	/** Every group the session holds, in scan order. */
	readonly groups: string[];
	/** The files the translations were read from, when they came from disk. */
	readonly files: Chki18nSourceFile[];
	/** Layout the translations came from, or `null` for in-memory input. */
	readonly fileFormat: Chki18nFileFormat | null;
	/** Keys of a group, target language first. */
	keys: (group?: string) => string[];
	/**
	 * The flattened translations of a group, keyed by locale. The objects are
	 * the session's own: read them freely, but write through `set` / `remove`.
	 */
	translations: (group?: string) => { [locale: string]: TranslationMap };
	/** One value, or `undefined` when that locale does not define the key. */
	get: (locale: string, key: string, group?: string) => any;
	/** Write a value and report what that key now looks like. */
	set: (locale: string, key: string, value: string, group?: string) => Chki18nIssue[];
	/** Drop a key from one locale, or from every locale, and re-check it. */
	remove: (key: string, options?: { locale?: string; group?: string }) => Chki18nIssue[];
	/** Check a single key. Cross-key checks are not reported here. */
	checkKey: (key: string, group?: string) => Chki18nIssue[];
	/** Check everything the session holds. Reads no files. */
	analyze: () => Chki18nResult;
	/** Replace the translations, keeping the options and the analyzer. */
	reset: (input: Chki18nInput) => void;
};

/**
 * Hold a set of translations and check them repeatedly.
 *
 * Options are resolved once, the translations are flattened once, and every
 * later call works on what is already in memory. Use it when this module owns
 * the data; when your own application owns it, `createAnalyzer().checkEntry`
 * takes the values directly and keeps a single source of truth.
 */
export function createSession(input: Chki18nInput, options?: Chki18nOptions): Chki18nSession {
	// The session flattens once, up front, so the analyzer never has to.
	const analyzer = createAnalyzer({ ...options, flattened: true });
	const inputIsFlat = options?.flattened === true;

	let groups: TranslationGroups = {};
	let groupNames: string[] = [];
	let localeNames: string[] = [];
	let files: Chki18nSourceFile[] = [];
	let fileFormat: Chki18nFileFormat | null = null;
	let sourceIssues: Chki18nIssue[] = [];
	let unusedKeys: string[] = [];

	const reset = (next: Chki18nInput): void => {
		const loadIssues: Chki18nIssue[] = [];

		groups = prepareGroups(next ?? {}, { ...analyzer.options, flattened: inputIsFlat }, loadIssues);
		groupNames = Object.keys(groups);
		files = next?.files ?? [];
		fileFormat = next?.fileFormat ?? null;
		sourceIssues = [...(next?.issues ?? []), ...loadIssues];
		unusedKeys = next?.unusedKeys ?? [];

		const locales = new Set<string>();

		for (const group of groupNames) {
			for (const locale of Object.keys(groups[group])) {
				locales.add(locale);
			}
		}

		localeNames = [...locales];
	};

	/**
	 * Which group a call means. With one group there is nothing to decide; with
	 * several, an unnamed key is looked for where it actually lives, so callers
	 * only have to name a group when adding a key that does not exist yet.
	 */
	const resolveGroup = (key?: string, group?: string): string => {
		if (group !== undefined) {
			return group;
		}

		if (groupNames.length < 2 || key === undefined) {
			return groupNames[0] ?? '';
		}

		for (const name of groupNames) {
			for (const locale of Object.keys(groups[name])) {
				if (Object.hasOwn(groups[name][locale], key)) {
					return name;
				}
			}
		}

		return groupNames[0] ?? '';
	};

	const localesOf = (group: string): string[] => Object.keys(groups[group] ?? {});

	const checkKey = (key: string, group?: string): Chki18nIssue[] => {
		const name = resolveGroup(key, group);
		const locales = localesOf(name);
		const entry: Chki18nEntry = { key, values: {}, locales, group: name };

		for (const locale of locales) {
			if (Object.hasOwn(groups[name][locale], key)) {
				entry.values[locale] = groups[name][locale][key];
			}
		}

		return analyzer.checkEntry(entry);
	};

	reset(input ?? {});

	return {
		get options() {
			return analyzer.options;
		},
		get locales() {
			return localeNames;
		},
		get groups() {
			return groupNames;
		},
		get files() {
			return files;
		},
		get fileFormat() {
			return fileFormat;
		},
		keys: (group) => {
			const name = resolveGroup(undefined, group);
			const locales = localesOf(name);

			return collectKeys(
				locales.map((locale) => groups[name][locale]),
				locales.indexOf(analyzer.options.target)
			);
		},
		translations: (group) => groups[resolveGroup(undefined, group)] ?? {},
		get: (locale, key, group) => groups[resolveGroup(key, group)]?.[locale]?.[key],
		set: (locale, key, value, group) => {
			const name = resolveGroup(key, group);

			((groups[name] ??= {})[locale] ??= {})[key] = value;

			if (!localeNames.includes(locale)) {
				localeNames = [...localeNames, locale];
			}

			if (!groupNames.includes(name)) {
				groupNames = [...groupNames, name];
			}

			return checkKey(key, name);
		},
		remove: (key, removeOptions) => {
			const name = resolveGroup(key, removeOptions?.group);
			const locales = removeOptions?.locale ? [removeOptions.locale] : localesOf(name);

			for (const locale of locales) {
				delete groups[name]?.[locale]?.[key];
			}

			return checkKey(key, name);
		},
		checkKey,
		analyze: () =>
			analyzer.analyze({
				groups,
				files,
				issues: sourceIssues,
				unusedKeys,
				fileFormat: fileFormat ?? undefined
			}),
		reset
	};
}
