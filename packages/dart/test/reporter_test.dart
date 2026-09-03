import 'dart:convert';
import 'dart:io';

import 'package:chki18n/chki18n.dart';
import 'package:test/test.dart';

String samplePath(String name) => 'test/samples/$name';

/// Somewhere outside the project, so a failed run leaves nothing behind in it.
Directory outputDir() => Directory.systemTemp.createTempSync('chki18n-report-');

/// The sample every reporter is measured against: one of nearly every check.
Future<Chki18nResult> analyze() => checkTranslationFiles(
  path: samplePath('locales-all-issues'),
  options: const Chki18nOptions(target: 'en'),
);

String render(Chki18nResult result, Chki18nOptions options, {int? width, String? cwd}) =>
    formatResult(
      result,
      resolveOptions(options.copyWith(target: options.target ?? 'en', color: false)).options,
      Chki18nReportInit(width: width, cwd: cwd),
    );

final RegExp ansi = RegExp(r'\x1b\[');

void main() {
  group('reporter options', () {
    test('defaults to a grouped, coloured report and no file', () {
      final options = resolveOptions().options;

      expect(options.reporter, defaultReporter);
      expect(options.groupBy, defaultGroupBy);
      expect(options.output, isNull);
      expect(options.outputReporter, isNull);
      expect(options.color, isTrue);
    });

    test('falls back and says so when a reporter is not one it knows', () {
      final resolved = resolveOptions(
        const Chki18nOptions(text: Chki18nTextOptions(reporter: 'fancy')),
      );

      expect(resolved.options.reporter, defaultReporter);
      expect(resolved.issues.any((issue) => issue.message.contains('fancy')), isTrue);
    });

    test('reads a reporter name whatever its case', () {
      expect(
        resolveOptions(
          const Chki18nOptions(text: Chki18nTextOptions(reporter: 'JSON')),
        ).options.reporter,
        Chki18nReporter.json,
      );
    });

    test('takes the file reporter from the extension', () {
      expect(reporterOfFileName('report.json'), Chki18nReporter.json);
      expect(reporterOfFileName('report.md'), Chki18nReporter.markdown);
      expect(reporterOfFileName('report.txt'), defaultReporter);
      expect(reporterOfFileName('report'), defaultReporter);
    });

    test('lets an explicit reporter override what the extension implies', () {
      final options =
          resolveOptions(
            const Chki18nOptions(output: 'report.json', reporter: Chki18nReporter.list),
          ).options;

      expect(options.outputReporter, Chki18nReporter.list);
    });

    test('uses the extension when no reporter was named', () {
      final options = resolveOptions(const Chki18nOptions(output: 'report.md')).options;

      expect(options.reporter, defaultReporter);
      expect(options.outputReporter, Chki18nReporter.markdown);
    });

    test('reads a width from a number or the string a flag gives it', () {
      expect(resolveOptions(const Chki18nOptions(width: 80)).options.width, 80);
      expect(
        resolveOptions(const Chki18nOptions(text: Chki18nTextOptions(width: '80'))).options.width,
        80,
      );
    });

    test('measures the terminal instead when the width is not a column count', () {
      for (final value in ['abc', '0', '-10']) {
        final resolved = resolveOptions(Chki18nOptions(text: Chki18nTextOptions(width: value)));

        expect(resolved.options.width, isNull);
        expect(
          resolved.issues.any((issue) => issue.message.contains('not a usable `width`')),
          isTrue,
        );
      }
    });

    test('leaves the width unset when nothing asked for one', () {
      expect(resolveOptions().options.width, isNull);
    });
  });

  group('formatResult', () {
    test('renders one section per locale by default', () async {
      final report = render(await analyze(), const Chki18nOptions());

      expect(report, contains(' ko '));
      expect(report, contains('NO_KEY'));
      expect(report, contains('only-en'));
      expect(report, contains('FAIL'));
      // The locale nothing is wrong with is still worth naming.
      expect(report, contains('Clean: en'));
    });

    test('renders one section per check when asked to', () async {
      final report = render(await analyze(), const Chki18nOptions(groupBy: Chki18nGroupBy.code));

      expect(report, contains(' NO_KEY '));
      expect(report, contains('By locale'));
    });

    test('leaves out the colours when they are turned off', () async {
      expect(ansi.hasMatch(render(await analyze(), const Chki18nOptions())), isFalse);
    });

    test('writes one line per issue as a list', () async {
      final result = await analyze();
      final report = render(result, const Chki18nOptions(reporter: Chki18nReporter.list));
      final lines = report.split('\n').where((line) => line.startsWith('ko')).toList();

      expect(lines.length, result.issues.length);
      expect(lines.first, contains('error'));
      expect(lines.first, contains('NO_KEY'));
    });

    test('writes a table per section as Markdown', () async {
      final report = render(
        await analyze(),
        const Chki18nOptions(reporter: Chki18nReporter.markdown),
      );

      expect(report, startsWith('# Translation check'));
      expect(report, contains('## ko'));
      expect(report, contains('| Level | Check'));
    });

    test('pads a Markdown table to one width, counting a wide character as two', () async {
      final report = render(
        await analyze(),
        const Chki18nOptions(reporter: Chki18nReporter.markdown),
      );
      final rows = report.split('\n').where((line) => line.startsWith('|')).toList();
      final widths = {for (final row in rows) displayWidth(row)};

      // The sample holds a Korean value, so equal widths here can only come from
      // counting columns rather than characters.
      expect(rows.any((row) => RegExp('[가-힣]').hasMatch(row)), isTrue);
      expect(widths.length, 1);
    });

    test('hands back the whole result as JSON, unfiltered', () async {
      final result = await analyze();
      final parsed =
          jsonDecode(
                render(result, const Chki18nOptions(reporter: Chki18nReporter.json, warn: false)),
              )
              as Map<String, Object?>;

      expect((parsed['issues']! as List).length, result.issues.length);
      expect(parsed['summary'], result.summary.toJson());
    });

    test('drops the warnings, and their lines with them, on `no-warn`', () async {
      final result = await analyze();
      final report = render(result, const Chki18nOptions(warn: false));

      expect(report.contains('EMPTY_VALUE'), isFalse);
      expect(report, contains('${result.summary.warn} issues not shown'));
      expect(report, contains('NO_KEY'));
    });

    test('leaves out the heading block and the summary on `no-info`', () async {
      final report = render(await analyze(), const Chki18nOptions(info: false));

      expect(report.contains('Compared 11 keys'), isFalse);
      expect(report, contains('NO_KEY'));
    });

    test('lays the report out to the width it is given', () async {
      final report = render(await analyze(), const Chki18nOptions(), width: 60);
      final rules = report.split('\n').where((line) => line.contains('─')).toList();

      expect(rules, isNotEmpty);

      for (final rule in rules) {
        expect(displayWidth(rule), 60);
      }
    });

    test('wraps a description rather than cutting it short', () async {
      final report = render(await analyze(), const Chki18nOptions(), width: 56);

      expect(report, contains('The key exists in the target language but is'));
      expect(report.contains('...'), isFalse);
    });

    test('says so rather than printing nothing when a run is clean', () async {
      final result = await checkTranslationFiles(
        path: samplePath('multiple-translate-files'),
        options: const Chki18nOptions(target: 'en'),
      );

      expect(render(result, const Chki18nOptions()), contains('PASS'));
    });
  });

  group('the GitHub reporter', () {
    /// One issue, so a property can carry the characters a command breaks on.
    Chki18nResult awkward() => buildResult(
      [
        const Chki18nIssue(
          code: Chki18nCheckCode.noKey,
          level: Chki18nLevel.error,
          locale: 'ko',
          key: 'attr.folder',
          group: '',
          targetValue: 'Folder',
          file: '/repo/lo,cales/ko.json',
          message: 'Missing: here, and there.',
        ),
      ],
      resolveOptions(const Chki18nOptions(target: 'en')).options,
      locales: ['en', 'ko'],
      groups: [''],
      keyCount: 1,
    );

    test('writes one workflow command per issue', () async {
      final result = await analyze();
      final report = render(
        result,
        const Chki18nOptions(reporter: Chki18nReporter.github),
        cwd: Directory.current.path,
      );
      final commands = report.split('\n').where((line) => line.startsWith('::')).toList();

      expect(commands.length, result.issues.length);
      expect(commands.first, startsWith('::error '));
      expect(commands.first, contains('title=chki18n NO_KEY'));
      // The path is relative to the working directory, which is what GitHub
      // resolves an annotation against.
      expect(commands.first, contains('file=test/samples/locales-all-issues/ko.json'));
    });

    test('names each severity the way GitHub does', () async {
      final report = render(
        await analyze(),
        const Chki18nOptions(reporter: Chki18nReporter.github),
      );

      expect(report, contains('::warning '));
      expect(report.contains('::warn '), isFalse);
    });

    test('escapes what would otherwise end a command or a property', () {
      final command =
          render(
            awkward(),
            const Chki18nOptions(reporter: Chki18nReporter.github),
            cwd: '/repo',
          ).split('\n').first;

      expect(command, contains('file=lo%2Ccales/ko.json'));
      // The message keeps its punctuation; only a property value may not.
      expect(command, contains('Missing: here, and there.'));
    });

    test('leaves out what the level options hid', () async {
      final report = render(
        await analyze(),
        const Chki18nOptions(reporter: Chki18nReporter.github, warn: false),
      );

      expect(report.contains('::warning '), isFalse);
      expect(report, contains('::error '));
    });
  });

  group('groupIssues', () {
    test('puts the sections that fail the run first', () async {
      final result = await analyze();
      final sections = groupIssues(result.issues, Chki18nGroupBy.code);

      expect(sections.length, greaterThan(1));
      expect(sections.first.counts.error, greaterThan(0));
      expect(
        sections.fold<int>(0, (total, section) => total + section.issues.length),
        result.issues.length,
      );
    });

    test('collects what the axis cannot name into one section', () {
      final sections = groupIssues([
        const Chki18nIssue(
          code: Chki18nCheckCode.invalidOptions,
          level: Chki18nLevel.warn,
          message: 'bad',
        ),
      ], Chki18nGroupBy.locale);

      expect(sections.first.label, '(general)');
    });
  });

  group('column arithmetic', () {
    test('counts a Korean or Japanese character as two columns', () {
      expect(displayWidth('abc'), 3);
      expect(displayWidth('한국어'), 6);
      expect(displayWidth('日本語'), 6);
    });

    test('pads to a column count rather than a character count', () {
      expect(displayWidth(padTo('한국어', 10)), 10);
      expect(displayWidth(padTo('abc', 10)), 10);
    });

    test('cuts to a column count and marks the cut', () {
      expect(truncate('abcdefghij', 5), 'ab...');
      expect(truncate('abc', 5), 'abc');
      expect(displayWidth(truncate('한국어입니다', 7)), lessThanOrEqualTo(7));
    });
  });

  group('writing the report to a file', () {
    test('creates the directory and writes what the extension asked for', () async {
      final directory = outputDir();

      addTearDown(() => directory.deleteSync(recursive: true));

      final file = '${directory.path}/nested/report.json';
      final result = await checkTranslationFiles(
        path: samplePath('locales-all-issues'),
        options: Chki18nOptions(target: 'en', output: file),
      );
      final written = jsonDecode(File(file).readAsStringSync()) as Map<String, Object?>;

      expect((written['summary']! as Map<String, Object?>)['error'], result.summary.error);
      expect((written['issues']! as List).length, result.issues.length);
    });

    test('never writes escape codes into a file', () async {
      final directory = outputDir();

      addTearDown(() => directory.deleteSync(recursive: true));

      final file = '${directory.path}/report.txt';

      await checkTranslationFiles(
        path: samplePath('locales-all-issues'),
        options: Chki18nOptions(target: 'en', output: file, color: true),
      );

      expect(ansi.hasMatch(File(file).readAsStringSync()), isFalse);
    });

    test('fails the run when the report cannot be written', () async {
      final result = await checkTranslationFiles(
        path: samplePath('locales-no-issue'),
        options: Chki18nOptions(
          target: 'en',
          // A path whose parent is a file cannot be created.
          output: '${samplePath('locales-no-issue')}/en.json/report.txt',
        ),
      );

      expect(result.success, isFalse);
      expect(result.issues.any((issue) => issue.message.contains('could not be written')), isTrue);
    });
  });
}
