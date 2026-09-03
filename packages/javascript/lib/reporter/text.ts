import { CHECK_META } from '../constants.js';
import { type Chki18nPaint } from './paint.js';
import type { Chki18nIssue, Chki18nLevelCount, Chki18nResult } from '../_types/global.js';

/** `1 key` / `2 keys`, so a count never has to be read as `2 key(s)`. */
export function plural(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function quote(value?: string): string {
	return value === undefined ? '(none)' : `"${oneLine(value)}"`;
}

/**
 * A translation value can hold newlines and runs of spaces, both of which would
 * break a column apart. Only the report collapses them; nothing is changed for
 * the checks themselves, which is where whitespace still matters.
 */
export function oneLine(value: string): string {
	return value.replace(/\s+/g, ' ');
}

/**
 * Code point ranges a monospace font draws twice as wide. A report of Korean,
 * Japanese or Chinese translations is the normal case here, and counting their
 * characters as one column each is what pulls every column out of line.
 */
const WIDE_RANGES: [number, number][] = [
	[0x1100, 0x115f],
	[0x2e80, 0x303e],
	[0x3041, 0x33ff],
	[0x3400, 0x4dbf],
	[0x4e00, 0x9fff],
	[0xa000, 0xa4cf],
	[0xa960, 0xa97f],
	[0xac00, 0xd7a3],
	[0xf900, 0xfaff],
	[0xfe10, 0xfe19],
	[0xfe30, 0xfe6f],
	[0xff00, 0xff60],
	[0xffe0, 0xffe6],
	[0x1f300, 0x1f64f],
	[0x1f900, 0x1f9ff],
	[0x20000, 0x3fffd]
];

/** Marks drawn on top of the character before them, taking no column of their own. */
const ZERO_WIDTH_RANGES: [number, number][] = [
	[0x0300, 0x036f],
	[0x200b, 0x200f],
	[0xfe00, 0xfe0f],
	[0xfeff, 0xfeff]
];

const within = (ranges: [number, number][], code: number): boolean =>
	ranges.some(([from, to]) => code >= from && code <= to);

function charWidth(char: string): number {
	const code = char.codePointAt(0) ?? 0;

	if (within(ZERO_WIDTH_RANGES, code)) {
		return 0;
	}

	return within(WIDE_RANGES, code) ? 2 : 1;
}

/** Columns a string occupies, rather than the number of characters in it. */
export function displayWidth(text: string): number {
	let width = 0;

	for (const char of text) {
		width += charWidth(char);
	}

	return width;
}

/** Pads to a column count, so a column of Korean lines up with one of English. */
export function padTo(text: string, width: number): string {
	return `${text}${' '.repeat(Math.max(0, width - displayWidth(text)))}`;
}

/** The widest of a set of strings, in columns. */
export function widestOf(values: string[]): number {
	return values.reduce((widest, value) => Math.max(widest, displayWidth(value)), 0);
}

export function truncate(text: string, max: number): string {
	if (displayWidth(text) <= max) {
		return text;
	}

	const room = Math.max(1, max - 3);
	let width = 0;
	let kept = '';

	for (const char of text) {
		const next = width + charWidth(char);

		if (next > room) {
			break;
		}

		width = next;
		kept += char;
	}

	return `${kept}...`;
}

/**
 * Breaks a sentence on its spaces so it fits a column count. Prose is wrapped
 * rather than cut: a description that stops mid-word tells the reader less than
 * one that runs onto a second line. A word wider than the column is left to
 * overflow, since breaking it would only make it unreadable.
 */
export function wrap(text: string, width: number): string[] {
	if (width < 8) {
		return [text];
	}

	const lines: string[] = [];
	let line = '';

	for (const word of text.split(' ')) {
		if (!line) {
			line = word;
		} else if (displayWidth(line) + 1 + displayWidth(word) > width) {
			lines.push(line);
			line = word;
		} else {
			line += ` ${word}`;
		}
	}

	if (line) {
		lines.push(line);
	}

	return lines;
}

/**
 * Cuts the front instead of the back. What tells two file paths apart is their
 * last few segments, so those are the ones a heading has to keep.
 */
export function truncateStart(text: string, max: number): string {
	if (displayWidth(text) <= max) {
		return text;
	}

	const characters = [...text];
	const room = Math.max(1, max - 3);
	let width = 0;
	let kept = '';

	for (let index = characters.length - 1; index >= 0; index -= 1) {
		const next = width + charWidth(characters[index]);

		if (next > room) {
			break;
		}

		width = next;
		kept = `${characters[index]}${kept}`;
	}

	return `...${kept}`;
}

/** `3 errors · 7 warnings · 1 info`, or `clean` when there is nothing to say. */
export function countsPhrase(
	counts: Chki18nLevelCount,
	paint: Chki18nPaint
): { text: string; length: number } {
	const parts: string[] = [];
	let length = 0;

	const add = (count: number, word: string, painter: (text: string) => string) => {
		if (count < 1) {
			return;
		}

		length += (parts.length > 0 ? 3 : 0) + word.length;
		parts.push(painter(word));
	};

	add(counts.error, plural(counts.error, 'error'), paint.error);
	add(counts.warn, plural(counts.warn, 'warning'), paint.warn);
	// `info` has no plural that reads well, so the noun is left as it is.
	add(counts.info, `${counts.info} info`, paint.info);

	if (parts.length < 1) {
		return { text: paint.dim('clean'), length: 5 };
	}

	return { text: parts.join(paint.dim(' · ')), length };
}

/** The same tally as `countsPhrase`, unpainted and as a sentence. */
export function countsSentence(counts: Chki18nLevelCount): string {
	const parts = [
		counts.error > 0 && plural(counts.error, 'error'),
		counts.warn > 0 && plural(counts.warn, 'warning'),
		counts.info > 0 && `${counts.info} info`
	].filter(Boolean);

	return parts.length > 0 ? `Found ${parts.join(', ')}.` : 'Found no issues.';
}

/** What the run compared, as one sentence. */
export function scopeSentence(result: Chki18nResult): string {
	return `Compared ${plural(result.keyCount, 'key')} across ${plural(result.locales.length, 'locale')} in ${plural(result.groups.length, 'group')}. (${result.elapsedMs}ms)`;
}

/**
 * The target language's own wording, which is what a translation is compared
 * against. Keys the target language does not have fall back to their own value,
 * and a check about the key rather than the value shows neither.
 */
export function referenceOf(issue: Chki18nIssue, target: string): string {
	if (issue.targetValue !== undefined) {
		return `${target}: ${quote(issue.targetValue)}`;
	}

	if (issue.value !== undefined) {
		return `${issue.locale}: ${quote(issue.value)}`;
	}

	return '';
}

/**
 * What this occurrence adds over the check's own description. A check that only
 * repeats the description has nothing to add, so it contributes no line.
 */
export function detailOf(issue: Chki18nIssue): string {
	return issue.message === CHECK_META[issue.code]?.description ? '' : issue.message;
}

/**
 * The key as the report shows it. When a project has more than one comparable
 * set of files, the group is part of the key's address and is shown with it.
 */
export function keyLabelOf(issue: Chki18nIssue, showGroup: boolean): string {
	return showGroup && issue.group ? `${issue.key} @${issue.group}` : issue.key;
}

/** Strips the working directory from a path, leaving an absolute one alone. */
export function relativeTo(path: string, cwd: string): string {
	if (!cwd) {
		return path;
	}

	for (const separator of ['/', '\\']) {
		const prefix = cwd.endsWith(separator) ? cwd : `${cwd}${separator}`;

		if (path.startsWith(prefix)) {
			return path.slice(prefix.length);
		}
	}

	return path;
}
