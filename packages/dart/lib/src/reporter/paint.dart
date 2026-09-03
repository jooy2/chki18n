/// The colours a report may use, held as a table rather than reached for at
/// each call site.
///
/// One formatter then renders both the coloured terminal report and the plain
/// text that goes into a file, with no branching of its own.
library;

import 'package:chki18n/src/constants.dart';

/// Ends whatever the code before it started. Nothing here nests, so the one
/// reset is enough and a table of matching close codes would be dead weight.
const String _reset = '\x1b[0m';

String Function(String text) _wrapWith(String open) => (text) => '$open$text$_reset';

/// The colours a report may use.
class Chki18nPaint {
  /// Creates a palette. Prefer [createPaint], which picks one of the two the
  /// library already has.
  const Chki18nPaint({
    required this.error,
    required this.warn,
    required this.info,
    required this.heading,
    required this.key,
    required this.value,
    required this.dim,
    required this.pass,
    required this.fail,
  });

  /// Something that fails the run.
  final String Function(String text) error;

  /// Something worth fixing that does not fail the run.
  final String Function(String text) warn;

  /// A note.
  final String Function(String text) info;

  /// A section heading or a check code.
  final String Function(String text) heading;

  /// A translation key.
  final String Function(String text) key;

  /// A translation value.
  final String Function(String text) value;

  /// Supporting text the reader does not have to look at.
  final String Function(String text) dim;

  /// The badge on a run that passed.
  final String Function(String text) pass;

  /// The badge on a run that failed.
  final String Function(String text) fail;
}

String _identity(String text) => text;

/// The palette a file gets: escape codes in a saved report are noise nothing
/// will read.
const Chki18nPaint plainPaint = Chki18nPaint(
  error: _identity,
  warn: _identity,
  info: _identity,
  heading: _identity,
  key: _identity,
  value: _identity,
  dim: _identity,
  pass: _identity,
  fail: _identity,
);

/// The palette a terminal gets.
final Chki18nPaint colouredPaint = Chki18nPaint(
  error: _wrapWith('\x1b[91m'),
  warn: _wrapWith('\x1b[93m'),
  info: _wrapWith('\x1b[90m'),
  heading: _wrapWith('\x1b[1m\x1b[97m'),
  key: _wrapWith('\x1b[96m'),
  value: _wrapWith('\x1b[37m'),
  dim: _wrapWith('\x1b[90m'),
  pass: _wrapWith('\x1b[102m\x1b[97m'),
  fail: _wrapWith('\x1b[101m\x1b[97m'),
);

/// Colours when asked for them.
///
/// Whether the terminal can draw them is the caller's question rather than this
/// one's: a report rendered for a file, for a string or for a test never wants
/// them, and only the command line knows what its own output is attached to.
Chki18nPaint createPaint(bool enabled) => enabled ? colouredPaint : plainPaint;

/// The painter that matches a severity, for level coloured text.
String Function(String text) paintOfLevel(Chki18nPaint paint, Chki18nLevel level) =>
    switch (level) {
      Chki18nLevel.error => paint.error,
      Chki18nLevel.warn => paint.warn,
      Chki18nLevel.info => paint.info,
    };
