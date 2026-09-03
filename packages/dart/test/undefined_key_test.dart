import 'package:chki18n/chki18n.dart';
import 'package:test/test.dart';

const String localesPath = 'test/samples/undefined-key/locales';

const String sourcePath = 'test/samples/undefined-key/src';

const List<String> sampleKeys = ['desc.hello', 'attr.folder', 'item_one', 'item_other'];

Future<Chki18nUsageScan> scan({Chki18nOptions options = const Chki18nOptions()}) => findUnusedKeys(
  sourcePath,
  sampleKeys,
  resolveOptions(options.copyWith(target: options.target ?? 'en')).options,
);

void main() {
  group('findUnusedKeys, on the keys the source asks for', () {
    test('reports a key no language file defines', () async {
      final found = await scan();

      expect([for (final usage in found.undefinedKeys) usage.key], ['attr.missing']);
      expect(found.undefinedKeys.first.file, endsWith('app.ts'));
    });

    test('reads a key through the namespace written in front of it', () async {
      final found = await scan();

      // `t('common:desc.hello')` names a namespace and a key that does exist.
      expect(found.undefinedKeys.any((usage) => usage.key.contains('common')), isFalse);
    });

    test('leaves a key built at run time alone', () async {
      final found = await scan();

      expect(found.undefinedKeys.any((usage) => usage.key.startsWith('error.')), isFalse);
    });

    test('counts a key reached through a prefix as defined', () async {
      final found = await scan();

      // `t('folder')` resolves to `attr.folder` through a bound prefix.
      expect(found.undefinedKeys.any((usage) => usage.key == 'folder'), isFalse);
    });

    test('counts a plural key asked for by its base as defined', () async {
      final found = await scan();

      // The source writes `t('item')`; the runtime picks `item_one`.
      expect(found.undefinedKeys.any((usage) => usage.key == 'item'), isFalse);
      expect(found.unusedKeys, isEmpty);
    });

    test('reads the call names the project actually uses', () async {
      final found = await scan(options: const Chki18nOptions(translateFunctions: ['nothing']));

      expect(found.undefinedKeys, isEmpty);
    });

    test('does the work only for the check that needs it', () async {
      final found = await scan(
        options: const Chki18nOptions(ignoreChecks: [Chki18nCheckCode.undefinedKey]),
      );

      expect(found.undefinedKeys, isEmpty);
    });
  });

  group('UNDEFINED_KEY', () {
    test('reports what the source asks for and the files do not have', () async {
      final result = await checkTranslationFiles(
        path: localesPath,
        options: const Chki18nOptions(
          target: 'en',
          source: sourcePath,
          checks: [Chki18nCheckCode.undefinedKey],
        ),
      );

      expect(result.of(Chki18nCheckCode.undefinedKey).length, 1);
      expect(result.of(Chki18nCheckCode.undefinedKey).first.key, 'attr.missing');
      // Not a locale's fault: no language file defines it.
      expect(result.of(Chki18nCheckCode.undefinedKey).first.locale, '');
    });

    test('reports nothing without a source directory to read', () async {
      final result = await checkTranslationFiles(
        path: localesPath,
        options: const Chki18nOptions(target: 'en', checks: [Chki18nCheckCode.undefinedKey]),
      );

      expect(result.issues, isEmpty);
    });

    test('accepts an answer worked out elsewhere', () {
      final result = analyzeTranslations(
        const Chki18nInput(
          locales: {
            'en': {'a': 'A'},
          },
          undefinedKeys: [Chki18nKeyUsage(key: 'b.c', file: 'app.ts')],
        ),
        options: const Chki18nOptions(target: 'en', checks: [Chki18nCheckCode.undefinedKey]),
      );

      expect(result.of(Chki18nCheckCode.undefinedKey).first.key, 'b.c');
      expect(result.of(Chki18nCheckCode.undefinedKey).first.file, 'app.ts');
    });

    test('never fails a run on its own', () async {
      final result = await checkTranslationFiles(
        path: localesPath,
        options: const Chki18nOptions(
          target: 'en',
          source: sourcePath,
          checks: [Chki18nCheckCode.undefinedKey],
        ),
      );

      expect(result.success, isTrue);
      expect(result.summary.warn, 1);
    });
  });
}
