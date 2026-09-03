/// Diagnostics for the command line, and only diagnostics.
library;

import 'dart:io';

import 'package:chki18n/src/types.dart';

/// Writes what a run is doing, when a run was asked to say.
class Chki18nLogger {
  /// Creates a logger that writes through [_write], or nowhere at all.
  const Chki18nLogger._(this._write);

  final void Function(String message)? _write;

  /// Writes one diagnostic line.
  void debug(String message) => _write?.call(message);
}

/// A logger that writes nothing. What the library uses unless asked to speak.
const Chki18nLogger silentLogger = Chki18nLogger._(null);

/// Diagnostics for the CLI, and only diagnostics: the findings are rendered by
/// the reporter, in whichever shape was asked for.
///
/// They go to standard error so that a report piped out of standard output
/// stays parseable with `--debug` on.
Chki18nLogger createLogger(Chki18nResolvedOptions options) {
  if (!options.debug) {
    return silentLogger;
  }

  final label =
      options.color
          ? '\x1b[104m\x1b[97m Chki18n \x1b[0m\x1b[44m\x1b[97m DEBUG \x1b[0m'
          : ' Chki18n  DEBUG ';

  return Chki18nLogger._((message) => stderr.writeln('$label $message'));
}
