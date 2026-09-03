import 'package:chki18n/chki18n.dart';
import 'package:test/test.dart';

String samplePath(String name) => 'test/samples/$name';

TranslationGroups sampleGroups() => {
  'common.json': {
    'en': {'ok': 'OK'},
    'ko': {'ok': '확인'},
  },
  'errors.json': {
    'en': {'failed': 'Failed'},
    'ko': <String, Object?>{},
  },
};

void main() {
  group('loadTranslations', () {
    test('scans once and holds what it read', () async {
      final session = await loadTranslations(
        path: samplePath('locales-all-issues'),
        options: const Chki18nOptions(target: 'en'),
      );

      expect(session.locales.toList()..sort(), ['en', 'ko']);
      expect(session.groups, ['']);
      expect(session.fileFormat, Chki18nFileFormat.single);
      expect(session.files.length, 2);
      expect(session.get('en', 'greeting'), 'Hello {name}');
    });

    test('flattens on load, so keys are read in their dotted form', () async {
      final session = await loadTranslations(
        path: samplePath('locales-no-issue'),
        options: const Chki18nOptions(target: 'en'),
      );

      expect(session.get('ko', 'attr.folder'), '폴더');
      expect(session.keys(), contains('desc.hello'));
    });

    test('analyses without reading the files again', () async {
      final session = await loadTranslations(
        path: samplePath('locales-all-issues'),
        options: const Chki18nOptions(target: 'en'),
      );
      final first = session.analyze();
      final second = session.analyze();

      expect(first.success, isFalse);
      expect(first.issues.length, second.issues.length);
      expect(first.fileFormat, Chki18nFileFormat.single);
    });

    test('re-checks only the edited key and reports the new state', () async {
      final session = await loadTranslations(
        path: samplePath('locales-all-issues'),
        options: const Chki18nOptions(target: 'en'),
      );

      expect(
        [for (final issue in session.checkKey('greeting')) issue.code],
        [Chki18nCheckCode.noInterpolationKey],
      );
      expect(session.set('ko', 'greeting', '{name}님 안녕하세요'), isEmpty);
      expect(session.get('ko', 'greeting'), '{name}님 안녕하세요');
    });

    test('carries an edit into the next full analysis', () async {
      final session = await loadTranslations(
        path: samplePath('locales-issue-no-key'),
        options: const Chki18nOptions(target: 'en'),
      );

      expect(session.analyze().of(Chki18nCheckCode.noKey).length, 1);

      session.set('ko', 'attr.folder', '폴더');

      expect(session.analyze().issuesByCode[Chki18nCheckCode.noKey], isNull);
    });

    test('drops a key from one locale or from all of them', () async {
      final session = await loadTranslations(
        path: samplePath('locales-no-issue'),
        options: const Chki18nOptions(target: 'en'),
      );

      expect(
        [for (final issue in session.remove('attr.folder', locale: 'ko')) issue.code],
        [Chki18nCheckCode.noKey],
      );

      session.remove('attr.folder');

      expect(session.get('en', 'attr.folder'), isNull);
      expect(session.checkKey('attr.folder'), isEmpty);
    });

    test('reload throws away the edits and reads the directory again', () async {
      final session = await loadTranslations(
        path: samplePath('locales-no-issue'),
        options: const Chki18nOptions(target: 'en'),
      );

      session.set('ko', 'attr.folder', 'edited');
      expect(session.get('ko', 'attr.folder'), 'edited');

      await session.reload();

      expect(session.get('ko', 'attr.folder'), '폴더');
    });

    test('reports a missing path instead of throwing', () async {
      final session = await loadTranslations();

      expect(session.path, '');
      expect(session.analyze().success, isFalse);
      expect(session.analyze().issues.first.code, Chki18nCheckCode.invalidOptions);
    });
  });

  group('createSession', () {
    test('takes translations that are already in memory', () {
      final session = createSession(
        Chki18nInput(groups: sampleGroups()),
        options: const Chki18nOptions(target: 'en'),
      );

      expect(session.groups, ['common.json', 'errors.json']);
      expect(session.analyze().of(Chki18nCheckCode.noKey).length, 1);
    });

    test('finds the group a key lives in, so simple calls need no group', () {
      final session = createSession(
        Chki18nInput(groups: sampleGroups()),
        options: const Chki18nOptions(target: 'en'),
      );

      expect(session.get('ko', 'ok'), '확인');
      expect(session.get('en', 'failed'), 'Failed');
      expect(session.checkKey('failed').first.group, 'errors.json');
    });

    test('writes into the named group', () {
      final session = createSession(
        Chki18nInput(groups: sampleGroups()),
        options: const Chki18nOptions(target: 'en'),
      );

      session.set('ko', 'failed', '실패');

      expect(session.get('ko', 'failed'), '실패');
      expect(session.translations('errors.json')['ko']!['failed'], '실패');
      expect(session.analyze().issuesByCode[Chki18nCheckCode.noKey], isNull);
    });

    test('adds a locale that was not there before', () {
      final session = createSession(
        Chki18nInput(groups: sampleGroups()),
        options: const Chki18nOptions(target: 'en'),
      );

      session.set('ja', 'ok', 'OK', 'common.json');

      expect(session.locales, contains('ja'));
      expect(session.checkKey('ok', 'common.json').first.code, Chki18nCheckCode.notTranslatedValue);
    });

    test('reset replaces the data but keeps the options', () {
      final session = createSession(
        Chki18nInput(groups: sampleGroups()),
        options: const Chki18nOptions(target: 'ko'),
      );

      session.reset(
        const Chki18nInput(
          locales: {
            'ko': {'a': '가'},
            'en': {'a': '가'},
          },
        ),
      );

      expect(session.groups, ['']);
      expect(session.options.target, 'ko');
      expect(session.analyze().of(Chki18nCheckCode.notTranslatedValue).length, 1);
    });
  });
}
