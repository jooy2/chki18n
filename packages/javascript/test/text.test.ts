import assert from 'node:assert';
import { describe, it } from 'node:test';
import { charWidth, displayWidth, truncate } from '../dist/index.js';
import { wrap } from '../dist/reporter/text.js';

// The report measures, wraps and cuts every line it draws, so those helpers keep
// a running width and cut once instead of joining and measuring again. Each is
// held here to the way it used to answer, over strings built from the
// characters that sit on an edge of one of them: marks of no width, wide
// characters on both planes, and lone surrogates.

const referenceTruncate = (text: string, max: number): string => {
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
};

const referenceWrap = (text: string, width: number): string[] => {
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
};

const ALPHABET = [
	'a',
	'Z',
	'0',
	'.',
	' ',
	' ',
	' ',
	'\t',
	'\n',
	'\u0301',
	'\u1160',
	'\ufe0f',
	'\u{e0100}',
	'\uac00',
	'\u3042',
	'\uff01',
	'\u{20000}',
	'\u{1f600}',
	'\u00e9',
	'\ud800',
	'\udc00'
];

/** A fixed sequence of pseudo-random strings, the same on every run. */
const corpus = (): string[] => {
	let seed = 20261127;
	const next = (limit: number): number => {
		seed = (seed * 1103515245 + 12345) % 2147483648;

		return seed % limit;
	};
	const strings = ['', ...ALPHABET];

	for (let count = 0; count < 20000; count += 1) {
		const length = next(24);
		let text = '';

		for (let index = 0; index < length; index += 1) {
			text += ALPHABET[next(ALPHABET.length)];
		}

		strings.push(text);
	}

	return strings;
};

describe('report text', () => {
	const strings = corpus();

	it('cuts a value at the end where it always was', () => {
		for (const text of strings) {
			for (const max of [0, 1, 4, 5, 8, 13]) {
				assert.strictEqual(truncate(text, max), referenceTruncate(text, max), JSON.stringify(text));
			}
		}
	});

	it('wraps a value where it always was', () => {
		for (const text of strings) {
			for (const width of [7, 8, 10, 16]) {
				assert.deepStrictEqual(wrap(text, width), referenceWrap(text, width), JSON.stringify(text));
			}
		}
	});
});
