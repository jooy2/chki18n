/// The two entry points that read translations off the disk.
library;

import 'dart:convert';
import 'dart:io';

import 'package:chki18n/src/constants.dart';
import 'package:chki18n/src/core/duplicate.dart';
import 'package:chki18n/src/core/issue.dart';
import 'package:chki18n/src/core/result.dart';
import 'package:chki18n/src/core/session.dart';
import 'package:chki18n/src/loader/paths.dart';
import 'package:chki18n/src/loader/scan.dart';
import 'package:chki18n/src/loader/unused_keys.dart';
import 'package:chki18n/src/logger.dart';
import 'package:chki18n/src/reporter/context.dart';
import 'package:chki18n/src/reporter/reporter.dart';
import 'package:chki18n/src/types.dart';

const JsonEncoder _prettyJson = JsonEncoder.withIndent('\t');

/// A session over translations read from a directory, which can be read again.
class Chki18nFileSession extends Chki18nSession {
  Chki18nFileSession._(this.path, Chki18nOptions options)
    : super(const Chki18nInput(), options: options);

  /// Absolute path the translations were read from. Empty when none was given.
  final String path;

  List<String> _skipped = const [];

  /// Files that were read but did not belong to any locale.
  List<String> get skipped => _skipped;

  /// Reads the directory again, replacing everything the session holds.
  Future<void> reload() async {
    if (path.isEmpty) {
      _skipped = const [];
      reset(
        Chki18nInput(
          issues: [
            createIssue(
              Chki18nCheckCode.invalidOptions,
              level: Chki18nLevel.error,
              message: 'No `path` argument is specified.',
            ),
          ],
        ),
      );
      return;
    }

    final scan = await scanTranslationDirectory(path, options);
    final usage = await _usageOf(scan.groups, scan.files);

    _skipped = scan.skipped;
    reset(
      Chki18nInput(
        groups: scan.groups,
        files: scan.files,
        issues: scan.issues,
        fileFormat: scan.fileFormat,
        unusedKeys: usage.unusedKeys,
        undefinedKeys: usage.undefinedKeys,
      ),
    );
  }

  /// What the source tree says about the keys: the ones nothing refers to, and
  /// the ones it asks for that nothing defines.
  ///
  /// Empty when no source directory was given. The project's own translation
  /// files are excluded from the search: a key appears verbatim in the file
  /// that defines it, which would mark every key used.
  Future<Chki18nUsageScan> _usageOf(TranslationGroups groups, List<Chki18nSourceFile> files) async {
    final source = options.source;
    final wanted =
        options.enabledChecks.contains(Chki18nCheckCode.unusedKey) ||
        options.enabledChecks.contains(Chki18nCheckCode.undefinedKey);

    if (source == null || !wanted) {
      return const Chki18nUsageScan(unusedKeys: [], undefinedKeys: [], scannedFileCount: 0);
    }

    final keys = <String>{};

    for (final locales in groups.values) {
      for (final translations in locales.values) {
        collectFlatKeys(translations, keys);
      }
    }

    return findUnusedKeys(
      absolutePath(source),
      keys.toList(),
      options,
      skipFiles: [for (final file in files) file.path],
    );
  }
}

/// Reads a directory of translation files once and keeps them, so the same set
/// can be checked as often as needed without touching the file system again.
///
/// Use this when this module owns the translations. When your own application
/// owns them — an editor holding the values it is editing — pass the values
/// straight to [Chki18nSession] or `createAnalyzer().checkEntry` instead, so
/// there is only ever one copy to keep in step.
Future<Chki18nFileSession> loadTranslations({String? path, Chki18nOptions? options}) async {
  // `path` first: an explicit `options.path` wins over the argument, which is
  // what the CLI relies on when it passes everything through as options.
  final merged = (options ?? const Chki18nOptions()).copyWith(
    path: options?.path ?? path,
    flattened: false,
  );
  final resolvedPath = merged.path;
  final session = Chki18nFileSession._(
    resolvedPath == null || resolvedPath.isEmpty ? '' : absolutePath(resolvedPath),
    merged,
  );

  await session.reload();

  return session;
}

/// Columns the console report lays itself out to.
///
/// What `width` asked for, else the terminal's own width, else what `COLUMNS`
/// says — a CI runner often sets that where there is no terminal to measure. A
/// measured width is capped, since a very wide terminal would put the counts
/// too far from the labels for the two to read as one line. `null` leaves the
/// reporter on its own default.
int? consoleWidth(Chki18nResolvedOptions options) {
  final asked = options.width;

  if (asked != null) {
    return asked;
  }

  var measured = 0;

  if (stdout.hasTerminal) {
    measured = stdout.terminalColumns;
  } else {
    measured = int.tryParse(Platform.environment['COLUMNS'] ?? '') ?? 0;
  }

  return measured > 0
      ? (measured < maxMeasuredReportWidth ? measured : maxMeasuredReportWidth)
      : null;
}

/// Writes the report to the file `output` names, creating the directory it sits
/// in when it is not there yet.
///
/// A write that fails comes back as an issue rather than as an exception, so a
/// report that never reached the disk cannot be mistaken for one that did.
Future<Chki18nIssue?> _writeReport(Chki18nResult result, Chki18nResolvedOptions options) async {
  final output = options.output;
  final reporter = options.outputReporter;

  if (output == null || reporter == null) {
    return null;
  }

  final file = absolutePath(output);
  // A saved report is read later, by someone who no longer has the terminal
  // that produced it: no escape codes, and a fixed width.
  final text = formatResult(
    result,
    options,
    Chki18nReportInit(
      reporter: reporter,
      color: false,
      // Not the terminal's width: the same run has to produce the same file
      // wherever it is run from.
      width: options.width,
      cwd: Directory.current.path,
    ),
  );

  try {
    await Directory(dirnameOf(file)).create(recursive: true);
    await File(file).writeAsString('$text\n');
  } catch (error) {
    return createIssue(
      Chki18nCheckCode.invalidOptions,
      level: Chki18nLevel.error,
      message: 'The report could not be written to `$output`: $error',
    );
  }

  return null;
}

/// Reads a directory of translation files and compares every language against
/// the target language, in one call.
///
/// Nothing is printed unless `verbose` is set and the process is never exited
/// for you, so the result is the only thing a caller has to act on. Reach for
/// [loadTranslations] instead when the same directory is checked more than
/// once.
Future<Chki18nResult> checkTranslationFiles({String? path, Chki18nOptions? options}) async {
  final startedAt = DateTime.now().millisecondsSinceEpoch;
  final session = await loadTranslations(path: path, options: options);
  final logger = createLogger(session.options);

  logger.debug('Options: ${_prettyJson.convert(session.options.toJson())}');
  logger.debug('Detected file format: ${session.fileFormat?.name}');

  for (final file in session.skipped) {
    logger.debug("Skipped '$file': it does not belong to a known locale.");
  }

  // The session times its own comparison; this call also paid for the scan.
  final analysis = session.analyze();
  final elapsedMs = DateTime.now().millisecondsSinceEpoch - startedAt;
  final timed = Chki18nResult(
    success: analysis.success,
    issues: analysis.issues,
    issuesByCode: analysis.issuesByCode,
    summary: analysis.summary,
    target: analysis.target,
    locales: analysis.locales,
    groups: analysis.groups,
    keyCount: analysis.keyCount,
    files: analysis.files,
    fileFormat: analysis.fileFormat,
    elapsedMs: elapsedMs,
  );
  final failedWrite = await _writeReport(timed, session.options);
  // A report that could not be saved is a failure of the run, so it joins the
  // issues instead of being mentioned once and forgotten.
  final result =
      failedWrite == null
          ? timed
          : buildResult(
            [...timed.issues, failedWrite],
            session.options,
            locales: timed.locales,
            groups: timed.groups,
            keyCount: timed.keyCount,
            files: timed.files,
            fileFormat: timed.fileFormat,
            elapsedMs: timed.elapsedMs,
          );

  if (session.options.verbose) {
    stdout.writeln(
      formatResult(
        result,
        session.options,
        Chki18nReportInit(
          color: session.options.color && stdout.supportsAnsiEscapes,
          width: consoleWidth(session.options),
          cwd: Directory.current.path,
        ),
      ),
    );
  }

  return result;
}
