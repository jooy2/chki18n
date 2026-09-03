/// Keys written twice inside one JSON object.
///
/// `{"a": 1, "a": 2}` is valid JSON, and a decoder answers `{"a": 2}` without a
/// word about the first one. It is what a botched merge conflict or a
/// hand-edited file leaves behind, and by the time anything reads the
/// translations the evidence is gone — so it is found here, in the text, before
/// parsing throws the duplicate away.
///
/// This is a scanner rather than a parser: it tracks strings, nesting and which
/// strings are keys, and ignores everything else about the grammar. The file is
/// parsed for real straight afterwards, so malformed input is not this
/// function's problem — it just has to not report nonsense when it sees some.
library;

/// A duplicated key, at the path its object sits at.
class Chki18nJsonDuplicateKey {
  /// Records one key written twice.
  const Chki18nJsonDuplicateKey(this.path, this.line);

  /// Dotted path of the key, from the document root.
  final String path;

  /// 1-based line the second definition is on.
  final int line;

  @override
  bool operator ==(Object other) =>
      other is Chki18nJsonDuplicateKey && other.path == path && other.line == line;

  @override
  int get hashCode => Object.hash(path, line);

  @override
  String toString() => '$path (line $line)';
}

/// One object or array the scanner is currently inside.
class _Frame {
  _Frame({required this.keys, required this.path});

  /// Keys already seen in this object. `null` inside an array.
  final Set<String>? keys;

  /// Path of the object itself, for reporting.
  final String path;

  /// Key the next value belongs to, once one has been read.
  String? pendingKey;
}

/// A JSON string read off the text, and where it ended.
class _ReadString {
  const _ReadString(this.value, this.end);

  final String value;
  final int end;
}

/// Reads a JSON string starting at the opening quote.
_ReadString _readString(String text, int start) {
  final value = StringBuffer();
  var index = start + 1;

  while (index < text.length) {
    final char = text[index];

    if (char == r'\') {
      // Whatever it escapes, it is not a closing quote. Kept verbatim: an
      // unescaped comparison is enough to tell two keys apart, and decoding
      // would mean re-implementing JSON's escapes for no gain.
      value.write(text.substring(index, index + 2 > text.length ? text.length : index + 2));
      index += 2;
      continue;
    }

    if (char == '"') {
      return _ReadString(value.toString(), index + 1);
    }

    value.write(char);
    index += 1;
  }

  return _ReadString(value.toString(), index);
}

/// Every key written twice in one JSON document, in the order they are reached.
List<Chki18nJsonDuplicateKey> findDuplicateJsonKeys(String text) {
  final duplicates = <Chki18nJsonDuplicateKey>[];
  final stack = <_Frame>[];
  var index = 0;
  var line = 1;
  // Whether the next string is a key: true just inside an object, and again
  // after every comma in one.
  var expectKey = false;

  while (index < text.length) {
    final char = text[index];

    if (char == '\n') {
      line += 1;
      index += 1;
      continue;
    }

    if (char == '"') {
      final read = _readString(text, index);
      final frame = stack.isEmpty ? null : stack.last;
      final keys = frame?.keys;

      if (keys != null && expectKey) {
        if (keys.contains(read.value)) {
          duplicates.add(
            Chki18nJsonDuplicateKey(
              frame!.path.isEmpty ? read.value : '${frame.path}.${read.value}',
              line,
            ),
          );
        } else {
          keys.add(read.value);
        }

        frame!.pendingKey = read.value;
        expectKey = false;
      }

      // Count the newlines a multi-line string swallowed.
      for (var at = index; at < read.end; at += 1) {
        if (text[at] == '\n') {
          line += 1;
        }
      }

      index = read.end;
      continue;
    }

    if (char == '{' || char == '[') {
      final parent = stack.isEmpty ? null : stack.last;
      final path =
          parent == null
              ? ''
              : parent.keys == null
              ? parent.path
              : parent.pendingKey == null
              ? parent.path
              : parent.path.isEmpty
              ? parent.pendingKey!
              : '${parent.path}.${parent.pendingKey}';

      stack.add(_Frame(keys: char == '{' ? <String>{} : null, path: path));
      expectKey = char == '{';
      index += 1;
      continue;
    }

    if (char == '}' || char == ']') {
      if (stack.isNotEmpty) {
        stack.removeLast();
      }

      expectKey = false;
      index += 1;
      continue;
    }

    if (char == ',') {
      expectKey = stack.isNotEmpty && stack.last.keys != null;
      index += 1;
      continue;
    }

    index += 1;
  }

  return duplicates;
}
