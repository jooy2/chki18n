import { REPORTER } from '../constants.js';
import { buildReportContext, type Chki18nReportInit } from './context.js';
import { formatList } from './list.js';
import { formatMarkdown } from './markdown.js';
import { formatPretty } from './pretty.js';
import type { Chki18nResolvedOptions, Chki18nResult } from '../_types/global.js';

export type { Chki18nReportContext, Chki18nReportInit } from './context.js';
export type { Chki18nIssueGroup } from './group.js';
export { groupIssues } from './group.js';
// Column arithmetic a terminal interface of its own would otherwise repeat.
export { displayWidth, padTo, truncate } from './text.js';

/**
 * Render a finished result as text.
 *
 * Which reporter runs is the only thing that changes between a terminal, a file
 * and another tool's input: the checks, the counts and the order are the same
 * in all of them, so a report can be re-rendered without re-running the scan.
 */
export function formatResult(
	result: Chki18nResult,
	options: Chki18nResolvedOptions,
	init: Chki18nReportInit = {}
): string {
	const reporter = init.reporter ?? options.reporter;

	// The whole result, unfiltered: `--no-warn` shapes what a person reads, and
	// a program asking for JSON wants everything that was found.
	if (reporter === REPORTER.JSON) {
		return JSON.stringify(result, null, 2);
	}

	const context = buildReportContext(result, options, init);

	if (reporter === REPORTER.LIST) {
		return formatList(context);
	}

	if (reporter === REPORTER.MARKDOWN) {
		return formatMarkdown(context);
	}

	return formatPretty(context);
}
