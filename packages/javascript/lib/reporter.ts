import { CHECK_META } from './constants.js';
import type { Chki18nLogger } from './logger.js';
import type { Chki18nIssue, Chki18nResult } from './_types/global.js';

const quote = (value?: string): string => (value === undefined ? '(none)' : `"${value}"`);

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

/**
 * One line per issue. The check code already heads the block, so the line only
 * carries what tells this occurrence apart from the others: where it is and,
 * when the check produced a specific explanation, what exactly is wrong.
 */
function formatIssue(issue: Chki18nIssue, target: string): string {
	if (!issue.key) {
		return ` - ${issue.message}`;
	}

	const where = [issue.locale, issue.group && `@${issue.group}`].filter(Boolean).join(' ');
	const detail = issue.message === CHECK_META[issue.code]?.description ? '' : ` ${issue.message}`;
	// Show the target language's wording, which is what the reader compares
	// against. Keys the target language does not have fall back to their own —
	// and a check that is about the key rather than about a value shows neither.
	const reference =
		issue.targetValue !== undefined
			? ` (${target}: ${quote(issue.targetValue)})`
			: issue.value !== undefined
				? ` (${issue.locale}: ${quote(issue.value)})`
				: '';

	return ` - ${where ? `${where} -> ` : ''}'${issue.key}'${reference}${detail}`;
}

/** Print a finished result the way the CLI shows it. */
export function reportResult(result: Chki18nResult, logger: Chki18nLogger): void {
	for (const code of Object.keys(result.issuesByCode) as (keyof typeof result.issuesByCode)[]) {
		const issues = result.issuesByCode[code];

		if (!issues || issues.length < 1) {
			continue;
		}

		const meta = CHECK_META[code];
		const heading = `[${code}] ${meta?.summary ?? 'Unknown error'} (${issues.length}):`;
		// A code's severity can be overridden per occurrence, so the heading
		// follows the worst level actually present rather than the default one.
		const level = issues.some((issue) => issue.level === 'error')
			? 'error'
			: issues.some((issue) => issue.level === 'warn')
				? 'warn'
				: 'info';

		logger.plain();
		logger[level](heading);

		for (const issue of issues) {
			logger.plain(formatIssue(issue, result.target));
		}
	}

	logger.plain();
	logger.info(
		`Compared ${plural(result.keyCount, 'key')} across ${plural(result.locales.length, 'locale')} in ${plural(result.groups.length, 'group')}. (${result.elapsedMs}ms)`
	);

	if (result.summary.error > 0 || result.summary.warn > 0) {
		logger.info(
			`Found ${plural(result.summary.error, 'error')} and ${plural(result.summary.warn, 'warning')}.`
		);
	}
}
