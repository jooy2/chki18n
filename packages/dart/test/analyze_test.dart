import 'package:chki18n/chki18n.dart';
import 'package:test/test.dart';

void main() {
  group('analyzeTranslations', () {
    test('flattens nested translations before comparing them', () {
      final result = analyzeTranslations(
        const Chki18nInput(
          locales: {
            'en': {
              'desc': {'hello': 'Hello', 'bye': 'Goodbye'},
            },
            'ko': {
              'desc': {'hello': '안녕하세요'},
            },
          },
        ),
        options: const Chki18nOptions(target: 'en'),
      );

      expect(result.keyCount, 2);
      expect(result.success, isFalse);
      expect(result.of(Chki18nCheckCode.noKey).first.key, 'desc.bye');
    });

    test('uses already flattened translations as they are', () {
      final result = analyzeTranslations(
        const Chki18nInput(
          locales: {
            'en': {'a.b': 'Hi'},
            'ko': {'a.b': ''},
          },
        ),
        options: const Chki18nOptions(target: 'en', flattened: true),
      );

      expect(result.keyCount, 1);
      expect(result.of(Chki18nCheckCode.emptyValue).length, 1);
    });

    test('does no file system work, so it reports no files', () {
      final result = analyzeTranslations(
        const Chki18nInput(
          locales: {
            'en': {'a': 'A'},
            'ko': {'a': 'ㄱ'},
          },
        ),
        options: const Chki18nOptions(target: 'en'),
      );

      expect(result.files, isEmpty);
      expect(result.fileFormat, isNull);
    });

    test('compares each group on its own', () {
      final result = analyzeTranslations(
        const Chki18nInput(
          groups: {
            'common.json': {
              'en': {'a': 'A'},
              'ko': {'a': 'ㄱ'},
            },
            'errors.json': {
              'en': {'b': 'B'},
              'ko': <String, Object?>{},
            },
          },
        ),
        options: const Chki18nOptions(target: 'en'),
      );

      expect(result.groups, ['common.json', 'errors.json']);
      expect(result.of(Chki18nCheckCode.noKey).length, 1);
      expect(result.of(Chki18nCheckCode.noKey).first.group, 'errors.json');
    });

    test('honours custom interpolation delimiters', () {
      const input = Chki18nInput(
        locales: {
          'en': {'a': 'Hello {{name}}'},
          'ko': {'a': '안녕하세요'},
        },
      );

      expect(
        analyzeTranslations(
          input,
          options: const Chki18nOptions(
            target: 'en',
            interpolationPrefix: '{{',
            interpolationSuffix: '}}',
          ),
        ).of(Chki18nCheckCode.noInterpolationKey).length,
        1,
      );

      // The default single-brace delimiters do not recognise `{{name}}`, so the
      // missing placeholder goes unnoticed.
      expect(
        analyzeTranslations(
          input,
          options: const Chki18nOptions(target: 'en'),
        ).issuesByCode[Chki18nCheckCode.noInterpolationKey],
        isNull,
      );
    });

    test('skips the checks named by ignoreChecks', () {
      const input = Chki18nInput(
        locales: {
          'en': {'a': 'Same'},
          'ko': {'a': 'Same'},
        },
      );

      expect(
        analyzeTranslations(
          input,
          options: const Chki18nOptions(target: 'en'),
        ).of(Chki18nCheckCode.notTranslatedValue).length,
        1,
      );
      expect(
        analyzeTranslations(
          input,
          options: const Chki18nOptions(
            target: 'en',
            ignoreChecks: [Chki18nCheckCode.notTranslatedValue],
          ),
        ).issuesByCode[Chki18nCheckCode.notTranslatedValue],
        isNull,
      );
    });
  });

  group('createAnalyzer().checkEntry', () {
    final analyzer = createAnalyzer(options: const Chki18nOptions(target: 'en'));

    test('checks a single key across locales', () {
      final issues = analyzer.checkEntry(
        const Chki18nEntry(key: 'greeting', values: {'en': 'Hello {name}', 'ko': '안녕하세요'}),
      );

      expect(issues.length, 1);
      expect(issues.first.code, Chki18nCheckCode.noInterpolationKey);
      expect(issues.first.interpolation, 'name');
      expect(issues.first.key, 'greeting');
    });

    test('returns nothing for a key with no problem', () {
      expect(
        analyzer.checkEntry(const Chki18nEntry(key: 'a', values: {'en': 'Hello', 'ko': '안녕'})),
        isEmpty,
      );
    });

    test('reports a missing locale when told which locales exist', () {
      final issues = analyzer.checkEntry(
        const Chki18nEntry(key: 'a', values: {'en': 'Hello'}, locales: ['en', 'ko']),
      );

      expect(issues.length, 1);
      expect(issues.first.code, Chki18nCheckCode.noKey);
      expect(issues.first.locale, 'ko');
    });

    test('never reports checks that need more than one key', () {
      final issues = analyzer.checkEntry(
        const Chki18nEntry(key: 'a', values: {'en': 'Same', 'ko': 'Same'}),
      );

      expect(issues.every((issue) => issue.code != Chki18nCheckCode.duplicateValue), isTrue);
    });

    test('carries the group through to the issue', () {
      final issues = analyzer.checkEntry(
        const Chki18nEntry(key: 'a', values: {'en': 'Hello', 'ko': ''}, group: 'common.json'),
      );

      expect(issues.first.group, 'common.json');
    });

    test('agrees with a full analysis of the same data', () {
      const locales = <String, TranslationMap>{
        'en': {'a': 'Hello {name}', 'b': 'Bye'},
        'ko': {'a': '안녕하세요', 'b': ''},
      };
      final analyzed = analyzeTranslations(
        const Chki18nInput(locales: locales),
        options: const Chki18nOptions(target: 'en', flattened: true),
      );
      final incremental = [
        for (final key in locales['en']!.keys)
          ...analyzer.checkEntry(
            Chki18nEntry(key: key, values: {'en': locales['en']![key], 'ko': locales['ko']![key]}),
          ),
      ];

      expect(
        [for (final issue in incremental) '${issue.code.code}:${issue.key}'],
        [for (final issue in analyzed.issues) '${issue.code.code}:${issue.key}'],
      );
    });
  });
}
