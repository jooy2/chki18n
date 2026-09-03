import 'dart:io';

import 'package:chki18n/src/cli.dart';
import 'package:chki18n/src/version.dart';
import 'package:test/test.dart';

Future<ProcessResult> run(List<String> arguments) =>
    Process.run(Platform.resolvedExecutable, ['run', 'bin/chki18n.dart', ...arguments]);

void main() {
  group('parseArguments', () {
    test('reads a flag and the word after it', () {
      expect(parseArguments(['--target', 'ko'])['target'], 'ko');
    });

    test('reads `--flag=value` as the same thing', () {
      expect(parseArguments(['--target=ko'])['target'], 'ko');
    });

    test('reads a boolean flag as true and `--no-x` as false', () {
      expect(parseArguments(['--debug'])['debug'], isTrue);
      expect(parseArguments(['--no-warn'])['warn'], isFalse);
    });

    test('collects everything that is not a flag', () {
      expect(parseArguments(['locales', '--target', 'ko'])['_'], ['locales']);
    });

    test('does not swallow the next word for a flag that takes no value', () {
      final args = parseArguments(['--debug', 'locales']);

      expect(args['debug'], isTrue);
      expect(args['_'], ['locales']);
    });
  });

  group('the command', () {
    test('prints the usage text for `--help` and exits cleanly', () async {
      final result = await run(['--help']);

      expect(result.exitCode, 0);
      expect(result.stdout, contains('--target <locale>'));
      expect(result.stdout, contains('Check codes:'));
    });

    test('prints the version for `--version`', () async {
      final result = await run(['--version']);

      expect(result.exitCode, 0);
      expect((result.stdout as String).trim(), packageVersion);
    });

    test('exits 0 on a directory with nothing wrong', () async {
      final result = await run(['test/samples/locales-no-issue', '--target', 'en']);

      expect(result.exitCode, 0);
      expect(result.stdout, contains('PASS'));
    });

    test('exits 1 when an error level issue was found', () async {
      final result = await run(['test/samples/locales-issue-no-key', '--target', 'en']);

      expect(result.exitCode, 1);
      expect(result.stdout, contains('NO_KEY'));
    });

    test('leaves the banner off a report meant for another program', () async {
      final result = await run([
        'test/samples/locales-no-issue',
        '--target',
        'en',
        '--reporter',
        'json',
      ]);

      expect((result.stdout as String).trimLeft(), startsWith('{'));
    });
  });
}
