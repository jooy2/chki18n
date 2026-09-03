/**
 * Code point ranges a monospace font draws twice as wide. Korean, Japanese and
 * Chinese translations are the normal case here, and counting their characters
 * as one column each is what pulls a report's columns out of line and makes a
 * length comparison against an English original meaningless.
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

/** Columns one character occupies: none, one, or two. */
export function charWidth(char: string): number {
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
