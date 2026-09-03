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

final RegExp _numberPattern = RegExp(r'\d+');

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

/// Runs of digits a value carries, as text so `03` and `3` stay apart.
List<String> extractNumbers(String value) {
  return [for (final match in _numberPattern.allMatches(value)) match[0]!];
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
