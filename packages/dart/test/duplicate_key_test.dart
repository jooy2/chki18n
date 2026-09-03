import 'package:chki18n/chki18n.dart';
import 'package:chki18n/src/loader/json_duplicates.dart';
import 'package:test/test.dart';

String samplePath(String name) => 'test/samples/$name';

void main() {
  group('findDuplicateKeys', () {
    test('finds a nested key colliding with a dotted one', () {
      expect(
        findDuplicateKeys(const {
          'a': {'b': 1},
          'a.b': 2,
        }),
        ['a.b'],
      );
    });

    test('finds an array index colliding with a dotted key', () {
      expect(
        findDuplicateKeys(const {
          'a': ['x'],
          'a.0': 'y',
        }),
        ['a.0'],
      );
    });

    test('says nothing about translations that collide with nothing', () {
      expect(
        findDuplicateKeys(const {
          'a': {'b': 1},
          'c': 2,
        }),
        isEmpty,
      );
      expect(findDuplicateKeys(const {'a': <String, Object?>{}, 'b': <Object?>[]}), isEmpty);
    });

    test('treats an empty object as a leaf, the way flattening does', () {
      expect(
        findDuplicateKeys(const {
          'a': {'b': <String, Object?>{}},
          'a.b': 1,
        }),
        ['a.b'],
      );
    });
  });

  group('flattenTranslations', () {
    test('joins every level with a dot, and keeps an empty branch as a leaf', () {
      expect(
        flattenTranslations(const {
          'a': {'b': 1},
          'c': ['x', 'y'],
          'd': <String, Object?>{},
        }),
        {'a.b': 1, 'c.0': 'x', 'c.1': 'y', 'd': <String, Object?>{}},
      );
    });
  });

  group('findDuplicateJsonKeys', () {
    test('finds a key written twice in one object', () {
      expect(findDuplicateJsonKeys('{"a": 1, "a": 2}'), [const Chki18nJsonDuplicateKey('a', 1)]);
    });

    test('reports the line the second definition is on', () {
      expect(findDuplicateJsonKeys('{\n  "a": 1,\n\n  "a": 2\n}').first.line, 4);
    });

    test('reports the path of a nested duplicate', () {
      expect(findDuplicateJsonKeys('{"x": {"a": 1, "a": 2}}'), [
        const Chki18nJsonDuplicateKey('x.a', 1),
      ]);
    });

    test('does not confuse the same key in two different objects', () {
      expect(findDuplicateJsonKeys('{"x": {"a": 1}, "y": {"a": 2}}'), isEmpty);
    });

    test('ignores strings that only look like keys', () {
      expect(findDuplicateJsonKeys('{"a": "b", "b": "b"}'), isEmpty);
      expect(findDuplicateJsonKeys('{"a": ["k", "k"]}'), isEmpty);
    });

    test('reads escaped quotes as part of the string', () {
      expect(findDuplicateJsonKeys(r'{"a\"b": 1, "c": 2}'), isEmpty);
      expect(findDuplicateJsonKeys(r'{"a\"b": 1, "a\"b": 2}').length, 1);
    });
  });

  group('DUPLICATE_KEY', () {
    test('reports both a literal duplicate and a flatten collision', () async {
      final result = await checkTranslationFiles(
        path: samplePath('locales-duplicate-key'),
        options: const Chki18nOptions(target: 'en'),
      );
      final issues = result.of(Chki18nCheckCode.duplicateKey);

      expect(result.success, isFalse);
      expect([for (final issue in issues) issue.key]..sort(), ['attr.folder', 'desc.hello']);
      expect(issues.first.level, Chki18nLevel.error);
      expect(issues.first.locale, 'en');
      expect(issues.any((issue) => issue.message.contains('line 4')), isTrue);
    });

    test('strips the locale prefix in a nested file', () async {
      final result = await checkTranslationFiles(
        path: samplePath('locales-nested-duplicate'),
        options: const Chki18nOptions(target: 'en'),
      );
      final issue = result.of(Chki18nCheckCode.duplicateKey).first;

      expect(issue.key, 'greeting');
      expect(issue.locale, 'en');
    });

    test('finds a collision in translations passed in directly', () {
      final result = analyzeTranslations(
        const Chki18nInput(
          locales: {
            'en': {
              'a': {'b': 'x'},
              'a.b': 'y',
            },
            'ko': {'a.b': 'ㄱ'},
          },
        ),
        options: const Chki18nOptions(target: 'en'),
      );

      expect(result.of(Chki18nCheckCode.duplicateKey).first.key, 'a.b');
    });

    test('has nothing to find in input that is already flattened', () {
      final result = analyzeTranslations(
        const Chki18nInput(
          locales: {
            'en': {'a.b': 'x'},
            'ko': {'a.b': 'ㄱ'},
          },
        ),
        options: const Chki18nOptions(target: 'en', flattened: true),
      );

      expect(result.issuesByCode[Chki18nCheckCode.duplicateKey], isNull);
    });

    test('is never reported by checkEntry, which sees one key', () {
      final issues = createAnalyzer(
        options: const Chki18nOptions(target: 'en'),
      ).checkEntry(const Chki18nEntry(key: 'a.b', values: {'en': 'x', 'ko': 'ㄱ'}));

      expect(issues.every((issue) => issue.code != Chki18nCheckCode.duplicateKey), isTrue);
    });

    test('can be switched off like any other check', () async {
      final result = await checkTranslationFiles(
        path: samplePath('locales-duplicate-key'),
        options: const Chki18nOptions(target: 'en', ignoreChecks: [Chki18nCheckCode.duplicateKey]),
      );

      expect(result.issuesByCode[Chki18nCheckCode.duplicateKey], isNull);
      expect(result.success, isTrue);
    });
  });
}
