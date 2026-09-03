/**
 * Which plural forms a language needs, and how a key names the one it holds.
 *
 * The table is deliberately conservative. Recent CLDR releases added a `many`
 * category to several languages for compact decimals, and a project on an older
 * i18n runtime does not write it; asking for a form nobody uses would report a
 * correct file as broken. Where the answer is not settled the language is left
 * out, and a language that is left out is never judged.
 */

import type { Chki18nPluralCategory } from '../_types/global.js';

/** Every plural category, in the order CLDR lists them. */
export const PLURAL_CATEGORIES: Chki18nPluralCategory[] = [
	'zero',
	'one',
	'two',
	'few',
	'many',
	'other'
];

const CATEGORY_NAMES = new Set<string>(PLURAL_CATEGORIES);

/**
 * The i18next suffix that predates the named categories, paired with a bare key
 * for the singular. It is not read as a category: which of the two forms is
 * which depends on the language, so requiring either would report a correct
 * file as broken. A key written this way is judged as an ordinary key, exactly
 * as it was before this check existed.
 */
const LEGACY_PLURAL_SUFFIX = 'plural';

const ONLY_OTHER: Chki18nPluralCategory[] = ['other'];

const ONE_OTHER: Chki18nPluralCategory[] = ['one', 'other'];

const CATEGORIES_OF_LANGUAGE: Record<string, Chki18nPluralCategory[]> = {
	af: ONE_OTHER,
	am: ONE_OTHER,
	ar: ['zero', 'one', 'two', 'few', 'many', 'other'],
	az: ONE_OTHER,
	be: ['one', 'few', 'many', 'other'],
	bg: ONE_OTHER,
	bn: ONE_OTHER,
	bs: ['one', 'few', 'other'],
	ca: ONE_OTHER,
	cs: ['one', 'few', 'many', 'other'],
	cy: ['zero', 'one', 'two', 'few', 'many', 'other'],
	da: ONE_OTHER,
	de: ONE_OTHER,
	el: ONE_OTHER,
	en: ONE_OTHER,
	es: ONE_OTHER,
	et: ONE_OTHER,
	eu: ONE_OTHER,
	fa: ONE_OTHER,
	fi: ONE_OTHER,
	fr: ONE_OTHER,
	ga: ['one', 'two', 'few', 'many', 'other'],
	gu: ONE_OTHER,
	ha: ONE_OTHER,
	hi: ONE_OTHER,
	hr: ['one', 'few', 'other'],
	hu: ONE_OTHER,
	hy: ONE_OTHER,
	id: ONLY_OTHER,
	is: ONE_OTHER,
	it: ONE_OTHER,
	ja: ONLY_OTHER,
	ka: ONE_OTHER,
	kk: ONE_OTHER,
	km: ONLY_OTHER,
	kn: ONE_OTHER,
	ko: ONLY_OTHER,
	ky: ONE_OTHER,
	lo: ONLY_OTHER,
	lt: ['one', 'few', 'many', 'other'],
	lv: ['zero', 'one', 'other'],
	ml: ONE_OTHER,
	mn: ONE_OTHER,
	mr: ONE_OTHER,
	ms: ONLY_OTHER,
	my: ONLY_OTHER,
	nb: ONE_OTHER,
	ne: ONE_OTHER,
	nl: ONE_OTHER,
	nn: ONE_OTHER,
	no: ONE_OTHER,
	pl: ['one', 'few', 'many', 'other'],
	pt: ONE_OTHER,
	ro: ['one', 'few', 'other'],
	ru: ['one', 'few', 'many', 'other'],
	si: ONE_OTHER,
	sk: ['one', 'few', 'many', 'other'],
	sl: ['one', 'two', 'few', 'other'],
	sq: ONE_OTHER,
	sr: ['one', 'few', 'other'],
	sv: ONE_OTHER,
	sw: ONE_OTHER,
	ta: ONE_OTHER,
	te: ONE_OTHER,
	th: ONLY_OTHER,
	tr: ONE_OTHER,
	uk: ['one', 'few', 'many', 'other'],
	ur: ONE_OTHER,
	uz: ONE_OTHER,
	vi: ONLY_OTHER,
	zh: ONLY_OTHER,
	zu: ONE_OTHER
};

const CACHE = new Map<string, Chki18nPluralCategory[] | null>();

/**
 * The plural forms a locale's language needs, or `null` when the language is
 * not one this table is sure about. A language it is not sure about is left
 * exactly as it was: nothing is required of it and nothing is excused it.
 */
export function pluralCategoriesOf(locale: string): Chki18nPluralCategory[] | null {
	const cached = CACHE.get(locale);

	if (cached !== undefined) {
		return cached;
	}

	const categories = CATEGORIES_OF_LANGUAGE[locale.toLowerCase().split(/[-_]/)[0]] ?? null;

	CACHE.set(locale, categories);

	return categories;
}

/**
 * The key and the plural form a suffixed key names, or `null` when the key is
 * an ordinary one. `item_one` is the `one` form of `item`.
 */
export function pluralPartsOf(
	key: string
): { base: string; category: Chki18nPluralCategory } | null {
	const separator = key.lastIndexOf('_');

	if (separator < 1) {
		return null;
	}

	const suffix = key.slice(separator + 1);

	if (!CATEGORY_NAMES.has(suffix)) {
		return null;
	}

	return { base: key.slice(0, separator), category: suffix as Chki18nPluralCategory };
}

/**
 * The key a plural form belongs to, whichever convention wrote it, or `null`
 * when the key is not a plural form at all. Looser than `pluralPartsOf` on
 * purpose: this answers "what does the source call this?", where the legacy
 * suffix is as good an answer as a named category, and no check depends on
 * which of the two it was.
 */
export function pluralBaseOf(key: string): string | null {
	const parts = pluralPartsOf(key);

	if (parts) {
		return parts.base;
	}

	const separator = key.lastIndexOf('_');

	return separator > 0 && key.slice(separator + 1) === LEGACY_PLURAL_SUFFIX
		? key.slice(0, separator)
		: null;
}

/**
 * Whether a locale's language uses a plural form at all. A language the table
 * does not cover is assumed to use every form, so nothing changes for it.
 */
export function usesPluralCategory(locale: string, category: Chki18nPluralCategory): boolean {
	const categories = pluralCategoriesOf(locale);

	return categories === null || categories.includes(category);
}
