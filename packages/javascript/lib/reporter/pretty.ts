import { CHECK_META, GROUP_BY } from '../constants.js';
import { subGroupIssues, type Chki18nIssueGroup } from './group.js';
import { paintOfLevel } from './paint.js';
import {
	countsPhrase,
	detailOf,
	displayWidth,
	keyLabelOf,
	padTo,
	plural,
	referenceOf,
	relativeTo,
	scopeSentence,
	truncate,
	truncateStart,
	widestOf
} from './text.js';
import type { Chki18nReportContext } from './context.js';
import type { Chki18nIssue, Chki18nLevelCount } from '../_types/global.js';

const INDENT_SECTION = '  ';

const INDENT_ITEM = '    ';

const INDENT_DETAIL = '      ';

/** Longest a column is allowed to grow before its content is cut short. */
const MAX_KEY_COLUMN = 40;

const MAX_LABEL_COLUMN = 30;

/** A section heading: the label, a rule, and what the section adds up to. */
function ruleLine(
	label: string,
	right: { text: string; length: number } | null,
	context: Chki18nReportContext
): string {
	const { paint, width } = context;
	const tailLength = right ? right.length + 1 : 0;
	// A long label is cut rather than allowed to push the counts past the edge
	// and wrap the rule onto a second line. A path keeps its tail, which is the
	// part that tells one file from another.
	const room = Math.max(12, width - tailLength - 5);
	const cut = /[/\\]/.test(label) ? truncateStart : truncate;
	const head = label ? ` ${cut(label, room)} ` : ' ';
	const fill = Math.max(3, width - displayWidth(head) - tailLength);

	return `${paint.heading(head)}${paint.dim('─'.repeat(fill))}${right ? ` ${right.text}` : ''}`;
}

/** What the run was pointed at, above the findings themselves. */
function headBlock(context: Chki18nReportContext): string[] {
	const { result, options, paint, cwd } = context;
	const rows: [string, string][] = [];

	if (options.path) {
		rows.push(['Path', relativeTo(options.path, cwd)]);
	}

	rows.push(['Target', result.target]);

	if (result.locales.length > 0) {
		rows.push(['Locales', result.locales.join(', ')]);
	}

	rows.push([
		'Layout',
		[result.fileFormat, plural(result.groups.length, 'group'), plural(result.keyCount, 'key')]
			.filter(Boolean)
			.join(', ')
	]);

	if (options.source) {
		rows.push(['Sources', relativeTo(options.source, cwd)]);
	}

	return rows.map(([label, value]) => `${INDENT_SECTION}${paint.dim(padTo(label, 9))}${value}`);
}

/** One line per issue, plus a second one when the issue has more to say. */
function itemLines(
	issues: Chki18nIssue[],
	context: Chki18nReportContext,
	showLocale: boolean,
	keyWidth: number
): string[] {
	const { paint, result, width } = context;
	const rows = issues.map((issue) => ({
		issue,
		locale: showLocale ? issue.locale : '',
		key: keyLabelOf(issue, context.showGroup),
		reference: referenceOf(issue, result.target),
		detail: detailOf(issue)
	}));

	const localeWidth = widestOf(rows.map((row) => row.locale));
	const lines: string[] = [];

	for (const row of rows) {
		if (!row.key) {
			// A bad option or an unreadable file has no key to name; the message is
			// the whole finding.
			lines.push(`${INDENT_ITEM}${paint.value(truncate(row.issue.message, width - 4))}`);
			continue;
		}

		const locale = localeWidth > 0 ? `${padTo(row.locale, localeWidth)}  ` : '';
		const key = padTo(truncate(row.key, keyWidth), keyWidth);
		const room = width - INDENT_ITEM.length - displayWidth(locale) - displayWidth(key) - 2;
		const reference = row.reference ? truncate(row.reference, Math.max(16, room)) : '';

		lines.push(
			`${INDENT_ITEM}${paint.dim(locale)}${paint.key(key)}${reference ? `  ${paint.value(reference)}` : ''}`
		);

		if (row.detail) {
			lines.push(
				`${INDENT_DETAIL}${paint.dim(truncate(row.detail, Math.max(24, width - INDENT_DETAIL.length)))}`
			);
		}
	}

	return lines;
}

/**
 * What a check means, but only where an issue does not already say it in its own
 * words. Repeating both would print the same sentence twice for every finding.
 */
function descriptionLine(
	issues: Chki18nIssue[],
	context: Chki18nReportContext,
	indent: string
): string[] {
	const description = CHECK_META[issues[0].code]?.description;

	if (!description || issues.every((issue) => detailOf(issue))) {
		return [];
	}

	return [`${indent}${context.paint.dim(description)}`];
}

/** The column every key in a section lines up to, however it is sub-grouped. */
const keyColumnOf = (section: Chki18nIssueGroup, context: Chki18nReportContext): number =>
	Math.min(
		MAX_KEY_COLUMN,
		widestOf(section.issues.map((issue) => keyLabelOf(issue, context.showGroup)))
	);

/** A section that already is one check: its meaning once, then the findings. */
function checkSection(section: Chki18nIssueGroup, context: Chki18nReportContext): string[] {
	return [
		'',
		...descriptionLine(section.issues, context, INDENT_SECTION),
		...itemLines(section.issues, context, true, keyColumnOf(section, context))
	];
}

/** A section holding several checks, each under a heading of its own. */
function mixedSection(section: Chki18nIssueGroup, context: Chki18nReportContext): string[] {
	const { paint } = context;
	const keyWidth = keyColumnOf(section, context);
	const lines: string[] = [];

	// Keyed by severity as well as by check: one check can report at two levels
	// once `levels` re-grades it, and a heading that says ERROR must not stand
	// over a line that is only a note.
	for (const part of subGroupIssues(section.issues, (issue) => `${issue.level} ${issue.code}`)) {
		const { code, level } = part.issues[0];

		lines.push(
			'',
			`${INDENT_SECTION}${paintOfLevel(paint, level)(padTo(level.toUpperCase(), 5))}  ${paint.heading(code)}${paint.dim(` (${part.issues.length})`)}`,
			...descriptionLine(part.issues, context, `${INDENT_SECTION}${' '.repeat(7)}`),
			...itemLines(part.issues, context, false, keyWidth)
		);
	}

	return lines;
}

const tally = (
	issues: Chki18nIssue[],
	by: (issue: Chki18nIssue) => string
): Map<string, Chki18nLevelCount> => {
	const counts = new Map<string, Chki18nLevelCount>();

	for (const issue of issues) {
		const id = by(issue);
		let count = counts.get(id);

		if (!count) {
			count = { error: 0, warn: 0, info: 0 };
			counts.set(id, count);
		}

		count[issue.level] += 1;
	}

	return counts;
};

/**
 * The axis the sections did not use. Grouping by locale leaves the reader
 * wondering which checks fired, and grouping by check leaves them wondering
 * which language is behind; this answers whichever question is still open.
 */
function crossTabRows(context: Chki18nReportContext): string[] {
	const { result, options, paint } = context;
	const byLocale = options.groupBy === GROUP_BY.CODE;
	const counts = tally(context.issues, (issue) => (byLocale ? issue.locale : issue.code));

	if (byLocale) {
		// A language with nothing wrong is worth saying out loud, so every locale
		// that took part gets a row.
		for (const locale of result.locales) {
			if (!counts.has(locale)) {
				counts.set(locale, { error: 0, warn: 0, info: 0 });
			}
		}
	}

	const rows = [...counts.entries()]
		.map(([id, count]) => ({ label: id || '(general)', count }))
		.sort(
			(a, b) =>
				b.count.error - a.count.error ||
				b.count.warn - a.count.warn ||
				b.count.info - a.count.info ||
				a.label.localeCompare(b.label)
		);

	if (rows.length < 1) {
		return [];
	}

	const labelWidth = Math.min(MAX_LABEL_COLUMN, widestOf(rows.map((row) => row.label)));

	return [
		'',
		`${INDENT_SECTION}${paint.dim(byLocale ? 'By locale' : 'By check')}`,
		...rows.map(
			(row) =>
				`${INDENT_ITEM}${paint.key(padTo(truncate(row.label, labelWidth), labelWidth))}  ${countsPhrase(row.count, paint).text}`
		)
	];
}

function summaryBlock(context: Chki18nReportContext): string[] {
	const { result, paint } = context;
	const lines = [
		'',
		`${INDENT_SECTION}${paint.dim(scopeSentence(result))}`,
		`${INDENT_SECTION}${countsPhrase(result.summary, paint).text}`
	];

	if (context.hidden > 0) {
		lines.push(
			`${INDENT_SECTION}${paint.dim(`${plural(context.hidden, 'issue')} not shown, because of the level options.`)}`
		);
	}

	const clean =
		context.options.groupBy === GROUP_BY.LOCALE
			? result.locales.filter(
					(locale) => !context.sections.some((section) => section.id === locale)
				)
			: [];

	if (clean.length > 0) {
		lines.push(`${INDENT_SECTION}${paint.dim(`Clean: ${clean.join(', ')}`)}`);
	}

	return [...lines, ...crossTabRows(context)];
}

function verdictLine(context: Chki18nReportContext): string {
	const { result, paint } = context;

	if (result.success) {
		return ` ${paint.pass(' PASS ')} ${paint.dim('No error level issue was found.')}`;
	}

	return ` ${paint.fail(' FAIL ')} ${plural(result.summary.error, 'error')} must be fixed before this passes.`;
}

/**
 * The report as a terminal reads it: a heading block, one section per group of
 * issues, and a summary that answers the question the grouping did not.
 */
export function formatPretty(context: Chki18nReportContext): string {
	const { options, paint, sections } = context;
	const lines: string[] = [];

	if (options.info) {
		lines.push(...headBlock(context));
	}

	for (const section of sections) {
		lines.push('', ruleLine(section.label, countsPhrase(section.counts, paint), context));
		lines.push(
			...(options.groupBy === GROUP_BY.CODE
				? checkSection(section, context)
				: mixedSection(section, context))
		);
	}

	if (sections.length < 1) {
		lines.push('', `${INDENT_SECTION}${paint.dim('Nothing to report.')}`);
	}

	if (options.info) {
		lines.push('', ruleLine('Summary', null, context), ...summaryBlock(context));
	}

	lines.push('', verdictLine(context));

	return lines.join('\n');
}
