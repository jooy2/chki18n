/// What a translation value can be measured on beyond its text: the markup it
/// carries, the numbers in it, the characters nothing will draw, and the script
/// it is written in.
///
/// Kept apart from the analyzer so each one can be tested and reused on its
/// own. Every character class here is written as escapes rather than as the
/// characters themselves. Some of them are invisible, and a source file that
/// holds one is a source file nobody can review.
library;

import 'package:chki18n/src/core/chars.dart';

/// Shared empty result so a value with nothing to find never allocates.
const List<String> _nothing = [];

/// Markup tags, as they are written. The character after the `<` may not be a
/// space, so prose comparing two numbers is not mistaken for a tag.
///
/// This is the definition [extractTags] follows. It walks the value itself
/// rather than running the pattern, and the tests hold the two to the same
/// answer.
final RegExp tagPattern = RegExp(r'</?[^<>\s][^<>]*>');

/// The zero of every set of decimal digits Unicode 17 defines, each followed by
/// the nine digits after it. A translation into Arabic, Hindi or Japanese often
/// writes its numbers in that language's own digits, and `٣` says the same as
/// `3`. Written out rather than read from the runtime: each package runs on a
/// different Unicode version, and the three must agree on what a digit is.
const List<int> _digitZeros = [
  0x30,
  0x660,
  0x6f0,
  0x7c0,
  0x966,
  0x9e6,
  0xa66,
  0xae6,
  0xb66,
  0xbe6,
  0xc66,
  0xce6,
  0xd66,
  0xde6,
  0xe50,
  0xed0,
  0xf20,
  0x1040,
  0x1090,
  0x17e0,
  0x1810,
  0x1946,
  0x19d0,
  0x1a80,
  0x1a90,
  0x1b50,
  0x1bb0,
  0x1c40,
  0x1c50,
  0xa620,
  0xa8d0,
  0xa900,
  0xa9d0,
  0xa9f0,
  0xaa50,
  0xabf0,
  0xff10,
  0x104a0,
  0x10d30,
  0x10d40,
  0x11066,
  0x110f0,
  0x11136,
  0x111d0,
  0x112f0,
  0x11450,
  0x114d0,
  0x11650,
  0x116c0,
  0x116d0,
  0x116da,
  0x11730,
  0x118e0,
  0x11950,
  0x11bf0,
  0x11c50,
  0x11d50,
  0x11da0,
  0x11de0,
  0x11f50,
  0x16130,
  0x16a60,
  0x16ac0,
  0x16b50,
  0x16d70,
  0x1ccf0,
  0x1d7ce,
  0x1d7d8,
  0x1d7e2,
  0x1d7ec,
  0x1d7f6,
  0x1e140,
  0x1e2f0,
  0x1e4f0,
  0x1e5f1,
  0x1e950,
  0x1fbf0,
];

/// The first digit outside ASCII. Below it, a code unit that is not `0` to `9`
/// is no digit of any script, and that is every character of a Latin, Greek or
/// Cyrillic value.
const int _firstWideDigit = 0x660;

/// The index of the last zero at or below [code], which is the set of digits
/// [code] would belong to if it were a digit at all.
int _zeroIndexOf(int code) {
  var low = 0;
  var high = _digitZeros.length - 1;

  while (low < high) {
    final middle = (low + high + 1) >> 1;

    if (_digitZeros[middle] <= code) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return low;
}

/// The value of a digit of any script, or `-1` for a character that is not one.
///
/// Read off the table rather than matched against a character class built from
/// it. The class had 77 ranges, most of them outside the Basic Multilingual
/// Plane, and asking it of every value made it the slowest step of an analysis.
int _digitValueOf(int code) {
  if (code >= 0x30 && code <= 0x39) {
    return code - 0x30;
  }

  if (code < _firstWideDigit) {
    return -1;
  }

  final digit = code - _digitZeros[_zeroIndexOf(code)];

  return digit <= 9 ? digit : -1;
}

/// Whether [unit] is a character nothing will draw: a zero width joiner or
/// space, the byte order mark, or one of the bidirectional controls a copy out
/// of a right-to-left editor leaves behind. The non-breaking space is here too,
/// because it looks exactly like the ordinary space it is not.
bool _isInvisible(int unit) =>
    unit == 0xa0 ||
    (unit >= 0x200b && unit <= 0x200f) ||
    (unit >= 0x202a && unit <= 0x202e) ||
    (unit >= 0x2060 && unit <= 0x2064) ||
    (unit >= 0x2066 && unit <= 0x2069) ||
    unit == 0xfeff;

const Map<String, String> _namedInvisible = {
  '\u00a0': 'a non-breaking space',
  '\u200b': 'a zero width space',
  '\u200c': 'a zero width non-joiner',
  '\u200d': 'a zero width joiner',
  '\u200e': 'a left-to-right mark',
  '\u200f': 'a right-to-left mark',
  '\ufeff': 'a byte order mark',
};

final RegExp _letterPattern = RegExp(r'\p{L}', unicode: true);

final RegExp _subtagSeparator = RegExp('[-_]');

/// The script each language is written in, as the first and last code unit of
/// each of its blocks in ascending order, for the languages whose script says
/// something a comparison can act on. Every block is in the Basic Multilingual
/// Plane, so a value is tested one code unit at a time.
///
/// A language written in the Latin alphabet is left out: there would be nothing
/// to tell it apart from an English string nobody translated.
const Map<String, List<int>> _scriptOfLanguage = {
  'am': [0x1200, 0x137f],
  'ar': [0x0600, 0x06ff, 0x0750, 0x077f, 0x08a0, 0x08ff],
  'be': [0x0400, 0x04ff],
  'bg': [0x0400, 0x04ff],
  'bn': [0x0980, 0x09ff],
  'el': [0x0370, 0x03ff, 0x1f00, 0x1fff],
  'fa': [0x0600, 0x06ff, 0x0750, 0x077f],
  'he': [0x0590, 0x05ff],
  'hi': [0x0900, 0x097f],
  'hy': [0x0530, 0x058f],
  'ja': [0x3040, 0x30ff, 0x31f0, 0x31ff, 0x4e00, 0x9fff],
  'ka': [0x10a0, 0x10ff],
  'kk': [0x0400, 0x04ff],
  'km': [0x1780, 0x17ff],
  'ko': [0x1100, 0x11ff, 0x3130, 0x318f, 0xac00, 0xd7af],
  'ky': [0x0400, 0x04ff],
  'lo': [0x0e80, 0x0eff],
  'mk': [0x0400, 0x04ff],
  'ml': [0x0d00, 0x0d7f],
  'mn': [0x0400, 0x04ff],
  'my': [0x1000, 0x109f],
  'ne': [0x0900, 0x097f],
  'ru': [0x0400, 0x04ff],
  'si': [0x0d80, 0x0dff],
  'ta': [0x0b80, 0x0bff],
  'te': [0x0c00, 0x0c7f],
  'th': [0x0e00, 0x0e7f],
  'uk': [0x0400, 0x04ff],
  'ur': [0x0600, 0x06ff, 0x0750, 0x077f],
  'zh': [0x3400, 0x4dbf, 0x4e00, 0x9fff, 0xf900, 0xfaff],
};

final Map<String, List<int>?> _scriptRangesCache = {};

final Map<String, RegExp?> _scriptPatternCache = {};

/// A code unit as a regular expression escape, `؀`.
String _escapeUnit(int unit) => '\\u${unit.toRadixString(16).padLeft(4, '0')}';

/// Whether [unit] may follow the `<` of a tag: anything but another bracket or
/// whitespace, so prose comparing two numbers is not mistaken for a tag.
bool _canStartTagName(int unit) => unit != 0x3c && unit != 0x3e && !isSpaceUnit(unit);

/// The end of the tag whose `<` is at [start], or `-1` when that `<` opens none.
///
/// Reads [tagPattern] the way a regular expression engine does, backtracking
/// included: the slash is a closing mark only when a name follows it, so in
/// `</>` and `</ b>` the slash is the name itself.
int _tagEndAt(String value, int start) {
  final length = value.length;
  var index = start + 1;

  if (index >= length) {
    return -1;
  }

  if (value.codeUnitAt(index) == 0x2f &&
      index + 1 < length &&
      _canStartTagName(value.codeUnitAt(index + 1))) {
    index += 1;
  } else if (!_canStartTagName(value.codeUnitAt(index))) {
    return -1;
  }

  for (index += 1; index < length; index += 1) {
    final unit = value.codeUnitAt(index);

    if (unit == 0x3e) {
      return index + 1;
    }

    if (unit == 0x3c) {
      return -1;
    }
  }

  return -1;
}

/// [value] with each tag replaced by a space, or [value] itself when it holds
/// none.
String _withoutTags(String value) {
  var start = value.indexOf('<');
  var copied = 0;
  StringBuffer? text;

  while (start != -1) {
    final end = _tagEndAt(value, start);

    if (end == -1) {
      start = value.indexOf('<', start + 1);
      continue;
    }

    (text ??= StringBuffer())
      ..write(value.substring(copied, start))
      ..write(' ');
    copied = end;
    start = value.indexOf('<', end);
  }

  if (text == null) {
    return value;
  }

  text.write(value.substring(copied));

  return text.toString();
}

/// Whether [text] holds a letter of any script. An ASCII letter answers on the
/// spot; only a value with characters beyond ASCII and none of its letters is
/// left to the Unicode letter class.
bool _hasLetter(String text) {
  var wide = false;

  for (var index = 0; index < text.length; index += 1) {
    final unit = text.codeUnitAt(index);
    final lower = unit | 0x20;

    if (lower >= 0x61 && lower <= 0x7a) {
      return true;
    }

    if (unit >= 0x80) {
      wide = true;
    }
  }

  return wide && _letterPattern.hasMatch(text);
}

/// Markup tags a value carries, in the order they appear.
List<String> extractTags(String value) {
  var start = value.indexOf('<');
  List<String>? tags;

  while (start != -1) {
    final end = _tagEndAt(value, start);

    if (end == -1) {
      start = value.indexOf('<', start + 1);
      continue;
    }

    (tags ??= <String>[]).add(value.substring(start, end));
    start = value.indexOf('<', end);
  }

  return tags ?? _nothing;
}

/// Whether a value holds a digit of any script.
bool hasDigit(String value) {
  for (var index = 0; index < value.length; index += 1) {
    final unit = value.codeUnitAt(index);

    if (unit < _firstWideDigit) {
      if (unit >= 0x30 && unit <= 0x39) {
        return true;
      }

      continue;
    }

    final code = codePointAt(value, index);

    if (_digitValueOf(code) != -1) {
      return true;
    }

    if (code > 0xffff) {
      index += 1;
    }
  }

  return false;
}

/// Runs of digits a value carries, as they are written and as text so `03` and
/// `3` stay apart. A run may be written in any script's digits.
List<String> extractNumbers(String value) {
  final length = value.length;
  var start = -1;
  List<String>? numbers;

  for (var index = 0; index < length; index += 1) {
    final unit = value.codeUnitAt(index);
    var code = unit;
    var isDigit = false;

    if (unit < _firstWideDigit) {
      isDigit = unit >= 0x30 && unit <= 0x39;
    } else {
      code = codePointAt(value, index);
      isDigit = _digitValueOf(code) != -1;
    }

    if (isDigit && start == -1) {
      start = index;
    } else if (!isDigit && start != -1) {
      (numbers ??= <String>[]).add(value.substring(start, index));
      start = -1;
    }

    if (code > 0xffff) {
      index += 1;
    }
  }

  if (start != -1) {
    (numbers ??= <String>[]).add(value.substring(start));
  }

  return numbers ?? _nothing;
}

/// A run of digits in ASCII, so `٠٣` and `03` compare equal.
String asciiDigitsOf(String digits) {
  var ascii = true;

  for (var index = 0; index < digits.length; index += 1) {
    final unit = digits.codeUnitAt(index);

    if (unit < 0x30 || unit > 0x39) {
      ascii = false;
      break;
    }
  }

  if (ascii) {
    return digits;
  }

  final units = <int>[];

  for (var index = 0; index < digits.length; index += 1) {
    final code = codePointAt(digits, index);

    // The zero of its set is the one the digit counts up from.
    units.add(0x30 + code - _digitZeros[_zeroIndexOf(code)]);

    if (code > 0xffff) {
      index += 1;
    }
  }

  return String.fromCharCodes(units);
}

/// The first character in a value that nothing will draw, if there is one.
String? findInvisibleCharacter(String value) {
  for (var index = 0; index < value.length; index += 1) {
    final unit = value.codeUnitAt(index);

    if (unit >= 0xa0 && _isInvisible(unit)) {
      return value[index];
    }
  }

  return null;
}

/// How to name an invisible character in a message, since it cannot be shown.
String nameOfInvisibleCharacter(String char) {
  final code = (char.runes.isEmpty ? 0 : char.runes.first)
      .toRadixString(16)
      .toUpperCase()
      .padLeft(4, '0');

  return '${_namedInvisible[char] ?? 'a bidirectional control'} (U+$code)';
}

/// The blocks of the script a locale's translations are expected to be written
/// in, as [_scriptOfLanguage] lists them, or `null` when the locale writes in
/// the Latin alphabet, is not listed, or names a script of its own — `sr-Latn`
/// is Serbian written in Latin, and asking it for Cyrillic would be wrong.
List<int>? scriptRangesOfLocale(String locale) {
  // Asked once per value of every locale, and the answer only ever depends on
  // the tag. A project has a handful of locales, so the cache stays tiny.
  if (_scriptRangesCache.containsKey(locale)) {
    return _scriptRangesCache[locale];
  }

  final parts = locale.toLowerCase().split(_subtagSeparator);
  final ranges = parts.contains('latn') ? null : _scriptOfLanguage[parts.first];

  _scriptRangesCache[locale] = ranges;

  return ranges;
}

/// Whether [value] holds a character of one of the blocks in [ranges].
bool holdsScript(String value, List<int> ranges) {
  final lowest = ranges[0];

  for (var index = 0; index < value.length; index += 1) {
    final unit = value.codeUnitAt(index);

    if (unit < lowest) {
      continue;
    }

    for (var range = 0; range < ranges.length; range += 2) {
      if (unit >= ranges[range] && unit <= ranges[range + 1]) {
        return true;
      }
    }
  }

  return false;
}

/// The script a locale's translations are expected to be written in, as a
/// pattern that matches one of its characters, or `null` when
/// [scriptRangesOfLocale] has no script for it.
RegExp? scriptOfLocale(String locale) {
  if (_scriptPatternCache.containsKey(locale)) {
    return _scriptPatternCache[locale];
  }

  final ranges = scriptRangesOfLocale(locale);
  RegExp? pattern;

  if (ranges != null) {
    final blocks = StringBuffer();

    for (var index = 0; index < ranges.length; index += 2) {
      blocks.write('${_escapeUnit(ranges[index])}-${_escapeUnit(ranges[index + 1])}');
    }

    pattern = RegExp('[$blocks]');
  }

  _scriptPatternCache[locale] = pattern;

  return pattern;
}

/// Whether a value holds a word of its own, once the parts that are never
/// translated are taken out.
///
/// A value that is only a placeholder, a tag or a number cannot be judged on
/// the script it is written in.
bool hasTranslatableText(String value, String prefix, String suffix) {
  var text = _withoutTags(value);
  var start = text.indexOf(prefix);

  // A placeholder name is written by the developer and stays in English, so
  // leaving it in would let it answer for the whole value.
  while (start != -1) {
    final end = text.indexOf(suffix, start + prefix.length);

    if (end == -1) {
      break;
    }

    text = '${text.substring(0, start)} ${text.substring(end + suffix.length)}';
    start = text.indexOf(prefix);
  }

  return _hasLetter(text);
}
