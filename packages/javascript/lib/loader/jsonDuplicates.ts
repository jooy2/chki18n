/**
 * Keys written twice inside one JSON object.
 *
 * `{ "a": 1, "a": 2 }` is valid JSON, and `JSON.parse` answers `{ "a": 2 }`
 * without a word about the first one. It is what a botched merge conflict or a
 * hand-edited file leaves behind, and by the time anything reads the
 * translations the evidence is gone — so it is found here, in the text, before
 * parsing throws the duplicate away.
 *
 * This is a scanner rather than a parser: it tracks strings, nesting and which
 * strings are keys, and ignores everything else about the grammar. The file is
 * parsed for real straight afterwards, so malformed input is not this function's
 * problem — it just has to not report nonsense when it sees some.
 */

/** A duplicated key, at the path its object sits at. */
export type JsonDuplicateKey = {
	/** Dotted path of the key, from the document root. */
	path: string;
	/** 1-based line the second definition is on. */
	line: number;
};

type Frame = {
	/** Keys already seen in this object. `null` inside an array. */
	keys: Set<string> | null;
	/** Path of the object itself, for reporting. */
	path: string;
	/** Key the next value belongs to, once one has been read. */
	pendingKey: string | null;
	/** Position of the current element, inside an array. */
	index: number;
};

/** A dotted path one segment longer. */
const join = (path: string, segment: string): string => (path ? `${path}.${segment}` : segment);

/**
 * Read a JSON string starting at the opening quote: its value, where it ends,
 * and how many line breaks it holds.
 *
 * Escapes are kept as they are written: an unescaped comparison is enough to
 * tell two keys apart, and decoding would mean re-implementing JSON's escapes
 * for no gain. That makes the value the text between the quotes, cut out in one
 * piece rather than built up a character at a time.
 */
function readString(text: string, start: number): { value: string; end: number; lines: number } {
	let index = start + 1;
	let lines = 0;

	while (index < text.length) {
		const code = text.charCodeAt(index);

		if (code === 0x5c) {
			// Whatever it escapes, it is not a closing quote.
			if (text.charCodeAt(index + 1) === 0x0a) {
				lines += 1;
			}

			index += 2;
			continue;
		}

		if (code === 0x22) {
			return { value: text.slice(start + 1, index), end: index + 1, lines };
		}

		if (code === 0x0a) {
			lines += 1;
		}

		index += 1;
	}

	return { value: text.slice(start + 1), end: index, lines };
}

export function findDuplicateJsonKeys(text: string): JsonDuplicateKey[] {
	const duplicates: JsonDuplicateKey[] = [];
	const stack: Frame[] = [];
	let index = 0;
	let line = 1;
	// Whether the next string is a key: true just inside an object, and again
	// after every comma in one.
	let expectKey = false;

	while (index < text.length) {
		const code = text.charCodeAt(index);

		if (code === 0x0a) {
			line += 1;
			index += 1;
			continue;
		}

		if (code === 0x22) {
			const { value, end, lines } = readString(text, index);
			const frame = stack[stack.length - 1];

			if (frame?.keys && expectKey) {
				if (frame.keys.has(value)) {
					duplicates.push({ path: join(frame.path, value), line });
				} else {
					frame.keys.add(value);
				}

				frame.pendingKey = value;
				expectKey = false;
			}

			// Count the newlines a multi-line string swallowed.
			line += lines;
			index = end;
			continue;
		}

		if (code === 0x7b || code === 0x5b) {
			const parent = stack[stack.length - 1];
			// An element of an array is addressed by its position, the way
			// flattening writes it: `list.0.label`.
			const segment = !parent ? null : parent.keys ? parent.pendingKey : String(parent.index);
			const path = !parent || segment === null ? (parent?.path ?? '') : join(parent.path, segment);

			stack.push({ keys: code === 0x7b ? new Set() : null, path, pendingKey: null, index: 0 });
			expectKey = code === 0x7b;
			index += 1;
			continue;
		}

		if (code === 0x7d || code === 0x5d) {
			stack.pop();
			expectKey = false;
			index += 1;
			continue;
		}

		if (code === 0x2c) {
			const frame = stack[stack.length - 1];

			if (frame && !frame.keys) {
				frame.index += 1;
			}

			expectKey = Boolean(frame?.keys);
			index += 1;
			continue;
		}

		index += 1;
	}

	return duplicates;
}
