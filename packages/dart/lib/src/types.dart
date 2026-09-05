/// Every public type the library hands back or takes in.
///
/// The comparison itself works on plain maps — `Map<String, Object?>` is what a
/// decoded translation file already is — so nothing here has to be built before
/// a caller can ask a question. What is written out is what a result carries,
/// and the options that shape it.
library;

import 'package:chki18n/src/constants.dart';

/// Translation strings of one locale.
///
/// Accepts both the nested shape read from a file (`{'desc': {'hello': 'Hi'}}`)
/// and the flattened shape used internally (`{'desc.hello': 'Hi'}`).
typedef TranslationMap = Map<String, Object?>;

/// `group name -> locale -> strings`. A group is one comparable set of files.
typedef TranslationGroups = Map<String, Map<String, TranslationMap>>;

/// How many issues of each severity a set of issues holds.
class Chki18nLevelCount {
  /// Creates a tally, empty unless one is given.
  Chki18nLevelCount({this.error = 0, this.warn = 0, this.info = 0});

  /// Issues that fail the run.
  int error;

  /// Issues worth fixing that never fail the run.
  int warn;

  /// Notes.
  int info;

  /// Adds one issue of [level] to the tally.
  void add(Chki18nLevel level) {
    switch (level) {
      case Chki18nLevel.error:
        error += 1;
      case Chki18nLevel.warn:
        warn += 1;
      case Chki18nLevel.info:
        info += 1;
    }
  }

  /// How many issues of [level] the tally holds.
  int of(Chki18nLevel level) => switch (level) {
    Chki18nLevel.error => error,
    Chki18nLevel.warn => warn,
    Chki18nLevel.info => info,
  };

  /// The tally as JSON, for the `json` reporter.
  Map<String, Object?> toJson() => {'error': error, 'warn': warn, 'info': info};
}

/// Counts a consumer would otherwise have to derive itself.
class Chki18nSummary {
  /// Creates a summary. Every field is filled in by `summarizeIssues`.
  Chki18nSummary({
    required this.error,
    required this.warn,
    required this.info,
    required this.total,
    required this.byCode,
    required this.byLocale,
    required this.byGroup,
  });

  /// Issues that fail the run.
  final int error;

  /// Issues worth fixing that never fail the run.
  final int warn;

  /// Notes.
  final int info;

  /// Every issue, whatever its severity.
  final int total;

  /// How many issues each check reported.
  final Map<Chki18nCheckCode, int> byCode;

  /// How many issues of each severity each language holds.
  final Map<String, Chki18nLevelCount> byLocale;

  /// How many issues of each severity each group holds.
  final Map<String, Chki18nLevelCount> byGroup;

  /// The three level totals on their own, for the reporters that only need
  /// those.
  Chki18nLevelCount get levelCount => Chki18nLevelCount(error: error, warn: warn, info: info);

  /// The summary as JSON, for the `json` reporter.
  Map<String, Object?> toJson() => {
    'error': error,
    'warn': warn,
    'info': info,
    'total': total,
    'byCode': {for (final entry in byCode.entries) entry.key.code: entry.value},
    'byLocale': {for (final entry in byLocale.entries) entry.key: entry.value.toJson()},
    'byGroup': {for (final entry in byGroup.entries) entry.key: entry.value.toJson()},
  };
}

/// One finding: what is wrong, where, and how badly it is meant.
class Chki18nIssue {
  /// Creates an issue. Prefer `createIssue`, which fills the severity and the
  /// default message in from the check's own table.
  const Chki18nIssue({
    required this.code,
    required this.level,
    required this.message,
    this.locale = '',
    this.key = '',
    this.group = '',
    this.value,
    this.targetValue,
    this.interpolation,
    this.relatedKey,
    this.file,
  });

  /// The check that reported it.
  final Chki18nCheckCode code;

  /// Severity, after any `levels` override.
  final Chki18nLevel level;

  /// Locale the issue belongs to. Empty for issues that are not locale-bound.
  final String locale;

  /// Flattened translation key. Empty for file and option level issues.
  final String key;

  /// Group the key belongs to. Empty when the caller supplied a single set.
  final String group;

  /// The value that was found, when there is one to show.
  final String? value;

  /// The target language's own wording, when there is one to compare against.
  final String? targetValue;

  /// Interpolation placeholder that triggered the issue.
  final String? interpolation;

  /// The other key involved, e.g. the first key holding a duplicated value.
  final String? relatedKey;

  /// Absolute path of the file the key came from, when known.
  final String? file;

  /// Human readable, one line description of this specific occurrence.
  final String message;

  /// The same issue reported at another severity.
  Chki18nIssue withLevel(Chki18nLevel level) => Chki18nIssue(
    code: code,
    level: level,
    message: message,
    locale: locale,
    key: key,
    group: group,
    value: value,
    targetValue: targetValue,
    interpolation: interpolation,
    relatedKey: relatedKey,
    file: file,
  );

  /// The issue as JSON, for the `json` reporter. A field with nothing in it is
  /// left out rather than written as `null`.
  Map<String, Object?> toJson() => {
    'code': code.code,
    'level': level.name,
    'locale': locale,
    'key': key,
    'group': group,
    if (value != null) 'value': value,
    if (targetValue != null) 'targetValue': targetValue,
    if (interpolation != null) 'interpolation': interpolation,
    if (relatedKey != null) 'relatedKey': relatedKey,
    if (file != null) 'file': file,
    'message': message,
  };

  @override
  String toString() => '${code.code} ${level.name} $locale $key: $message';
}

/// A translation file located by the scanner.
class Chki18nSourceFile {
  /// Creates the record of one scanned file.
  const Chki18nSourceFile({
    required this.path,
    required this.relativePath,
    required this.group,
    required this.locale,
  });

  /// Absolute path on disk.
  final String path;

  /// Path relative to the directory that was scanned.
  final String relativePath;

  /// Comparable set the file belongs to.
  final String group;

  /// Language the file holds.
  final String locale;

  /// The file as JSON, for the `json` reporter.
  Map<String, Object?> toJson() => {
    'path': path,
    'relativePath': relativePath,
    'group': group,
    'locale': locale,
  };
}

/// A key the source asks for, and the file that asks for it.
class Chki18nKeyUsage {
  /// Creates one usage.
  const Chki18nKeyUsage({required this.key, this.file});

  /// The key as the source wrote it.
  final String key;

  /// Absolute path of the file that asks for it.
  final String? file;
}

/// Everything one run found, and what it was run over.
class Chki18nResult {
  /// Creates a result. Prefer `buildResult`, which derives the counted fields
  /// from the issue list rather than taking them on trust.
  const Chki18nResult({
    required this.success,
    required this.issues,
    required this.issuesByCode,
    required this.summary,
    required this.target,
    required this.locales,
    required this.groups,
    required this.keyCount,
    required this.files,
    required this.fileFormat,
    required this.elapsedMs,
  });

  /// `false` when at least one `error` level issue was found.
  final bool success;

  /// Every issue, in scan order.
  final List<Chki18nIssue> issues;

  /// The same issues grouped by check code, for report style output.
  final Map<Chki18nCheckCode, List<Chki18nIssue>> issuesByCode;

  /// Counts derived from [issues].
  final Chki18nSummary summary;

  /// Locale used as the comparison base.
  final String target;

  /// Every locale that took part in the comparison.
  final List<String> locales;

  /// Group names that took part in the comparison.
  final List<String> groups;

  /// Number of distinct keys compared across all groups.
  final int keyCount;

  /// Files read from disk. Empty when the input was supplied in memory.
  final List<Chki18nSourceFile> files;

  /// Detected (or forced) on-disk layout. `null` for in-memory input.
  final Chki18nFileFormat? fileFormat;

  /// How long the comparison took, in milliseconds.
  final int elapsedMs;

  /// Every issue the given check reported, or an empty list when it reported
  /// none. The lookup `issuesByCode[code] ?? []` written once.
  List<Chki18nIssue> of(Chki18nCheckCode code) => issuesByCode[code] ?? const [];

  /// The whole result as JSON, which is what the `json` reporter writes.
  Map<String, Object?> toJson() => {
    'locales': locales,
    'groups': groups,
    'keyCount': keyCount,
    'files': [for (final file in files) file.toJson()],
    'fileFormat': fileFormat?.name,
    'elapsedMs': elapsedMs,
    'target': target,
    'success': success,
    'issues': [for (final issue in issues) issue.toJson()],
    'issuesByCode': {
      for (final entry in issuesByCode.entries)
        entry.key.code: [for (final issue in entry.value) issue.toJson()],
    },
    'summary': summary.toJson(),
  };
}

/// Options as text, exactly as a command line gives them.
///
/// Every field is read by `resolveOptions`, which reports an unusable value as
/// an `INVALID_OPTIONS` issue rather than throwing — a typo in one flag should
/// not stop the rest of the run. A list takes commas or spaces alike, so
/// `'NO_KEY,EMPTY_VALUE'` and `'NO_KEY EMPTY_VALUE'` mean the same thing.
///
/// Only the options whose typed form a command line cannot write are here. A
/// path, a locale and a boolean are already what [Chki18nOptions] takes, and
/// the same field on [Chki18nOptions] always wins over the text form.
class Chki18nTextOptions {
  /// Creates the text form of the options a command line has to spell out.
  const Chki18nTextOptions({
    this.format,
    this.checks,
    this.ignoreChecks,
    this.levels,
    this.exclude,
    this.excludeFiles,
    this.translateFunctions,
    this.keyCase,
    this.maxKeyDepth,
    this.lengthRatio,
    this.reporter,
    this.groupBy,
    this.width,
  });

  /// `auto`, `single`, `folder` or `nested`.
  final String? format;

  /// Check codes to run, and nothing else.
  final String? checks;

  /// Check codes to skip.
  final String? ignoreChecks;

  /// `CODE=level` pairs, e.g. `EMPTY_VALUE=error`.
  final String? levels;

  /// Directory names or paths to skip while scanning.
  final String? exclude;

  /// File name patterns never read as translations.
  final String? excludeFiles;

  /// Names a translation call goes by.
  final String? translateFunctions;

  /// `kebab`, `camel` or `snake`.
  final String? keyCase;

  /// How many levels a key may be nested.
  final String? maxKeyDepth;

  /// How far a value's length may be from the target language's.
  final String? lengthRatio;

  /// `pretty`, `list`, `json`, `markdown` or `github`.
  final String? reporter;

  /// `locale`, `code`, `group`, `file` or `none`.
  final String? groupBy;

  /// Columns to lay the report out to.
  final String? width;
}

/// Options shared by the CLI and the Dart API.
///
/// Every CLI flag maps onto one of these fields, so both entry points resolve
/// through `resolveOptions` and the two can never drift apart. Everything is
/// optional and everything is named.
class Chki18nOptions {
  /// Creates a set of options. Anything left out keeps its default.
  const Chki18nOptions({
    this.path,
    this.target,
    this.format,
    this.checks,
    this.ignoreChecks,
    this.levels,
    this.interpolationPrefix,
    this.interpolationSuffix,
    this.exclude,
    this.excludeFiles,
    this.source,
    this.translateFunctions,
    this.keyCase,
    this.maxKeyDepth,
    this.lengthRatio,
    this.flattened,
    this.reporter,
    this.groupBy,
    this.output,
    this.color,
    this.width,
    this.verbose,
    this.info,
    this.warn,
    this.debug,
    this.text,
  });

  /// Directory holding the translation files.
  final String? path;

  /// Locale every other locale is compared against. Default `en`.
  final String? target;

  /// Force an on-disk layout instead of detecting it. Default `auto`.
  final Chki18nFileFormat? format;

  /// Only run these checks. Mutually exclusive with [ignoreChecks].
  final List<Chki18nCheckCode>? checks;

  /// Run every check except these.
  final List<Chki18nCheckCode>? ignoreChecks;

  /// Report these checks at a different severity, e.g.
  /// `{Chki18nCheckCode.emptyValue: Chki18nLevel.error}` to fail a run on an
  /// empty value. Only comparison checks can be re-graded.
  final Map<Chki18nCheckCode, Chki18nLevel>? levels;

  /// Opening delimiter of an interpolation placeholder. Default `{`.
  final String? interpolationPrefix;

  /// Closing delimiter of an interpolation placeholder. Default `}`.
  final String? interpolationSuffix;

  /// Directories skipped while scanning. Replaces the default list. An entry of
  /// one segment names a directory at any depth (`node_modules`); an entry with
  /// a separator names a path from the scanned root (`src/legacy`).
  final List<String>? exclude;

  /// File names never read as translations, as `*` glob patterns matched case
  /// insensitively. Replaces the default list.
  final List<String>? excludeFiles;

  /// Directory of source files to search for key usages. Without it neither
  /// `UNUSED_KEY` nor `UNDEFINED_KEY` has anything to go on.
  final String? source;

  /// Names a translation call goes by, which is how `UNDEFINED_KEY` finds the
  /// keys the source asks for. Replaces the default list rather than adding to
  /// it. Defaults to `translationFunctions`.
  final List<String>? translateFunctions;

  /// Case every segment of a key has to be written in, which is what the
  /// `KEY_NAMING` check compares against. Unset, that check reports nothing.
  final Chki18nKeyCase? keyCase;

  /// Levels a key may be nested, for the `KEY_DEPTH` check. `1` allows
  /// `folder`, `2` allows `attr.folder`. Unset, that check reports nothing.
  final int? maxKeyDepth;

  /// How many times longer or shorter than the target language a value may be
  /// before `SUSPICIOUS_LENGTH` reports it. `4` allows a quarter to four times.
  /// Unset, that check reports nothing.
  final double? lengthRatio;

  /// Treat the input as already flattened and skip the flatten pass.
  final bool? flattened;

  /// Shape the report is rendered in. Default `pretty`.
  final Chki18nReporter? reporter;

  /// Axis the report groups its issues by. Default `locale`.
  final Chki18nGroupBy? groupBy;

  /// Also write the report to this file. The extension picks the reporter —
  /// `.json` and `.md` have one of their own, anything else gets plain text —
  /// unless [reporter] names one, which always wins.
  final String? output;

  /// Colour the console report. Default `true` where the terminal allows it.
  final bool? color;

  /// Columns to lay the report out to. Defaults to the terminal's own width,
  /// then to `COLUMNS`, then to `defaultReportWidth`.
  final int? width;

  /// Print progress and results to the console. Default `false`.
  final bool? verbose;

  /// Print info level log lines. Only meaningful with [verbose].
  final bool? info;

  /// Print warn level log lines. Only meaningful with [verbose].
  final bool? warn;

  /// Print debug log lines.
  final bool? debug;

  /// The text form of the options a command line cannot type as a value. A
  /// typed field above always wins over the same option given here.
  final Chki18nTextOptions? text;

  /// The same options with a few of them replaced.
  ///
  /// An argument left out keeps what this object holds; `null` means "leave it
  /// alone" rather than "clear it", because `null` is already how an option
  /// says it was never given.
  Chki18nOptions copyWith({
    String? path,
    String? target,
    Chki18nFileFormat? format,
    List<Chki18nCheckCode>? checks,
    List<Chki18nCheckCode>? ignoreChecks,
    Map<Chki18nCheckCode, Chki18nLevel>? levels,
    String? interpolationPrefix,
    String? interpolationSuffix,
    List<String>? exclude,
    List<String>? excludeFiles,
    String? source,
    List<String>? translateFunctions,
    Chki18nKeyCase? keyCase,
    int? maxKeyDepth,
    double? lengthRatio,
    bool? flattened,
    Chki18nReporter? reporter,
    Chki18nGroupBy? groupBy,
    String? output,
    bool? color,
    int? width,
    bool? verbose,
    bool? info,
    bool? warn,
    bool? debug,
    Chki18nTextOptions? text,
  }) => Chki18nOptions(
    path: path ?? this.path,
    target: target ?? this.target,
    format: format ?? this.format,
    checks: checks ?? this.checks,
    ignoreChecks: ignoreChecks ?? this.ignoreChecks,
    levels: levels ?? this.levels,
    interpolationPrefix: interpolationPrefix ?? this.interpolationPrefix,
    interpolationSuffix: interpolationSuffix ?? this.interpolationSuffix,
    exclude: exclude ?? this.exclude,
    excludeFiles: excludeFiles ?? this.excludeFiles,
    source: source ?? this.source,
    translateFunctions: translateFunctions ?? this.translateFunctions,
    keyCase: keyCase ?? this.keyCase,
    maxKeyDepth: maxKeyDepth ?? this.maxKeyDepth,
    lengthRatio: lengthRatio ?? this.lengthRatio,
    flattened: flattened ?? this.flattened,
    reporter: reporter ?? this.reporter,
    groupBy: groupBy ?? this.groupBy,
    output: output ?? this.output,
    color: color ?? this.color,
    width: width ?? this.width,
    verbose: verbose ?? this.verbose,
    info: info ?? this.info,
    warn: warn ?? this.warn,
    debug: debug ?? this.debug,
    text: text ?? this.text,
  );
}

/// Options after defaults, aliases and text forms have been resolved.
class Chki18nResolvedOptions {
  /// Creates the resolved shape. Built by `resolveOptions`.
  const Chki18nResolvedOptions({
    required this.path,
    required this.target,
    required this.format,
    required this.enabledChecks,
    required this.levels,
    required this.interpolationPrefix,
    required this.interpolationSuffix,
    required this.exclude,
    required this.excludeFiles,
    required this.source,
    required this.translateFunctions,
    required this.keyCase,
    required this.maxKeyDepth,
    required this.lengthRatio,
    required this.reporter,
    required this.groupBy,
    required this.output,
    required this.outputReporter,
    required this.color,
    required this.width,
    required this.flattened,
    required this.verbose,
    required this.info,
    required this.warn,
    required this.debug,
  });

  /// Directory holding the translation files, or `null` when none was given.
  final String? path;

  /// Locale every other locale is compared against.
  final String target;

  /// On-disk layout, forced or left at `auto` for the scanner to detect.
  final Chki18nFileFormat format;

  /// The checks this run will report.
  final Set<Chki18nCheckCode> enabledChecks;

  /// Severity overrides, or `null` when every check keeps its own.
  final Map<Chki18nCheckCode, Chki18nLevel>? levels;

  /// Opening delimiter of an interpolation placeholder.
  final String interpolationPrefix;

  /// Closing delimiter of an interpolation placeholder.
  final String interpolationSuffix;

  /// Directories skipped while scanning, by name or by path from the root.
  final Set<String> exclude;

  /// File name patterns never read as translations.
  final Set<String> excludeFiles;

  /// Directory of source files to search for key usages, or `null`.
  final String? source;

  /// Names a translation call goes by.
  final List<String> translateFunctions;

  /// Case every key segment has to use, or `null` to leave key names alone.
  final Chki18nKeyCase? keyCase;

  /// Levels a key may be nested, or `null` to leave key depth alone.
  final int? maxKeyDepth;

  /// How far a value's length may be from the target language's, or `null`.
  final double? lengthRatio;

  /// Shape the report is rendered in.
  final Chki18nReporter reporter;

  /// Axis the report groups its issues by.
  final Chki18nGroupBy groupBy;

  /// File the report is also written to, or `null`.
  final String? output;

  /// Reporter the [output] file gets. `null` when nothing is written.
  final Chki18nReporter? outputReporter;

  /// Whether the console report may use colour.
  final bool color;

  /// Columns asked for, or `null` to measure the terminal instead.
  final int? width;

  /// Whether the input is already flattened.
  final bool flattened;

  /// Whether the run prints its report.
  final bool verbose;

  /// Whether info level lines are shown.
  final bool info;

  /// Whether warn level lines are shown.
  final bool warn;

  /// Whether debug lines are shown.
  final bool debug;

  /// The resolved options as JSON, which is what `--debug` prints.
  Map<String, Object?> toJson() => {
    'path': path,
    'target': target,
    'format': format.name,
    'enabledChecks': [for (final code in enabledChecks) code.code],
    'levels':
        levels == null
            ? null
            : {for (final entry in levels!.entries) entry.key.code: entry.value.name},
    'interpolationPrefix': interpolationPrefix,
    'interpolationSuffix': interpolationSuffix,
    'exclude': exclude.toList(),
    'excludeFiles': excludeFiles.toList(),
    'source': source,
    'translateFunctions': translateFunctions,
    'keyCase': keyCase?.name,
    'maxKeyDepth': maxKeyDepth,
    'lengthRatio': lengthRatio,
    'reporter': reporter.name,
    'groupBy': groupBy.name,
    'output': output,
    'outputReporter': outputReporter?.name,
    'color': color,
    'width': width,
    'flattened': flattened,
    'verbose': verbose,
    'info': info,
    'warn': warn,
    'debug': debug,
  };
}

/// Input accepted by `analyzeTranslations`.
class Chki18nInput {
  /// Creates the input of one comparison. Give it [groups] or [locales], not
  /// both — [locales] is the shorthand for a single unnamed group.
  const Chki18nInput({
    this.groups,
    this.locales,
    this.files,
    this.issues,
    this.fileFormat,
    this.unusedKeys,
    this.undefinedKeys,
  });

  /// Several comparable sets, e.g. one entry per translation file name.
  final TranslationGroups? groups;

  /// A single set. Shorthand for `{'': locales}`.
  final Map<String, TranslationMap>? locales;

  /// Maps a `group/locale` pair onto the file it was read from.
  final List<Chki18nSourceFile>? files;

  /// Issues found while producing this input, e.g. a file that could not be
  /// parsed. They are reported alongside the comparison's own findings.
  final List<Chki18nIssue>? issues;

  /// Layout the input came from, carried through to the result.
  final Chki18nFileFormat? fileFormat;

  /// Flattened keys nothing appears to reference, as `UNUSED_KEY` issues.
  ///
  /// Whether a key is used is a fact about the source tree rather than about
  /// the translations, so it is supplied rather than worked out here.
  /// `checkTranslationFiles` fills this in when given a `source` directory; an
  /// application that already knows can pass its own answer.
  final List<String>? unusedKeys;

  /// Keys the scanned source asks for that no language file defines, as
  /// `UNDEFINED_KEY` issues. Supplied for the same reason as [unusedKeys].
  final List<Chki18nKeyUsage>? undefinedKeys;
}

/// One key of one group, as fed to the incremental `checkEntry`.
class Chki18nEntry {
  /// Creates one key's worth of input.
  const Chki18nEntry({required this.key, required this.values, this.group, this.locales});

  /// The flattened key being checked.
  final String key;

  /// `locale -> value`. The target locale's value is read from here too.
  final Map<String, Object?> values;

  /// Group the key belongs to, carried through to every issue.
  final String? group;

  /// Locales to compare. Defaults to the keys of [values]; pass it explicitly
  /// when a locale that owns no value still has to be reported as missing.
  final List<String>? locales;
}
