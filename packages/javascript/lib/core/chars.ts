/**
 * Character tests the analysis asks of values, written against code units so
 * a question about one end of a value does not walk the whole of it.
 */

/**
 * Whether `code` is one of the characters `\s` matches in a regular
 * expression: the ASCII whitespace, the line and paragraph separators, the
 * Unicode spaces and the byte order mark.
 */
export function isSpaceCode(code: number): boolean {
	if (code < 0x80) {
		return code === 0x20 || (code >= 0x09 && code <= 0x0d);
	}

	return (
		code === 0xa0 ||
		code === 0x1680 ||
		(code >= 0x2000 && code <= 0x200a) ||
		code === 0x2028 ||
		code === 0x2029 ||
		code === 0x202f ||
		code === 0x205f ||
		code === 0x3000 ||
		code === 0xfeff
	);
}
