/// The command line: what it accepts, and what it does with it.
library;

import 'dart:io';

import 'package:chki18n/src/check.dart';
import 'package:chki18n/src/constants.dart';
import 'package:chki18n/src/options.dart';
import 'package:chki18n/src/version.dart';

/// The name the usage text calls this program.
const String binName = 'chki18n';

/// Reads `--flag value`, `--flag=value`, `--no-flag` and bare arguments.
///
/// Written out rather than pulled in, because this package has no dependencies
/// and an argument parser would be the only one. What it accepts is exactly
/// what [optionDefinitions] declares: a flag that takes a value swallows the
/// word after it, one that does not is a boolean, and `--no-x` sets `x` to
/// false. Everything left over lands under `_`, and the first of those is the
/// directory to scan.
Map<String, Object?> parseArguments(List<String> arguments) {
  final valueFlags = <String>{
    for (final definition in optionDefinitions)
      if (definition.type != Chki18nOptionType.boolean) definition.flag,
  };
  final parsed = <String, Object?>{};
  final positional = <String>[];

  for (var index = 0; index < arguments.length; index += 1) {
    final argument = arguments[index];

    if (!argument.startsWith('--')) {
      positional.add(argument);
      continue;
    }

    final body = argument.substring(2);
    final equals = body.indexOf('=');

    if (equals != -1) {
      parsed[body.substring(0, equals)] = body.substring(equals + 1);
      continue;
    }

    if (body.startsWith('no-') && !valueFlags.contains(body)) {
      parsed[body.substring(3)] = false;
      continue;
    }

    if (valueFlags.contains(body)) {
      if (index + 1 < arguments.length) {
        index += 1;
        parsed[body] = arguments[index];
      }

      continue;
    }

    parsed[body] = true;
  }

  parsed['_'] = positional;

  return parsed;
}

/// The first character upper cased, which is how the banner writes the name.
String capitalizeFirst(String value) =>
    value.isEmpty ? '' : '${value[0].toUpperCase()}${value.substring(1)}';

/// Runs the command line and answers with the exit code it should leave.
///
/// `0` when nothing failed the run, `1` when at least one `error` level issue
/// was found — which is what makes this usable as a CI step.
Future<int> runCli(List<String> arguments) async {
  final args = parseArguments(arguments);

  if (args['help'] == true) {
    stdout.writeln(buildUsageText(binName));

    return 0;
  }

  if (args['version'] == true) {
    stdout.writeln(packageVersion);

    return 0;
  }

  final options = optionsFromArgs(args);
  final reporter = options.text?.reporter;

  // The banner belongs to the report a person reads. Anything that gets piped
  // into another program has to start with its own first line.
  if (options.info != false &&
      (reporter == null || reporter.trim().toLowerCase() == Chki18nReporter.pretty.name)) {
    stdout.writeln('${capitalizeFirst(binName)} $packageVersion\n');
  }

  final result = await checkTranslationFiles(options: options.copyWith(verbose: true));

  return result.success ? 0 : 1;
}
