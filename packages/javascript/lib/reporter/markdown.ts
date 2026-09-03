import { GROUP_BY } from '../constants.js';
import {
	countsSentence,
	detailOf,
	keyLabelOf,
	padTo,
	plural,
	referenceOf,
	scopeSentence,
	widestOf
} from './text.js';
import type { Chki18nReportContext } from './context.js';

/** A cell may hold a translated value, and a `|` in one would split the row. */
const cell = (text: string): string => text.replace(/\|/g, '\\|');

const code = (text: string): string => (text ? `\`${cell(text)}\`` : '');

/**
 * A table with its columns padded in the source, which is how every Markdown
 * file in this project is written and what keeps the raw text readable when
 * whatever renders it does not.
 */
function table(header: string[], rows: string[][]): string[] {
	const widths = header.map((title, column) =>
		widestOf([title, ...rows.map((row) => row[column])])
	);
	const line = (cells: string[]) =>
		`| ${cells.map((text, column) => padTo(text, widths[column])).join(' | ')} |`;

	return [
		line(header),
		`| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`,
		...rows.map((row) => line(row))
	];
}

/**
 * The report as a document: a heading per section and a table of findings, for
 * a pull request comment or a report checked in beside the translations.
 */
export function formatMarkdown(context: Chki18nReportContext): string {
	const { options, result, sections } = context;
	const lines: string[] = [
		'# Translation check',
		'',
		`**${countsSentence(result.summary)}** ${scopeSentence(result)} Compared against \`${result.target}\`.`
	];

	const byCode = options.groupBy === GROUP_BY.CODE;

	for (const section of sections) {
		lines.push('', `## ${section.label || 'Issues'}`, '');
		lines.push(
			...table(
				['Level', byCode ? 'Locale' : 'Check', 'Key', 'Value', 'Note'],
				section.issues.map((issue) => [
					issue.level,
					code(byCode ? issue.locale : issue.code),
					code(keyLabelOf(issue, context.showGroup)),
					cell(referenceOf(issue, result.target)),
					cell(detailOf(issue))
				])
			)
		);
	}

	if (sections.length < 1) {
		lines.push('', 'Nothing to report.');
	}

	if (context.hidden > 0) {
		lines.push('', `${plural(context.hidden, 'issue')} not shown, because of the level options.`);
	}

	return lines.join('\n');
}
