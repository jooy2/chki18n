// What the package does, in the three shapes a caller usually needs it: a
// directory checked once, values checked without touching the disk, and a
// single key re-checked after an edit.
import 'package:chki18n/chki18n.dart';

Future<void> main() async {
  // 1. Check a directory of translation files, the same way the CLI does.
  final result = await checkTranslationFiles(
    path: 'test/samples/locales-all-issues',
    options: const Chki18nOptions(target: 'en'),
  );

  print('success: ${result.success}');
  print('found: ${result.summary.error} errors, ${result.summary.warn} warnings');

  for (final issue in result.of(Chki18nCheckCode.noKey)) {
    print('${issue.locale} is missing ${issue.key}');
  }

  // 2. Check values the application already holds. No file system work at all.
  final analysis = analyzeTranslations(
    const Chki18nInput(
      locales: {
        'en': {'greeting': 'Hello {name}'},
        'ko': {'greeting': '안녕하세요'},
      },
    ),
    options: const Chki18nOptions(target: 'en'),
  );

  print(analysis.of(Chki18nCheckCode.noInterpolationKey).first.message);

  // 3. Re-check one key as it is edited, which is what an editor needs.
  final analyzer = createAnalyzer(options: const Chki18nOptions(target: 'en'));
  final issues = analyzer.checkEntry(
    const Chki18nEntry(key: 'greeting', values: {'en': 'Hello {name}', 'ko': '{name}님 안녕하세요'}),
  );

  print('after the edit: ${issues.length} issues');

  // 4. Render a finished result the way the CLI renders it.
  print(
    formatResult(
      analysis,
      resolveOptions(const Chki18nOptions(target: 'en', color: false)).options,
    ),
  );
}
