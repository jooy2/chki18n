import {
	countsSentence,
	detailOf,
	keyLabelOf,
	padTo,
	referenceOf,
	scopeSentence,
	widestOf
} from './text.js';
import { paintOfLevel } from './paint.js';
import type { Chki18nReportContext } from './context.js';

/**
 * One line per issue and nothing else, so the output survives a `grep`, a diff
 * or an editor that parses each line on its own. Sections are dropped, but the
 * chosen grouping still decides the order, keeping related lines together.
 */
export function formatList(context: Chki18nReportContext): string {
	const { options, paint, result, sections } = context;
	const issues = sections.flatMap((section) => section.issues);
	const rows = issues.map((issue) => ({
		issue,
		locale: issue.locale || '-',
		code: issue.code,
		key: keyLabelOf(issue, context.showGroup) || '-',
		detail: [referenceOf(issue, result.target), detailOf(issue)].filter(Boolean).join('  ')
	}));

	const localeWidth = widestOf(rows.map((row) => row.locale));
	const codeWidth = widestOf(rows.map((row) => row.code));
	const keyWidth = widestOf(rows.map((row) => row.key));

	const lines = rows.map((row) =>
		[
			padTo(row.locale, localeWidth),
			paintOfLevel(paint, row.issue.level)(padTo(row.issue.level, 5)),
			paint.heading(padTo(row.code, codeWidth)),
			paint.key(padTo(row.key, keyWidth)),
			paint.value(row.detail)
		]
			.join('  ')
			.trimEnd()
	);

	if (!options.info) {
		return lines.join('\n');
	}

	const summary = `${countsSentence(result.summary)} ${scopeSentence(result)}`;

	// Nothing to separate from when there are no findings, so no blank line.
	return (lines.length > 0 ? [...lines, '', summary] : [summary]).join('\n');
}
