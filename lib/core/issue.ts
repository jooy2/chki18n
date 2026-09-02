import { CHECK_CODE, CHECK_META } from '../constants.js';
import type {
	Chki18nCheckCode,
	Chki18nIssue,
	Chki18nLevelCount,
	Chki18nSummary
} from '../_types/global.js';

const emptyLevelCount = (): Chki18nLevelCount => ({ error: 0, warn: 0, info: 0 });

/**
 * Build an issue, taking its severity and its default description from
 * `CHECK_META` so no call site has to repeat them. Undefined fields in `init`
 * are dropped rather than written, keeping optional keys off the result object.
 */
export function createIssue(
	code: Chki18nCheckCode,
	init: Partial<Chki18nIssue> = {}
): Chki18nIssue {
	const meta = CHECK_META[code] ?? CHECK_META[CHECK_CODE.UNKNOWN];
	const issue: Chki18nIssue = {
		code,
		level: meta.level,
		locale: '',
		key: '',
		group: '',
		message: meta.description
	};

	for (const field of Object.keys(init) as (keyof Chki18nIssue)[]) {
		if (init[field] !== undefined) {
			(issue as Record<string, unknown>)[field] = init[field];
		}
	}

	return issue;
}

/** Group issues by check code, in the order the codes were first seen. */
export function groupIssuesByCode(
	issues: Chki18nIssue[]
): Partial<Record<Chki18nCheckCode, Chki18nIssue[]>> {
	const grouped: Partial<Record<Chki18nCheckCode, Chki18nIssue[]>> = {};

	for (const issue of issues) {
		(grouped[issue.code] ??= []).push(issue);
	}

	return grouped;
}

/**
 * Counts a consumer would otherwise have to derive itself: totals per level,
 * per check code, per locale and per group. Computed in one pass.
 */
export function summarizeIssues(issues: Chki18nIssue[]): Chki18nSummary {
	const summary: Chki18nSummary = {
		error: 0,
		warn: 0,
		info: 0,
		total: issues.length,
		byCode: {},
		byLocale: {},
		byGroup: {}
	};

	for (const issue of issues) {
		summary[issue.level] += 1;
		summary.byCode[issue.code] = (summary.byCode[issue.code] ?? 0) + 1;

		if (issue.locale) {
			(summary.byLocale[issue.locale] ??= emptyLevelCount())[issue.level] += 1;
		}

		(summary.byGroup[issue.group] ??= emptyLevelCount())[issue.level] += 1;
	}

	return summary;
}

/** A run fails only on `error` level issues; warnings never block. */
export function hasError(issues: Chki18nIssue[]): boolean {
	return issues.some((issue) => issue.level === 'error');
}
