// The Dart side of `run.mjs`: times each step over the generated data and
// prints the medians as one line of JSON.
//
//     dart compile exe --packages=packages/dart/.dart_tool/package_config.json \
//       tools/bench/dart.dart -o bench
//     ./bench <data dir> <runs>
//
// It lives beside the other two drivers rather than in the package, and finds
// `package:chki18n` through the package's own `package_config.json`.

import 'dart:convert';
import 'dart:io';

import 'package:chki18n/chki18n.dart';

const List<String> _locales = ['en', 'ko', 'ja', 'de', 'ru'];

Future<double> _median(int runs, Future<void> Function() step) async {
  final times = <double>[];

  for (var run = 0; run < 3; run += 1) {
    await step();
  }

  for (var run = 0; run < runs; run += 1) {
    final watch = Stopwatch()..start();

    await step();
    times.add(watch.elapsedMicroseconds / 1000);
  }

  times.sort();

  return times[times.length ~/ 2];
}

Future<void> main(List<String> args) async {
  final dataDir = args[0];
  final runs = int.parse(args[1]);
  final localesDir = '$dataDir/locales';
  final sourceDir = '$dataDir/src';
  final texts = [
    for (final locale in _locales) File('$localesDir/$locale.json').readAsStringSync(),
  ];
  final nested = [for (final text in texts) jsonDecode(text)];
  final flat = <String, TranslationMap>{
    for (var index = 0; index < _locales.length; index += 1)
      _locales[index]: flattenTranslations(nested[index]),
  };
  final analyzer = createAnalyzer(options: const Chki18nOptions(target: 'en', flattened: true));
  final result = analyzer.analyze(Chki18nInput(locales: flat));

  final times = <String, double>{
    'parse': await _median(runs, () async {
      for (final text in texts) {
        jsonDecode(text);
      }
    }),
    'flatten': await _median(runs, () async {
      for (final map in nested) {
        flattenTranslations(map);
      }
    }),
    'analyze': await _median(runs, () async => analyzer.analyze(Chki18nInput(locales: flat))),
    'format': await _median(
      runs,
      () async =>
          formatResult(result, analyzer.options, const Chki18nReportInit(color: false, width: 100)),
    ),
    'check': await _median(
      runs,
      () => checkTranslationFiles(
        path: localesDir,
        options: const Chki18nOptions(target: 'en'),
      ),
    ),
    'check + source': await _median(
      runs,
      () => checkTranslationFiles(
        path: localesDir,
        options: Chki18nOptions(target: 'en', source: sourceDir),
      ),
    ),
  };

  stdout.writeln(jsonEncode({'issues': result.issues.length, ...times}));
}
