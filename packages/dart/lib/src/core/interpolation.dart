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
