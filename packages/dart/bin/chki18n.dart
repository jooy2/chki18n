/// The `chki18n` command.
///
/// Everything it does lives in `lib/src/cli.dart`, so the same behaviour can be
/// tested without starting a process.
library;

import 'dart:io';

import 'package:chki18n/src/cli.dart';

Future<void> main(List<String> arguments) async {
  exitCode = await runCli(arguments);
}
