import 'package:chki18n/chki18n.dart';
import 'package:test/test.dart';

String samplePath(String name) => 'test/samples/$name';

void main() {
  group('checkTranslationFiles', () {
    test('passes a directory with no critical issue', () async {
      final result = await checkTranslationFiles(path: samplePath('locales-no-issue'));

      expect(result.success, isTrue);
      expect(result.summary.error, 0);
      expect(result.fileFormat, Chki18nFileFormat.single);
      expect(result.locales.toList()..sort(), ['en', 'ko']);
      expect(result.files.length, 2);
    });

    test('reports a key the target language has and another locale does not', () async {
      final result = await checkTranslationFiles(path: samplePath('locales-issue-no-key'));

      expect(result.success, isFalse);
      expect(result.of(Chki18nCheckCode.noKey).length, 1);

      final issue = result.of(Chki18nCheckCode.noKey).first;

      expect(issue.locale, 'ko');
      expect(issue.key, 'attr.folder');
      expect(issue.targetValue, 'Folder');
      expect(issue.level, Chki18nLevel.error);
      expect(issue.file, endsWith('ko.json'));
    });

    test('reports what the target language got wrong in its own file', () async {
      final result = await checkTranslationFiles(path: samplePath('locales-target-issue'));
      final codes =
          result.issues
              .where((issue) => issue.locale == 'en')
              .map((issue) => issue.code.name)
              .toList()
            ..sort();

      expect(codes, [
        Chki18nCheckCode.emptyValue.name,
        Chki18nCheckCode.invalidValueType.name,
        Chki18nCheckCode.invisibleCharacter.name,
        Chki18nCheckCode.surroundingWhitespace.name,
      ]);
      // None of them is an error, so a source language nobody had checked
      // before does not start failing the build the day this arrives.
      expect(result.success, isTrue);
      expect(result.issues.every((issue) => issue.locale.isEmpty || issue.locale == 'en'), isTrue);
    });

    test('compares a folder per locale layout', () async {
      final result = await checkTranslationFiles(path: samplePath('multiple-translate-files'));

      expect(result.success, isTrue);
      expect(result.fileFormat, Chki18nFileFormat.folder);
      expect(result.groups, ['common.json']);
    });

    test('compares a single file holding every locale', () async {
      final result = await checkTranslationFiles(path: samplePath('locales-nested'));

      expect(result.fileFormat, Chki18nFileFormat.nested);
      expect(result.groups, ['translation.json']);
      expect(result.of(Chki18nCheckCode.noKey).length, 1);
      expect(result.of(Chki18nCheckCode.noKey).first.key, 'desc.bye');
    });

    test('reports every comparison check', () async {
      final result = await checkTranslationFiles(path: samplePath('locales-all-issues'));

      expect(result.success, isFalse);

      for (final code in [
        Chki18nCheckCode.noKey,
        Chki18nCheckCode.dummyKey,
        Chki18nCheckCode.emptyValue,
        Chki18nCheckCode.noInterpolationKey,
        Chki18nCheckCode.extraInterpolationKey,
        Chki18nCheckCode.notTranslatedValue,
        Chki18nCheckCode.duplicateValue,
        Chki18nCheckCode.surroundingWhitespace,
        Chki18nCheckCode.missingNumber,
        Chki18nCheckCode.invalidValueType,
      ]) {
        expect(
          result.issuesByCode.containsKey(code),
          isTrue,
          reason: '${code.code} was not reported',
        );
      }
    });

    test('summarizes issues by level, locale and code', () async {
      final result = await checkTranslationFiles(path: samplePath('locales-all-issues'));

      expect(result.summary.total, result.issues.length);
      expect(
        result.summary.error + result.summary.warn + result.summary.info,
        result.summary.total,
      );
      expect(result.summary.byCode[Chki18nCheckCode.noKey], 1);
      expect(result.summary.byLocale['ko']!.error, greaterThan(0));
    });

    test('fails when no path is given', () async {
      final result = await checkTranslationFiles();

      expect(result.success, isFalse);
      expect(result.issues.first.code, Chki18nCheckCode.invalidOptions);
      expect(result.issues.first.level, Chki18nLevel.error);
    });

    test('fails when the target language is not among the files', () async {
      final result = await checkTranslationFiles(
        path: samplePath('locales-no-issue'),
        options: const Chki18nOptions(target: 'ja'),
      );

      expect(result.success, isFalse);
      expect(result.of(Chki18nCheckCode.invalidOptions).first.level, Chki18nLevel.error);
    });

    test('fails when a forced format matches no file', () async {
      final result = await checkTranslationFiles(
        path: samplePath('locales-no-issue'),
        options: const Chki18nOptions(format: Chki18nFileFormat.folder),
      );

      expect(result.success, isFalse);
      expect(result.of(Chki18nCheckCode.invalidFile).length, 1);
    });

    test('fails when the directory does not exist', () async {
      final result = await checkTranslationFiles(path: samplePath('does-not-exist'));

      expect(result.success, isFalse);
      expect(result.of(Chki18nCheckCode.invalidFile), isNotEmpty);
    });

    test('only runs the checks it was asked for', () async {
      final result = await checkTranslationFiles(
        path: samplePath('locales-all-issues'),
        options: const Chki18nOptions(target: 'en', checks: [Chki18nCheckCode.noKey]),
      );

      expect(result.issuesByCode.keys.toList(), [Chki18nCheckCode.noKey]);
    });
  });
}
