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

  /// Position of the current element, inside an array.
  int index = 0;
}

/// A dotted path one segment longer.
String _join(String path, String segment) => path.isEmpty ? segment : '$path.$segment';

/// A JSON string read off the text, where it ended, and how many line breaks
/// it held.
class _ReadString {
  const _ReadString(this.value, this.end, this.lines);

  final String value;
  final int end;
  final int lines;
}

/// Reads a JSON string starting at the opening quote.
///
/// Escapes are kept as they are written: an unescaped comparison is enough to
/// tell two keys apart, and decoding would mean re-implementing JSON's escapes
/// for no gain. That makes the value the text between the quotes, cut out in
/// one piece.
_ReadString _readString(String text, int start) {
  final length = text.length;
  var index = start + 1;
  var lines = 0;

  while (index < length) {
    final unit = text.codeUnitAt(index);

    if (unit == 0x5c) {
      // Whatever it escapes, it is not a closing quote.
      if (index + 1 < length && text.codeUnitAt(index + 1) == 0x0a) {
        lines += 1;
      }

      index += 2;
      continue;
    }

    if (unit == 0x22) {
      return _ReadString(text.substring(start + 1, index), index + 1, lines);
    }

    if (unit == 0x0a) {
      lines += 1;
    }

    index += 1;
  }

  return _ReadString(text.substring(start + 1, length), length, lines);
}

/// Every key written twice in one JSON document, in the order they are reached.
List<Chki18nJsonDuplicateKey> findDuplicateJsonKeys(String text) {
  final duplicates = <Chki18nJsonDuplicateKey>[];
  final stack = <_Frame>[];
  final length = text.length;
  var index = 0;
  var line = 1;
  // Whether the next string is a key: true just inside an object, and again
  // after every comma in one.
  var expectKey = false;

  while (index < length) {
    switch (text.codeUnitAt(index)) {
      case 0x0a:
        line += 1;
        index += 1;

      case 0x22:
        final read = _readString(text, index);
        final frame = stack.isEmpty ? null : stack.last;
        final keys = frame?.keys;

        if (frame != null && keys != null && expectKey) {
          if (!keys.add(read.value)) {
            duplicates.add(Chki18nJsonDuplicateKey(_join(frame.path, read.value), line));
          }

          frame.pendingKey = read.value;
          expectKey = false;
        }

        // Count the newlines a multi-line string swallowed.
        line += read.lines;
        index = read.end;

      case 0x7b || 0x5b:
        final isObject = text.codeUnitAt(index) == 0x7b;
        final parent = stack.isEmpty ? null : stack.last;
        // An element of an array is addressed by its position, the way
        // flattening writes it: `list.0.label`.
        final segment =
            parent == null
                ? null
                : parent.keys == null
                ? '${parent.index}'
                : parent.pendingKey;
        final path =
            parent == null
                ? ''
                : segment == null
                ? parent.path
                : _join(parent.path, segment);

        stack.add(_Frame(keys: isObject ? <String>{} : null, path: path));
        expectKey = isObject;
        index += 1;

      case 0x7d || 0x5d:
        if (stack.isNotEmpty) {
          stack.removeLast();
        }

        expectKey = false;
        index += 1;

      case 0x2c:
        if (stack.isNotEmpty && stack.last.keys == null) {
          stack.last.index += 1;
        }

        expectKey = stack.isNotEmpty && stack.last.keys != null;
        index += 1;

      default:
        index += 1;
    }
  }

  return duplicates;
}
