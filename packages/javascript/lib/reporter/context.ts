import { DEFAULT_REPORT_WIDTH, GROUP_BY } from '../constants.js';
import { groupIssues, type Chki18nIssueGroup } from './group.js';
import { createPaint, type Chki18nPaint } from './paint.js';
import type {
	Chki18nIssue,
	Chki18nLevelCount,
	Chki18nReporter,
	Chki18nResolvedOptions,
	Chki18nResult
} from '../_types/global.js';

/** Everything a formatter reads, worked out once and shared by all of them. */
export type Chki18nReportContext = {
	result: Chki18nResult;
	options: Chki18nResolvedOptions;
	/** The issues the level filter kept, in report order. */
	issues: Chki18nIssue[];
	/** Those issues split into the sections the report prints. */
	sections: Chki18nIssueGroup[];
	/** How many issues `--no-warn` and `--no-info` removed. */
	hidden: number;
	/** Levels of the kept issues, which is what the sections add up to. */
	counts: Chki18nLevelCount;
	paint: Chki18nPaint;
	/** Column the report is laid out to. */
	width: number;
	/** Working directory, so a path can be shown relative to it. */
	cwd: string;
	/** Whether a key needs its group named to be addressed without ambiguity. */
	showGroup: boolean;
};

/** How a report is rendered, beyond what the options already say. */
export type Chki18nReportInit = {
	/** Overrides `options.reporter`. The file output renders its own. */
	reporter?: Chki18nReporter;
	/** Overrides `options.color`. A file never gets escape codes. */
	color?: boolean;
	/** Column to lay the report out to. Defaults to `DEFAULT_REPORT_WIDTH`. */
	width?: number;
	/** Working directory, so a path can be shown relative to it. */
	cwd?: string;
};

const MIN_WIDTH = 48;

const MAX_WIDTH = 120;

export function buildReportContext(
	result: Chki18nResult,
	options: Chki18nResolvedOptions,
	init: Chki18nReportInit = {}
): Chki18nReportContext {
	const issues = result.issues.filter(
		(issue) => (issue.level !== 'warn' || options.warn) && (issue.level !== 'info' || options.info)
	);
	const counts: Chki18nLevelCount = { error: 0, warn: 0, info: 0 };

	for (const issue of issues) {
		counts[issue.level] += 1;
	}

	const cwd = init.cwd ?? '';
	const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, init.width || DEFAULT_REPORT_WIDTH));

	return {
		result,
		options,
		issues,
		sections: groupIssues(issues, options.groupBy, cwd),
		hidden: result.issues.length - issues.length,
		counts,
		paint: createPaint(init.color ?? options.color),
		width,
		cwd,
		// A section that already is a group or a file has named it in its heading.
		showGroup:
			result.groups.length > 1 &&
			options.groupBy !== GROUP_BY.GROUP &&
			options.groupBy !== GROUP_BY.FILE
	};
}
