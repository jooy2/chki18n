// The report measures and cuts every line it draws, so those helpers read code
// units rather than iterating `runes` or running a pattern. Each is held here to
// the way it used to answer, over strings built from the characters that sit on
// an edge of one of them: spaces of every kind, marks of no width, wide
// characters on both planes, and lone surrogates.

import 'dart:math';

import 'package:chki18n/chki18n.dart';
import 'package:chki18n/src/reporter/text.dart' show oneLine, truncateStart, wrap;
import 'package:test/test.dart';

final RegExp _whitespaceRun = RegExp(r'\s+');

int _referenceWidth(String text) => text.runes.fold(0, (width, rune) {
  return width + charWidth(String.fromCharCode(rune));
});

String _referenceTruncate(String text, int max) {
  if (_referenceWidth(text) <= max) {
    return text;
  }

  final room = max - 3 > 1 ? max - 3 : 1;
  final kept = StringBuffer();
  var width = 0;

  for (final rune in text.runes) {
    final char = String.fromCharCode(rune);
    final next = width + charWidth(char);

    if (next > room) {
      break;
    }

    width = next;
    kept.write(char);
  }

  return '$kept...';
}

String _referenceTruncateStart(String text, int max) {
  if (_referenceWidth(text) <= max) {
    return text;
  }

  final characters = text.runes.toList();
  final room = max - 3 > 1 ? max - 3 : 1;
  var width = 0;
  var kept = '';

  for (var index = characters.length - 1; index >= 0; index -= 1) {
    final char = String.fromCharCode(characters[index]);
    final next = width + charWidth(char);

    if (next > room) {
      break;
    }

    width = next;
    kept = '$char$kept';
  }

  return '...$kept';
}

List<String> _referenceWrap(String text, int width) {
  if (width < 8) {
    return [text];
  }

  final lines = <String>[];
  var line = '';

  for (final word in text.split(' ')) {
    if (line.isEmpty) {
      line = word;
    } else if (_referenceWidth(line) + 1 + _referenceWidth(word) > width) {
      lines.add(line);
      line = word;
    } else {
      line = '$line $word';
    }
  }

  if (line.isNotEmpty) {
    lines.add(line);
  }

  return lines;
}

final List<String> _alphabet = [
  'a', 'Z', '0', '.', ' ', ' ', ' ', '\t', '\n', '\r', '\v', '\f', //
  '\u00a0', '\u1680', '\u2000', '\u200a', '\u200b', '\u2028', '\u202f', '\u3000', '\ufeff', //
  '\u0301', '\u0e31', '\u1160', '\ufe0f', '\u{e0100}', //
  '\uac00', '\u3042', '\u4e00', '\uff01', '\u{20000}', '\u{1f600}', '\u{1f9ff}', //
  '\u00e9', '\u0416', '\ud800', '\udc00',
];

List<String> _corpus() {
  final random = Random(20261127);
  final strings = <String>['', ..._alphabet];

  for (var count = 0; count < 20000; count += 1) {
    final length = random.nextInt(24);
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

  test('a string is as wide as its characters, one at a time', () {
    for (final text in corpus) {
      expect(displayWidth(text), _referenceWidth(text), reason: text.runes.toList().toString());
    }
  });

  test('a value is put on one line the way `\\s+` would put it', () {
    for (final text in corpus) {
      expect(
        oneLine(text),
        text.replaceAll(_whitespaceRun, ' '),
        reason: text.runes.toList().toString(),
      );
    }
  });

  test('a value is cut at the end where it always was', () {
    for (final text in corpus) {
      for (final max in const [0, 1, 4, 5, 8, 13]) {
        expect(
          truncate(text, max),
          _referenceTruncate(text, max),
          reason: '$max ${text.runes.toList()}',
        );
      }
    }
  });

  test('a value is cut at the start where it always was', () {
    for (final text in corpus) {
      for (final max in const [0, 1, 4, 5, 8, 13]) {
        expect(
          truncateStart(text, max),
          _referenceTruncateStart(text, max),
          reason: '$max ${text.runes.toList()}',
        );
      }
    }
  });

  test('a value is wrapped where it always was', () {
    for (final text in corpus) {
      for (final width in const [7, 8, 10, 16]) {
        expect(
          wrap(text, width),
          _referenceWrap(text, width),
          reason: '$width ${text.runes.toList()}',
        );
      }
    }
  });
}
