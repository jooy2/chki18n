import 'dart:io';

import 'package:chki18n/chki18n.dart';
import 'package:test/test.dart';

const String localesPath = 'test/samples/unused-key/locales';

const String sourcePath = 'test/samples/unused-key/src';

void main() {
  group('leafOfKey', () {
    test('takes the last segment', () {
      expect(leafOfKey('desc.hello'), 'hello');
      expect(leafOfKey('hello'), 'hello');
      expect(leafOfKey(''), '');
    });

    test('takes the plural suffix off, since no source file writes one', () {
      expect(leafOfKey('desc.item_one'), 'item');
      expect(leafOfKey('item_plural'), 'item');
    });
  });

  group('findUnusedKeys', () {
    final options = resolveOptions(const Chki18nOptions(target: 'en')).options;

    test('finds the key no source file mentions', () async {
      final scan = await findUnusedKeys(sourcePath, [
        'desc.hello',
        'desc.orphan',
        'attr.folder',
      ], options);

      expect(scan.unusedKeys, ['desc.orphan']);
      expect(scan.scannedFileCount, 1);
    });

    test('counts a key referenced by its leaf alone as used', () async {
      // The source calls `t('folder')`, not `t('attr.folder')`.
      final scan = await findUnusedKeys(sourcePath, ['attr.folder'], options);

      expect(scan.unusedKeys, isEmpty);
    });

    test('reports every key that shares an unreferenced leaf', () async {
      final scan = await findUnusedKeys(sourcePath, ['a.orphan', 'b.orphan'], options);

      expect(scan.unusedKeys.toList()..sort(), ['a.orphan', 'b.orphan']);
    });

    test('does not read the files it was told to skip', () async {
      final scan = await findUnusedKeys(
        sourcePath,
        ['desc.hello'],
        options,
        // Resolved through a URI so the separator is the platform's own.
        skipFiles: [Directory.current.uri.resolve('$sourcePath/app.ts').toFilePath()],
      );

      expect(scan.unusedKeys, ['desc.hello']);
      expect(scan.scannedFileCount, 0);
    });

    test('returns nothing rather than failing on a missing directory', () async {
      final scan = await findUnusedKeys('$sourcePath/nope', ['a'], options);

      expect(scan.unusedKeys, ['a']);
      expect(scan.scannedFileCount, 0);
    });
  });

  group('UNUSED_KEY', () {
    test('reports a key nothing in the source refers to', () async {
      final result = await checkTranslationFiles(
        path: localesPath,
        options: const Chki18nOptions(target: 'en', source: sourcePath),
      );
      final issues = result.of(Chki18nCheckCode.unusedKey);

      expect(issues.length, 1);
      expect(issues.first.key, 'desc.orphan');
      expect(issues.first.level, Chki18nLevel.info);
      // A fact about the source tree, not about one language's translation.
      expect(issues.first.locale, '');
    });

    test('never fails a run on its own', () async {
      final result = await checkTranslationFiles(
        path: localesPath,
        options: const Chki18nOptions(target: 'en', source: sourcePath),
      );

      expect(result.success, isTrue);
      expect(result.summary.info, greaterThan(0));
    });

    test('reports nothing without a source directory', () async {
      final result = await checkTranslationFiles(
        path: localesPath,
        options: const Chki18nOptions(target: 'en'),
      );

      expect(result.issuesByCode[Chki18nCheckCode.unusedKey], isNull);
    });

    test('does not count the translation files themselves as usages', () async {
      // Every key appears verbatim in the file that defines it, so a scan that
      // read them would report nothing at all.
      final result = await checkTranslationFiles(
        path: localesPath,
        options: const Chki18nOptions(target: 'en', source: 'test/samples/unused-key'),
      );

      expect(result.of(Chki18nCheckCode.unusedKey).length, 1);
    });

    test('accepts an answer worked out elsewhere', () {
      final result = analyzeTranslations(
        const Chki18nInput(
          locales: {
            'en': {'a': 'A', 'b': 'B'},
            'ko': {'a': 'ㄱ', 'b': 'ㄴ'},
          },
          unusedKeys: ['b'],
        ),
        options: const Chki18nOptions(target: 'en'),
      );

      expect(result.of(Chki18nCheckCode.unusedKey).length, 1);
      expect(result.of(Chki18nCheckCode.unusedKey).first.key, 'b');
    });

    test('survives a session reload', () async {
      final session = await loadTranslations(
        path: localesPath,
        options: const Chki18nOptions(target: 'en', source: sourcePath),
      );

      expect(session.analyze().of(Chki18nCheckCode.unusedKey).length, 1);

      await session.reload();

      expect(session.analyze().of(Chki18nCheckCode.unusedKey).length, 1);
    });

    test('can be switched off like any other check', () async {
      final result = await checkTranslationFiles(
        path: localesPath,
        options: const Chki18nOptions(
          target: 'en',
          source: sourcePath,
          ignoreChecks: [Chki18nCheckCode.unusedKey],
        ),
      );

      expect(result.issuesByCode[Chki18nCheckCode.unusedKey], isNull);
    });
  });
}
