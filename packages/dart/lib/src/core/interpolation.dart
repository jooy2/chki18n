/// The placeholders a translation value carries.
library;

/// Shared empty result so the fast path never allocates.
const List<String> _noKeys = [];

/// A placeholder name is written by a developer, so it is spelled the way an
/// identifier is. Anything else between the delimiters is prose that happens to
/// sit between them, not a placeholder.
final RegExp _keyPattern = RegExp(r'^[A-Za-z0-9_$-]*$');

/// Whether the delimiter at [at] is escaped by an odd number of backslashes.
bool _isEscaped(String text, int at) {
  var count = 0;

  for (var index = at - 1; index >= 0 && text[index] == r'\'; index -= 1) {
    count += 1;
  }

  return count.isOdd;
}

/// Interpolation keys used by a value, e.g. `['name']` for `Hello {name}`.
///
/// The scan walks the string character by character, which is the single most
/// repeated operation of an analysis, so values that cannot possibly hold a
/// placeholder are rejected up front by one `indexOf`.
///
/// A doubled single-character delimiter is not a delimiter: `{{name}}` holds no
/// key as far as `{` and `}` are concerned, which is what makes
/// `interpolationPrefix: '{{'` a real setting rather than a formality.
List<String> extractInterpolationKeys(Object? value, String prefix, String suffix) {
  if (value is! String || value.length < prefix.length + suffix.length) {
    return _noKeys;
  }

  if (!value.contains(prefix) || !value.contains(suffix)) {
    return _noKeys;
  }

  if (prefix.isEmpty || suffix.isEmpty || prefix == suffix) {
    return _noKeys;
  }

  final found = <String>[];
  final length = value.length;
  final prefixLength = prefix.length;
  final suffixLength = suffix.length;
  final single = prefixLength == 1 && suffixLength == 1;

  bool isPrefix(int at) {
    if (at < 0 || at + prefixLength > length) {
      return false;
    }

    if (value.substring(at, at + prefixLength) != prefix) {
      return false;
    }

    if (_isEscaped(value, at)) {
      return false;
    }

    if (single) {
      if (at > 0 && value[at - 1] == prefix) {
        return false;
      }

      if (at + 1 < length && value[at + 1] == prefix) {
        return false;
      }
    }

    return true;
  }

  bool isSuffix(int at) {
    if (at < 0 || at + suffixLength > length) {
      return false;
    }

    if (value.substring(at, at + suffixLength) != suffix) {
      return false;
    }

    if (_isEscaped(value, at)) {
      return false;
    }

    if (single) {
      if (at > 0 && value[at - 1] == suffix) {
        return false;
      }

      if (at + 1 < length && value[at + 1] == suffix) {
        return false;
      }
    }

    return true;
  }

  for (var at = 0; at <= length - prefixLength; at += 1) {
    if (!isPrefix(at)) {
      continue;
    }

    final from = at + prefixLength;
    var closeAt = -1;

    for (var index = from; index <= length - suffixLength; index += 1) {
      if (isSuffix(index)) {
        closeAt = index;
        break;
      }
    }

    if (closeAt == -1) {
      continue;
    }

    final key = value.substring(from, closeAt);

    if (!key.contains('\n') &&
        !key.contains('\r') &&
        !key.contains(prefix) &&
        !key.contains(suffix) &&
        _keyPattern.hasMatch(key)) {
      found.add(key);
    }

    at = closeAt + suffixLength - 1;
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

/// The opening characters of every pair above, as one test per character.
bool _isOpener(String character) =>
    character == '{' || character == '[' || character == '(' || character == '<';

/// Whether [character] can start an interpolation key, which is how a
/// placeholder name is spelled everywhere else in this library.
///
/// Deliberately narrow: it is what tells `{name}` apart from the `{"` of the
/// JSON holding it, which is the whole reason this can be pointed at a file's
/// raw text.
bool _isKeyStart(String character) =>
    (character.compareTo('a') >= 0 && character.compareTo('z') <= 0) ||
    (character.compareTo('A') >= 0 && character.compareTo('Z') <= 0) ||
    (character.compareTo('0') >= 0 && character.compareTo('9') <= 0) ||
    character == '_' ||
    character == r'$';

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
    final open = text[at];

    if (!_isOpener(open)) {
      continue;
    }

    var end = at + 1;

    while (end < length && text[end] == open) {
      end += 1;
    }

    var key = end;

    // `{{ name }}` is as common as `{{name}}`, and the space belongs to the
    // style rather than to the delimiter.
    while (key < length && text[key] == ' ') {
      key += 1;
    }

    if (key < length && _isKeyStart(text[key])) {
      // A run of three or more is read as the doubled form, the way a run of
      // one is read as the single one.
      seen.add(end - at > 1 ? '$open$open' : open);

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
