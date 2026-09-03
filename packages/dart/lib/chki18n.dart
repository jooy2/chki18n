/// Checks that your i18n translation files agree with each other.
///
/// Point it at a folder of JSON, name the language everything is compared
/// against, and it reports what is missing, what was never translated and what
/// quietly broke.
///
/// ```dart
/// final result = await checkTranslationFiles(
///   path: './locales',
///   options: const Chki18nOptions(target: 'en'),
/// );
///
/// result.success; // false
/// result.issues; // every issue, with its level, key, locale and file
/// ```
///
/// The comparison itself is also published as `package:chki18n/core.dart`,
/// which imports no `dart:io` and runs anywhere Dart does.
library;

export 'package:chki18n/core.dart';
export 'package:chki18n/src/check.dart'
    show Chki18nFileSession, checkTranslationFiles, consoleWidth, loadTranslations;
export 'package:chki18n/src/loader/scan.dart' show Chki18nScanResult, scanTranslationDirectory;
export 'package:chki18n/src/loader/unused_keys.dart'
    show Chki18nUsageScan, findUnusedKeys, leafOfKey;
export 'package:chki18n/src/reporter/context.dart'
    show Chki18nReportContext, Chki18nReportInit, buildReportContext;
export 'package:chki18n/src/reporter/group.dart'
    show Chki18nIssueGroup, Chki18nIssueSubGroup, compareIssues, groupIssues, subGroupIssues;
export 'package:chki18n/src/reporter/paint.dart' show Chki18nPaint, createPaint, paintOfLevel;
export 'package:chki18n/src/reporter/reporter.dart' show formatResult;
export 'package:chki18n/src/reporter/text.dart' show padTo, truncate, widestOf;
