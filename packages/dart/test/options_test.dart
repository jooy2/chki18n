import 'package:chki18n/chki18n.dart';
import 'package:test/test.dart';

void main() {
  group('resolveOptions', () {
    test('fills in the defaults', () {
      final resolved = resolveOptions();

      expect(resolved.options.target, defaultTargetLocale);
      expect(resolved.options.format, Chki18nFileFormat.auto);
      expect(resolved.options.interpolationPrefix, '{');
      expect(resolved.options.enabledChecks.length, analyzeCheckCodes.length);
    });

    test('does not treat a missing target as a fault', () {
      final resolved = resolveOptions();

      expect(resolved.issues.length, 1);
      expect(resolved.issues.first.level, Chki18nLevel.info);
    });

    test('accepts a comma separated list of check codes', () {
      final resolved = resolveOptions(
        const Chki18nOptions(text: Chki18nTextOptions(checks: 'NO_KEY, EMPTY_VALUE')),
      );

      expect(resolved.options.enabledChecks.toList(), [
        Chki18nCheckCode.noKey,
        Chki18nCheckCode.emptyValue,
      ]);
    });

    test('removes the ignored checks from the full set', () {
      final resolved = resolveOptions(
        const Chki18nOptions(ignoreChecks: [Chki18nCheckCode.duplicateValue]),
      );

      expect(resolved.options.enabledChecks.contains(Chki18nCheckCode.duplicateValue), isFalse);
      expect(resolved.options.enabledChecks.length, analyzeCheckCodes.length - 1);
    });

    test('reports an unknown check code and keeps going', () {
      final resolved = resolveOptions(
        const Chki18nOptions(text: Chki18nTextOptions(checks: 'NO_KEY,NOPE')),
      );

      expect(resolved.options.enabledChecks.toList(), [Chki18nCheckCode.noKey]);
      expect(resolved.issues.any((issue) => issue.message.contains('NOPE')), isTrue);
    });

    test('refuses to combine checks with ignoreChecks', () {
      final resolved = resolveOptions(
        const Chki18nOptions(
          text: Chki18nTextOptions(checks: 'NO_KEY', ignoreChecks: 'EMPTY_VALUE'),
        ),
      );

      expect(resolved.options.enabledChecks.toList(), [Chki18nCheckCode.noKey]);
      expect(resolved.issues.any((issue) => issue.message.contains('ignoreChecks')), isTrue);
    });

    test('falls back to auto for an unknown format', () {
      final resolved = resolveOptions(
        const Chki18nOptions(text: Chki18nTextOptions(format: 'nope')),
      );

      expect(resolved.options.format, Chki18nFileFormat.auto);
      expect(resolved.issues.any((issue) => issue.message.contains('nope')), isTrue);
    });

    test('reads a `CODE=level` pair the way the CLI writes it', () {
      final resolved = resolveOptions(
        const Chki18nOptions(text: Chki18nTextOptions(levels: 'EMPTY_VALUE=error')),
      );

      expect(resolved.options.levels, {Chki18nCheckCode.emptyValue: Chki18nLevel.error});
    });

    test('refuses to re-grade a check that reports how the run went', () {
      final resolved = resolveOptions(
        const Chki18nOptions(levels: {Chki18nCheckCode.invalidFile: Chki18nLevel.info}),
      );

      expect(resolved.options.levels, isNull);
      expect(resolved.issues.any((issue) => issue.message.contains('INVALID_FILE')), isTrue);
    });
  });

  group('optionsFromArgs', () {
    test('maps every CLI flag onto its option', () {
      final options = optionsFromArgs({
        '_': <String>[],
        'path': 'locales',
        'target': 'ko',
        'format': 'folder',
        'ignore-checks': 'NO_KEY',
        'interpolation-prefix': '{{',
        'interpolation-suffix': '}}',
        'exclude': 'tmp',
        'warn': false,
        'debug': true,
      });

      expect(options.path, 'locales');
      expect(options.target, 'ko');
      expect(options.text?.format, 'folder');
      expect(options.text?.ignoreChecks, 'NO_KEY');
      expect(options.interpolationPrefix, '{{');
      expect(options.interpolationSuffix, '}}');
      expect(options.text?.exclude, 'tmp');
      expect(options.warn, isFalse);
      expect(options.debug, isTrue);
    });

    test('reads a bare positional argument as the path', () {
      expect(
        optionsFromArgs({
          '_': ['locales'],
        }).path,
        'locales',
      );
    });

    test('prefers an explicit path over the positional argument', () {
      expect(
        optionsFromArgs({
          '_': ['ignored'],
          'path': 'locales',
        }).path,
        'locales',
      );
    });

    test('resolves the CLI form of an option exactly like the API form', () {
      final fromCli = resolveOptions(
        optionsFromArgs({'_': <String>[], 'target': 'ko', 'ignore-checks': 'NO_KEY'}),
      );
      final fromApi = resolveOptions(
        const Chki18nOptions(target: 'ko', ignoreChecks: [Chki18nCheckCode.noKey]),
      );

      expect(fromCli.options.toJson(), fromApi.options.toJson());
    });
  });

  group('buildUsageText', () {
    test('documents every option', () {
      final usage = buildUsageText('chki18n');

      for (final definition in optionDefinitions) {
        expect(
          usage,
          contains('--${definition.flag}'),
          reason: '${definition.flag} is undocumented',
        );
      }
    });
  });
}
