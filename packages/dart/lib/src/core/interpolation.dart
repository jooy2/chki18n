/// The placeholders a translation value carries.
library;

/// Shared empty result so the fast path never allocates.
const List<String> _noKeys = [];

/// Whether [unit] may appear in a placeholder name. A placeholder name is
/// written by a developer, so it is spelled the way an identifier is: ASCII
/// letters and digits, `_`, `$` and `-`. Anything else between the delimiters
/// is prose that happens to sit between them, not a placeholder.
bool _isKeyUnit(int unit) =>
    (unit >= 0x61 && unit <= 0x7a) ||
    (unit >= 0x41 && unit <= 0x5a) ||
    (unit >= 0x30 && unit <= 0x39) ||
    unit == 0x5f ||
    unit == 0x24 ||
    unit == 0x2d;

/// Whether every code unit of [text] from [from] up to [to] may appear in a
/// placeholder name. An empty range is a name, as `{}` is.
bool _isKeyName(String text, int from, int to) {
  for (var index = from; index < to; index += 1) {
    if (!_isKeyUnit(text.codeUnitAt(index))) {
      return false;
    }
  }

  return true;
}

/// Whether the delimiter at [at] is escaped by an odd number of backslashes.
bool _isEscaped(String text, int at) {
  var count = 0;

  for (var index = at - 1; index >= 0 && text.codeUnitAt(index) == 0x5c; index -= 1) {
    count += 1;
  }

  return count.isOdd;
}

/// Whether [delimiter] starts at [at] as a delimiter rather than as text. An
/// escaped one is text, and so is a doubled one-character delimiter: `{{name}}`
/// holds no key as far as `{` and `}` are concerned, which is what makes
/// `interpolationPrefix: '{{'` a real setting rather than a formality.
bool _isDelimiterAt(String text, int at, String delimiter, bool single) {
  if (!text.startsWith(delimiter, at) || _isEscaped(text, at)) {
    return false;
  }

  if (!single) {
    return true;
  }

  final unit = delimiter.codeUnitAt(0);

  return !(at > 0 && text.codeUnitAt(at - 1) == unit) &&
      !(at + 1 < text.length && text.codeUnitAt(at + 1) == unit);
}

/// Interpolation keys used by a value, e.g. `['name']` for `Hello {name}`.
///
/// This is the single most repeated operation of an analysis, so values that
/// cannot possibly hold a placeholder are rejected up front by one `indexOf`,
/// and the rest jump from one delimiter to the next rather than walking every
/// character. The two delimiters may differ in length, as `%{` and `}` do.
List<String> extractInterpolationKeys(Object? value, String prefix, String suffix) {
  if (value is! String || value.length < prefix.length + suffix.length) {
    return _noKeys;
  }

  if (!value.contains(prefix) || !value.contains(suffix)) {
    return _noKeys;
  }

  // One string cannot tell an opening delimiter from a closing one.
  if (prefix.isEmpty || suffix.isEmpty || prefix == suffix) {
    return _noKeys;
  }

  final single = prefix.length == 1 && suffix.length == 1;
  final found = <String>[];
  var at = value.indexOf(prefix);

  while (at != -1) {
    if (!_isDelimiterAt(value, at, prefix, single)) {
      at = value.indexOf(prefix, at + 1);
      continue;
    }

    final from = at + prefix.length;
    var close = value.indexOf(suffix, from);

    while (close != -1 && !_isDelimiterAt(value, close, suffix, single)) {
      close = value.indexOf(suffix, close + 1);
    }

    if (close == -1) {
      at = value.indexOf(prefix, at + 1);
      continue;
    }

    // The name is checked in place, and only a name that passes is copied out.
    if (_isKeyName(value, from, close)) {
      final key = value.substring(from, close);

      if (!key.contains(prefix) && !key.contains(suffix)) {
        found.add(key);
      }
    }

    at = value.indexOf(prefix, close + suffix.length);
  }

  return found;
}

/// An opening and closing delimiter pair, as `interpolationPrefix` takes them.
class Chki18nDelimiters {
  /// Creates a delimiter pair.
  const Chki18nDelimiters({required this.prefix, required this.suffix});

  /// Opening delimiter, e.g. `{{`.
  final String prefix;

  /// Closing delimiter, e.g. `}}`.
  final String suffix;

  @override
  bool operator ==(Object other) =>
      other is Chki18nDelimiters && other.prefix == prefix && other.suffix == suffix;

  @override
  int get hashCode => Object.hash(prefix, suffix);

  @override
  String toString() => 'Chki18nDelimiters($prefix, $suffix)';
}

/// The delimiter pairs [detectInterpolationDelimiters] knows, in the order it
/// believes them. A doubled pair comes before its single form, or `{{name}}`
/// would be read as `{` wrapped around `{name`.
const List<Chki18nDelimiters> interpolationDelimiters = [
  Chki18nDelimiters(prefix: '{{', suffix: '}}'),
  Chki18nDelimiters(prefix: '{', suffix: '}'),
  Chki18nDelimiters(prefix: '[[', suffix: ']]'),
  Chki18nDelimiters(prefix: '[', suffix: ']'),
  Chki18nDelimiters(prefix: '((', suffix: '))'),
  Chki18nDelimiters(prefix: '(', suffix: ')'),
  Chki18nDelimiters(prefix: '<<', suffix: '>>'),
  Chki18nDelimiters(prefix: '<', suffix: '>'),
];

/// The opening characters of every pair above, as one test per code unit.
bool _isOpener(int unit) => unit == 0x7b || unit == 0x5b || unit == 0x28 || unit == 0x3c;

/// Whether [unit] can start an interpolation key, which is how a placeholder
/// name is spelled everywhere else in this library.
///
/// Deliberately narrow: it is what tells `{name}` apart from the `{"` of the
/// JSON holding it, which is the whole reason this can be pointed at a file's
/// raw text.
bool _isKeyStart(int unit) =>
    (unit >= 0x61 && unit <= 0x7a) ||
    (unit >= 0x41 && unit <= 0x5a) ||
    (unit >= 0x30 && unit <= 0x39) ||
    unit == 0x5f ||
    unit == 0x24;

/// Guesses which delimiters a text writes its interpolation keys with, or
/// `null` when nothing in it looks like one.
///
/// This is a suggestion to offer a user, not a decision to act on: a text that
/// uses none can only be guessed at, and one that mixes two answers with the
/// first pair of [interpolationDelimiters] that it holds. Reach for it when a
/// project is being set up and `interpolationPrefix` has nobody to ask.
Chki18nDelimiters? detectInterpolationDelimiters(String text) {
  // One pass over the text, then the priority order is applied to what it saw.
  // Probing the candidates one at a time would read a large file eight times.
  final seen = <String>{};
  final length = text.length;

  for (var at = 0; at < length; at += 1) {
    final open = text.codeUnitAt(at);

    if (!_isOpener(open)) {
      continue;
    }

    var end = at + 1;

    while (end < length && text.codeUnitAt(end) == open) {
      end += 1;
    }

    var key = end;

    // `{{ name }}` is as common as `{{name}}`, and the space belongs to the
    // style rather than to the delimiter.
    while (key < length && text.codeUnitAt(key) == 0x20) {
      key += 1;
    }

    if (key < length && _isKeyStart(text.codeUnitAt(key))) {
      final opener = String.fromCharCode(open);

      // A run of three or more is read as the doubled form, the way a run of
      // one is read as the single one.
      seen.add(end - at > 1 ? '$opener$opener' : opener);

      // Nothing later in the text can outrank the first candidate, so a file
      // written in it is answered by its first placeholder.
      if (seen.contains(interpolationDelimiters.first.prefix)) {
        break;
      }
    }

    at = end - 1;
  }

  if (seen.isEmpty) {
    return null;
  }

  for (final candidate in interpolationDelimiters) {
    if (seen.contains(candidate.prefix)) {
      return candidate;
    }
  }

  return null;
}
