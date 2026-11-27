// The value primitives walk their values code unit by code unit rather than
// running a regular expression on each one, because Dart's patterns cost a call
// into the runtime every time they are asked anything. A report must not change
// for that, so every walk here is held to the pattern it replaced: over every
// code unit on its own, and over a large set of strings built from the
// characters that sit on an edge of one of them.

import 'dart:math';

import 'package:chki18n/chki18n.dart';
import 'package:chki18n/src/core/chars.dart';
import 'package:chki18n/src/core/value.dart';
import 'package:test/test.dart';

/// The zero of every set of decimal digits Unicode 17 defines. The same table
/// as `value.dart` and the other two packages, kept here so the pattern below is
/// built the way the package used to build it.
const List<int> _digitZeros = [
  0x30, 0x660, 0x6f0, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, //
  0xd66, 0xde6, 0xe50, 0xed0, 0xf20, 0x1040, 0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0, //
  0x1a80, 0x1a90, 0x1b50, 0x1bb0, 0x1c40, 0x1c50, 0xa620, 0xa8d0, 0xa900, 0xa9d0, //
  0xa9f0, 0xaa50, 0xabf0, 0xff10, 0x104a0, 0x10d30, 0x10d40, 0x11066, 0x110f0, //
  0x11136, 0x111d0, 0x112f0, 0x11450, 0x114d0, 0x11650, 0x116c0, 0x116d0, 0x116da, //
  0x11730, 0x118e0, 0x11950, 0x11bf0, 0x11c50, 0x11d50, 0x11da0, 0x11de0, 0x11f50, //
  0x16130, 0x16a60, 0x16ac0, 0x16b50, 0x16d70, 0x1ccf0, 0x1d7ce, 0x1d7d8, 0x1d7e2, //
  0x1d7ec, 0x1d7f6, 0x1e140, 0x1e2f0, 0x1e4f0, 0x1e5f1, 0x1e950, 0x1fbf0,
];

final String _digitClass =
    _digitZeros
        .map((zero) => '\\u{${zero.toRadixString(16)}}-\\u{${(zero + 9).toRadixString(16)}}')
        .join();

final RegExp _digitPattern = RegExp('[$_digitClass]', unicode: true);

final RegExp _numberPattern = RegExp('[$_digitClass]+', unicode: true);

final RegExp _invisiblePattern = RegExp(
  r'[\u00a0\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]',
);

final RegExp _spacePattern = RegExp(r'^\s$');

final RegExp _letterPattern = RegExp(r'\p{L}', unicode: true);

/// The locales whose script the package knows, and two it deliberately does not.
const List<String> _locales = [
  'am', 'ar', 'be', 'bg', 'bn', 'el', 'fa', 'he', 'hi', 'hy', 'ja', 'ka', 'kk', 'km', 'ko', //
  'ky', 'lo', 'mk', 'ml', 'mn', 'my', 'ne', 'ru', 'si', 'ta', 'te', 'th', 'uk', 'ur', 'zh', //
  'zh-Hant', 'sr-Latn', 'en',
];

/// The way `hasTranslatableText` read a value before it walked it.
bool _referenceHasText(String value, String prefix, String suffix) {
  var text = value.replaceAll(tagPattern, ' ');
  var start = text.indexOf(prefix);

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

/// The way `extractInterpolationKeys` read a value before it jumped between
/// delimiters: every position tried in turn.
List<String> _referenceKeys(String value, String prefix, String suffix) {
  final keyPattern = RegExp(r'^[A-Za-z0-9_$-]*$');
  final found = <String>[];
  final single = prefix.length == 1 && suffix.length == 1;

  if (value.length < prefix.length + suffix.length ||
      !value.contains(prefix) ||
      !value.contains(suffix) ||
      prefix == suffix) {
    return found;
  }

  bool isEscaped(int at) {
    var count = 0;

    for (var index = at - 1; index >= 0 && value[index] == r'\'; index -= 1) {
      count += 1;
    }

    return count.isOdd;
  }

  bool isDelimiter(int at, String delimiter) {
    if (at < 0 || at + delimiter.length > value.length) {
      return false;
    }

    if (value.substring(at, at + delimiter.length) != delimiter || isEscaped(at)) {
      return false;
    }

    return !single ||
        (!(at > 0 && value[at - 1] == delimiter) &&
            !(at + 1 < value.length && value[at + 1] == delimiter));
  }

  for (var at = 0; at <= value.length - prefix.length; at += 1) {
    if (!isDelimiter(at, prefix)) {
      continue;
    }

    final from = at + prefix.length;
    var close = -1;

    for (var index = from; index <= value.length - suffix.length; index += 1) {
      if (isDelimiter(index, suffix)) {
        close = index;
        break;
      }
    }

    if (close == -1) {
      continue;
    }

    final key = value.substring(from, close);

    if (!key.contains(prefix) && !key.contains(suffix) && keyPattern.hasMatch(key)) {
      found.add(key);
    }

    at = close + suffix.length - 1;
  }

  return found;
}

/// Characters on the edge of at least one of the walks: brackets, slashes and
/// delimiters, every kind of space, invisible marks, digits of several scripts
/// on both planes, letters of several scripts, and lone surrogates.
final List<String> _alphabet = [
  'a', 'Z', 'q', '0', '9', '/', '<', '>', ' ', '\t', '\n', '\r', '\v', '\f', //
  '{', '}', '[', ']', '%', r'\', r'$', '-', '_', '"', //
  '\u00a0', '\u1680', '\u2000', '\u200a', '\u200b', '\u200f', '\u2028', '\u2029', //
  '\u202a', '\u202f', '\u205f', '\u2060', '\u2066', '\u3000', '\ufeff', //
  '\u0660', '\u0669', '\u065f', '\u066a', '\u0966', '\uff10', '\uff19', //
  '\u{1d7ce}', '\u{1d7ff}', '\u{1fbf9}', '\u{1fbfa}', '\u{104a0}', //
  '\uac00', '\u3042', '\u4e00', '\u0416', '\u05d0', '\u0e01', '\u{1f600}', //
  '\ud800', '\udc00', '\u00e9', '\u0301',
];

List<String> _corpus() {
  final random = Random(20261127);
  final strings = <String>['', ...(_alphabet)];

  for (var count = 0; count < 20000; count += 1) {
    final length = random.nextInt(14);
    final buffer = StringBuffer();

    for (var index = 0; index < length; index += 1) {
      buffer.write(_alphabet[random.nextInt(_alphabet.length)]);
    }

    strings.add(buffer.toString());
  }

  return strings;
}

void main() {
  final corpus = _corpus();

  group('a single code unit', () {
    test('is whitespace exactly where `\\s` says it is', () {
      for (var unit = 0; unit <= 0xffff; unit += 1) {
        expect(
          isSpaceUnit(unit),
          _spacePattern.hasMatch(String.fromCharCode(unit)),
          reason: 'U+${unit.toRadixString(16)}',
        );
      }
    });

    test('is invisible exactly where the invisible class says it is', () {
      for (var unit = 0; unit <= 0xffff; unit += 1) {
        final char = String.fromCharCode(unit);

        expect(
          findInvisibleCharacter(char),
          _invisiblePattern.firstMatch(char)?[0],
          reason: 'U+${unit.toRadixString(16)}',
        );
      }
    });

    test('opens a tag exactly where the tag pattern says it does', () {
      for (var unit = 0; unit <= 0xffff; unit += 1) {
        final text = '<${String.fromCharCode(unit)}x>';

        expect(extractTags(text), [
          for (final match in tagPattern.allMatches(text)) match[0]!,
        ], reason: 'U+${unit.toRadixString(16)}');
      }
    });
  });

  group('a single code point', () {
    test('is a digit exactly where the digit class says it is', () {
      for (var code = 0; code <= 0x1ffff; code += 1) {
        if (code >= 0xd800 && code <= 0xdfff) {
          continue;
        }

        final char = String.fromCharCode(code);

        expect(hasDigit(char), _digitPattern.hasMatch(char), reason: 'U+${code.toRadixString(16)}');
      }
    });
  });

  group('every string of the corpus', () {
    test('holds the tags the tag pattern finds', () {
      for (final text in corpus) {
        expect(extractTags(text), [
          for (final match in tagPattern.allMatches(text)) match[0]!,
        ], reason: text.runes.toList().toString());
      }
    });

    test('holds a digit where the digit class finds one', () {
      for (final text in corpus) {
        expect(
          hasDigit(text),
          _digitPattern.hasMatch(text),
          reason: text.runes.toList().toString(),
        );
      }
    });

    test('holds the runs of digits the number pattern finds', () {
      for (final text in corpus) {
        expect(extractNumbers(text), [
          for (final match in _numberPattern.allMatches(text)) match[0]!,
        ], reason: text.runes.toList().toString());
      }
    });

    test('reads each run of digits as the ASCII digits it means', () {
      for (final text in corpus) {
        for (final number in extractNumbers(text)) {
          final expected = String.fromCharCodes([
            for (final code in number.runes)
              0x30 + code - _digitZeros.lastWhere((zero) => zero <= code),
          ]);

          expect(asciiDigitsOf(number), expected, reason: number.runes.toList().toString());
        }
      }
    });

    test('holds the invisible character the invisible class finds first', () {
      for (final text in corpus) {
        expect(
          findInvisibleCharacter(text),
          _invisiblePattern.firstMatch(text)?[0],
          reason: text.runes.toList().toString(),
        );
      }
    });

    test('is written in a script where its pattern says it is', () {
      for (final locale in _locales) {
        final ranges = scriptRangesOfLocale(locale);
        final pattern = scriptOfLocale(locale);

        expect(ranges == null, pattern == null, reason: locale);

        if (ranges == null || pattern == null) {
          continue;
        }

        for (final text in corpus) {
          expect(holdsScript(text, ranges), pattern.hasMatch(text), reason: '$locale $text');
        }
      }
    });

    test('holds words of its own where the old reading found them', () {
      for (final text in corpus) {
        expect(
          hasTranslatableText(text, '{', '}'),
          _referenceHasText(text, '{', '}'),
          reason: text.runes.toList().toString(),
        );
        expect(
          hasTranslatableText(text, '%{', '}'),
          _referenceHasText(text, '%{', '}'),
          reason: text.runes.toList().toString(),
        );
      }
    });

    test('holds the placeholders the old position by position walk found', () {
      const delimiters = [('{', '}'), ('{{', '}}'), ('%{', '}'), ('[', ']'), ('{', '}}')];

      for (final text in corpus) {
        for (final (prefix, suffix) in delimiters) {
          expect(
            extractInterpolationKeys(text, prefix, suffix),
            _referenceKeys(text, prefix, suffix),
            reason: '$prefix$suffix ${text.runes.toList()}',
          );
        }
      }
    });
  });
}
