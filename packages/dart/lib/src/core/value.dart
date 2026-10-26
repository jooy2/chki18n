/// What a translation value can be measured on beyond its text: the markup it
/// carries, the numbers in it, the characters nothing will draw, and the script
/// it is written in.
///
/// Kept apart from the analyzer so each one can be tested and reused on its
/// own. Every character class here is written as escapes rather than as the
/// characters themselves. Some of them are invisible, and a source file that
/// holds one is a source file nobody can review.
library;

/// Shared empty result so a value with nothing to find never allocates.
const List<String> _nothing = [];

/// Markup tags, as they are written. The character after the `<` may not be a
/// space, so prose comparing two numbers is not mistaken for a tag.
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

final String _digitClass =
    _digitZeros
        .map((zero) => '\\u{${zero.toRadixString(16)}}-\\u{${(zero + 9).toRadixString(16)}}')
        .join();

final RegExp _numberPattern = RegExp('[$_digitClass]+', unicode: true);

final RegExp _digitPattern = RegExp('[$_digitClass]', unicode: true);

final RegExp _asciiNumberPattern = RegExp(r'^[0-9]+$');

/// Characters that take no space and are invisible in a review: zero width
/// joiners and spaces, the byte order mark, and the bidirectional controls a
/// copy out of a right-to-left editor leaves behind. The non-breaking space is
/// here too, because it looks exactly like the ordinary space it is not.
final RegExp _invisiblePattern = RegExp(
  r'[\u00a0\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]',
);

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

final Map<String, RegExp?> _scriptCache = {};

final RegExp _subtagSeparator = RegExp('[-_]');

/// The script each language is written in, for the languages whose script says
/// something a comparison can act on.
///
/// A language written in the Latin alphabet is left out: there would be nothing
/// to tell it apart from an English string nobody translated.
final Map<String, RegExp> _scriptOfLanguage = {
  'am': RegExp(r'[\u1200-\u137f]'),
  'ar': RegExp(r'[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]'),
  'be': RegExp(r'[\u0400-\u04ff]'),
  'bg': RegExp(r'[\u0400-\u04ff]'),
  'bn': RegExp(r'[\u0980-\u09ff]'),
  'el': RegExp(r'[\u0370-\u03ff\u1f00-\u1fff]'),
  'fa': RegExp(r'[\u0600-\u06ff\u0750-\u077f]'),
  'he': RegExp(r'[\u0590-\u05ff]'),
  'hi': RegExp(r'[\u0900-\u097f]'),
  'hy': RegExp(r'[\u0530-\u058f]'),
  'ja': RegExp(r'[\u3040-\u30ff\u31f0-\u31ff\u4e00-\u9fff]'),
  'ka': RegExp(r'[\u10a0-\u10ff]'),
  'kk': RegExp(r'[\u0400-\u04ff]'),
  'km': RegExp(r'[\u1780-\u17ff]'),
  'ko': RegExp(r'[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]'),
  'ky': RegExp(r'[\u0400-\u04ff]'),
  'lo': RegExp(r'[\u0e80-\u0eff]'),
  'mk': RegExp(r'[\u0400-\u04ff]'),
  'ml': RegExp(r'[\u0d00-\u0d7f]'),
  'mn': RegExp(r'[\u0400-\u04ff]'),
  'my': RegExp(r'[\u1000-\u109f]'),
  'ne': RegExp(r'[\u0900-\u097f]'),
  'ru': RegExp(r'[\u0400-\u04ff]'),
  'si': RegExp(r'[\u0d80-\u0dff]'),
  'ta': RegExp(r'[\u0b80-\u0bff]'),
  'te': RegExp(r'[\u0c00-\u0c7f]'),
  'th': RegExp(r'[\u0e00-\u0e7f]'),
  'uk': RegExp(r'[\u0400-\u04ff]'),
  'ur': RegExp(r'[\u0600-\u06ff\u0750-\u077f]'),
  'zh': RegExp(r'[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]'),
};

/// Markup tags a value carries, in the order they appear.
List<String> extractTags(String value) {
  if (!value.contains('<')) {
    return _nothing;
  }

  return [for (final match in tagPattern.allMatches(value)) match[0]!];
}

/// Whether a value holds a digit of any script.
bool hasDigit(String value) => _digitPattern.hasMatch(value);

/// Runs of digits a value carries, as they are written and as text so `03` and
/// `3` stay apart. A run may be written in any script's digits.
List<String> extractNumbers(String value) {
  return [for (final match in _numberPattern.allMatches(value)) match[0]!];
}

/// A run of digits in ASCII, so `٠٣` and `03` compare equal.
String asciiDigitsOf(String digits) {
  if (_asciiNumberPattern.hasMatch(digits)) {
    return digits;
  }

  final ascii = StringBuffer();

  for (final code in digits.runes) {
    var low = 0;
    var high = _digitZeros.length - 1;

    // The last zero at or below the digit is the one its set starts from.
    while (low < high) {
      final middle = (low + high + 1) >> 1;

      if (_digitZeros[middle] <= code) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }

    ascii.writeCharCode(0x30 + code - _digitZeros[low]);
  }

  return ascii.toString();
}

/// The first character in a value that nothing will draw, if there is one.
String? findInvisibleCharacter(String value) {
  final found = _invisiblePattern.firstMatch(value);

  return found?[0];
}

/// How to name an invisible character in a message, since it cannot be shown.
String nameOfInvisibleCharacter(String char) {
  final code = (char.runes.isEmpty ? 0 : char.runes.first)
      .toRadixString(16)
      .toUpperCase()
      .padLeft(4, '0');

  return '${_namedInvisible[char] ?? 'a bidirectional control'} (U+$code)';
}

/// The script a locale's translations are expected to be written in, or `null`
/// when the locale writes in the Latin alphabet, is not listed, or names a
/// script of its own — `sr-Latn` is Serbian written in Latin, and asking it for
/// Cyrillic would be wrong.
RegExp? scriptOfLocale(String locale) {
  // Asked once per value of every locale, and the answer only ever depends on
  // the tag. A project has a handful of locales, so the cache stays tiny.
  if (_scriptCache.containsKey(locale)) {
    return _scriptCache[locale];
  }

  final parts = locale.toLowerCase().split(_subtagSeparator);
  final script = parts.contains('latn') ? null : _scriptOfLanguage[parts.first];

  _scriptCache[locale] = script;

  return script;
}

/// Whether a value holds a word of its own, once the parts that are never
/// translated are taken out.
///
/// A value that is only a placeholder, a tag or a number cannot be judged on
/// the script it is written in.
bool hasTranslatableText(String value, String prefix, String suffix) {
  var text = value.replaceAll(tagPattern, ' ');
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

  return _letterPattern.hasMatch(text);
}
