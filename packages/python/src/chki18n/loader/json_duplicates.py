"""Keys written twice inside one JSON object.

``{"a": 1, "a": 2}`` is valid JSON, and a decoder answers ``{"a": 2}`` without a
word about the first one. It is what a botched merge conflict or a hand-edited
file leaves behind, and by the time anything reads the translations the evidence
is gone — so it is found here, in the text, before parsing throws the duplicate
away.

This is a scanner rather than a parser: it tracks strings, nesting and which
strings are keys, and ignores everything else about the grammar. The file is
parsed for real straight afterwards, so malformed input is not this function's
problem — it just has to not report nonsense when it sees some.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class JsonDuplicateKey:
    """A duplicated key, at the path its object sits at."""

    #: Dotted path of the key, from the document root.
    path: str
    #: 1-based line the second definition is on.
    line: int


@dataclass(slots=True)
class _Frame:
    """One object or array the scanner is currently inside."""

    #: Keys already seen in this object. ``None`` inside an array.
    keys: set[str] | None
    #: Path of the object itself, for reporting.
    path: str
    #: Key the next value belongs to, once one has been read.
    pending_key: str | None = field(default=None)


def _read_string(text: str, start: int) -> tuple[str, int]:
    """Read a JSON string starting at the opening quote. Returns its value and end."""
    value: list[str] = []
    index = start + 1

    while index < len(text):
        char = text[index]

        if char == "\\":
            # Whatever it escapes, it is not a closing quote. Kept verbatim: an
            # unescaped comparison is enough to tell two keys apart, and decoding
            # would mean re-implementing JSON's escapes for no gain.
            value.append(text[index : index + 2])
            index += 2
            continue

        if char == '"':
            return "".join(value), index + 1

        value.append(char)
        index += 1

    return "".join(value), index


def find_duplicate_json_keys(text: str) -> list[JsonDuplicateKey]:
    """Every key written twice in one JSON document, in the order they are reached."""
    duplicates: list[JsonDuplicateKey] = []
    stack: list[_Frame] = []
    index = 0
    line = 1
    # Whether the next string is a key: true just inside an object, and again
    # after every comma in one.
    expect_key = False

    while index < len(text):
        char = text[index]

        if char == "\n":
            line += 1
            index += 1
            continue

        if char == '"':
            value, end = _read_string(text, index)
            frame = stack[-1] if stack else None

            if frame is not None and frame.keys is not None and expect_key:
                if value in frame.keys:
                    duplicates.append(
                        JsonDuplicateKey(f"{frame.path}.{value}" if frame.path else value, line)
                    )
                else:
                    frame.keys.add(value)

                frame.pending_key = value
                expect_key = False

            # Count the newlines a multi-line string swallowed.
            line += text.count("\n", index, end)
            index = end
            continue

        if char in "{[":
            parent = stack[-1] if stack else None

            if parent is None:
                path = ""
            elif parent.keys is None or parent.pending_key is None:
                path = parent.path
            elif parent.path:
                path = f"{parent.path}.{parent.pending_key}"
            else:
                path = parent.pending_key

            stack.append(_Frame(keys=set() if char == "{" else None, path=path))
            expect_key = char == "{"
            index += 1
            continue

        if char in "}]":
            if stack:
                stack.pop()

            expect_key = False
            index += 1
            continue

        if char == ",":
            expect_key = bool(stack) and stack[-1].keys is not None
            index += 1
            continue

        index += 1

    return duplicates
