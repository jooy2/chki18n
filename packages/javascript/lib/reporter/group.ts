import { CHECK_CODE, GROUP_BY } from '../constants.js';
import { relativeTo } from './text.js';
import type {
	Chki18nGroupBy,
	Chki18nIssue,
	Chki18nLevel,
	Chki18nLevelCount
} from '../_types/global.js';

/** Issues sharing one value of the grouping axis, ready to be printed. */
export type Chki18nIssueGroup = {
	/** The axis value itself, e.g. a locale code. Empty when the issue has none. */
	id: string;
	/** What the report prints as this section's heading. */
	label: string;
	issues: Chki18nIssue[];
	counts: Chki18nLevelCount;
};

const CODE_ORDER = new Map<string, number>(
	Object.values(CHECK_CODE).map((code, index) => [code, index])
);

const LEVEL_ORDER: Record<Chki18nLevel, number> = { error: 0, warn: 1, info: 2 };

/** Issues about the run itself rather than about one locale or one file. */
const GENERAL_LABEL = '(general)';

/** The unnamed group a single set of translation files forms. */
const DEFAULT_GROUP_LABEL = '(default)';

const codeRank = (code: string): number => CODE_ORDER.get(code) ?? CODE_ORDER.size;

/**
 * Report order within a section: what fails the run first, then the checks in
 * the order they are declared, then alphabetically. Two runs over unchanged
 * files therefore print the same lines in the same places, which is what makes
 * a saved report worth diffing.
 */
export function compareIssues(a: Chki18nIssue, b: Chki18nIssue): number {
	return (
		LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
		codeRank(a.code) - codeRank(b.code) ||
		a.locale.localeCompare(b.locale) ||
		a.key.localeCompare(b.key)
	);
}

function axisValueOf(issue: Chki18nIssue, groupBy: Chki18nGroupBy): string {
	switch (groupBy) {
		case GROUP_BY.CODE:
			return issue.code;
		case GROUP_BY.GROUP:
			return issue.group;
		case GROUP_BY.FILE:
			return issue.file ?? '';
		case GROUP_BY.LOCALE:
			return issue.locale;
		default:
			return '';
	}
}

function labelOf(id: string, groupBy: Chki18nGroupBy, cwd: string): string {
	if (groupBy === GROUP_BY.NONE) {
		return '';
	}

	if (groupBy === GROUP_BY.GROUP) {
		return id || DEFAULT_GROUP_LABEL;
	}

	if (!id) {
		return GENERAL_LABEL;
	}

	return groupBy === GROUP_BY.FILE ? relativeTo(id, cwd) : id;
}

/** A section with an error outranks one with only warnings, and so on down. */
const severityRank = (counts: Chki18nLevelCount): number =>
	counts.error > 0 ? 0 : counts.warn > 0 ? 1 : 2;

/**
 * Split issues into the sections a report prints, worst section first. Issues
 * that carry no value for the chosen axis — a bad option has no locale — collect
 * into one leading section rather than being dropped.
 */
export function groupIssues(
	issues: Chki18nIssue[],
	groupBy: Chki18nGroupBy,
	cwd = ''
): Chki18nIssueGroup[] {
	const sections = new Map<string, Chki18nIssueGroup>();

	for (const issue of issues) {
		const id = axisValueOf(issue, groupBy);
		let section = sections.get(id);

		if (!section) {
			section = {
				id,
				label: labelOf(id, groupBy, cwd),
				issues: [],
				counts: { error: 0, warn: 0, info: 0 }
			};
			sections.set(id, section);
		}

		section.issues.push(issue);
		section.counts[issue.level] += 1;
	}

	for (const section of sections.values()) {
		section.issues.sort(compareIssues);
	}

	return [...sections.values()].sort(
		(a, b) =>
			severityRank(a.counts) - severityRank(b.counts) ||
			b.counts.error - a.counts.error ||
			b.counts.warn - a.counts.warn ||
			(groupBy === GROUP_BY.CODE ? codeRank(a.id) - codeRank(b.id) : a.id.localeCompare(b.id))
	);
}

/** The same split one level down, for the sub-headings inside a section. */
export function subGroupIssues(
	issues: Chki18nIssue[],
	by: (issue: Chki18nIssue) => string
): { id: string; issues: Chki18nIssue[]; counts: Chki18nLevelCount }[] {
	const parts: { id: string; issues: Chki18nIssue[]; counts: Chki18nLevelCount }[] = [];
	const index = new Map<string, number>();

	for (const issue of issues) {
		const id = by(issue);
		let position = index.get(id);

		if (position === undefined) {
			position = parts.length;
			index.set(id, position);
			parts.push({ id, issues: [], counts: { error: 0, warn: 0, info: 0 } });
		}

		parts[position].issues.push(issue);
		parts[position].counts[issue.level] += 1;
	}

	return parts;
}
