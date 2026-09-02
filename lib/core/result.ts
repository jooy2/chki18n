import { groupIssuesByCode, hasError, summarizeIssues } from './issue.js';
import type { Chki18nIssue, Chki18nResolvedOptions, Chki18nResult } from '../_types/global.js';

/**
 * What a result holds beyond its issues. The counted fields are left out on
 * purpose: they are derived from the issue list, and a caller that knows only
 * part of it must not be able to state them.
 */
type Chki18nResultFacts = Omit<
	Chki18nResult,
	'success' | 'issues' | 'issuesByCode' | 'summary' | 'target'
>;

/**
 * Assemble a result around a set of issues. Every entry point builds its result
 * here, so a caller sees the same shape whether the translations came from
 * disk, from memory or from a session.
 */
export function buildResult(
	issues: Chki18nIssue[],
	options: Chki18nResolvedOptions,
	facts: Partial<Chki18nResultFacts> = {}
): Chki18nResult {
	return {
		locales: [],
		groups: [],
		keyCount: 0,
		files: [],
		fileFormat: null,
		elapsedMs: 0,
		...facts,
		target: options.target,
		success: !hasError(issues),
		issues,
		issuesByCode: groupIssuesByCode(issues),
		summary: summarizeIssues(issues)
	};
}
