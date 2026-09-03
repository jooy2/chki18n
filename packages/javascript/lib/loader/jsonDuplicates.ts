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
};

/** Read a JSON string starting at the opening quote. Returns its value and end. */
function readString(text: string, start: number): { value: string; end: number } {
	let value = '';
	let index = start + 1;

	while (index < text.length) {
		const char = text[index];

		if (char === '\\') {
			// Whatever it escapes, it is not a closing quote. Kept verbatim: an
			// unescaped comparison is enough to tell two keys apart, and decoding
			// would mean re-implementing JSON's escapes for no gain.
			value += text.slice(index, index + 2);
			index += 2;
			continue;
		}

		if (char === '"') {
			return { value, end: index + 1 };
		}

		value += char;
		index += 1;
	}

	return { value, end: index };
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
		const char = text[index];

		if (char === '\n') {
			line += 1;
			index += 1;
			continue;
		}

		if (char === '"') {
			const { value, end } = readString(text, index);
			const frame = stack[stack.length - 1];

			if (frame?.keys && expectKey) {
				if (frame.keys.has(value)) {
					duplicates.push({ path: frame.path ? `${frame.path}.${value}` : value, line });
				} else {
					frame.keys.add(value);
				}

				frame.pendingKey = value;
				expectKey = false;
			}

			// Count the newlines a multi-line string swallowed.
			for (let at = index; at < end; at += 1) {
				if (text[at] === '\n') {
					line += 1;
				}
			}

			index = end;
			continue;
		}

		if (char === '{' || char === '[') {
			const parent = stack[stack.length - 1];
			const path = !parent
				? ''
				: parent.keys
					? parent.pendingKey
						? parent.path
							? `${parent.path}.${parent.pendingKey}`
							: parent.pendingKey
						: parent.path
					: parent.path;

			stack.push({ keys: char === '{' ? new Set() : null, path, pendingKey: null });
			expectKey = char === '{';
			index += 1;
			continue;
		}

		if (char === '}' || char === ']') {
			stack.pop();
			expectKey = false;
			index += 1;
			continue;
		}

		if (char === ',') {
			expectKey = Boolean(stack[stack.length - 1]?.keys);
			index += 1;
			continue;
		}

		index += 1;
	}

	return duplicates;
}
