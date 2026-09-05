/// The single definition of every option, and the one place they are resolved.
///
/// The CLI builds its parser and its help text from [optionDefinitions] and the
/// Dart API resolves the same fields, so a flag and its option counterpart can
/// never drift apart.
library;

import 'package:chki18n/src/constants.dart';
import 'package:chki18n/src/core/issue.dart';
import 'package:chki18n/src/types.dart';

/// What a command line flag carries after its name.
enum Chki18nOptionType {
  /// One value, e.g. `--target en`.
  string,

  /// No value at all, e.g. `--debug`.
  boolean,

  /// A comma or space separated list, e.g. `--checks NO_KEY,EMPTY_VALUE`.
  list,
}

/// One option, as both a CLI flag and an API field.
class Chki18nOptionDefinition {
  /// Describes one option.
  const Chki18nOptionDefinition({
    required this.flag,
    required this.option,
    required this.type,
    required this.description,
    this.valueName,
  });

  /// CLI flag, without the leading dashes.
  final String flag;

  /// Field name on [Chki18nOptions], in its Dart spelling.
  final String option;

  /// What the flag carries after its name.
  final Chki18nOptionType type;

  /// Placeholder shown in the usage text for value taking flags.
  final String? valueName;

  /// One line, as the usage text prints it.
  final String description;
}

/// Every option the CLI and the Dart API share, in the order `--help` lists
/// them.
final List<Chki18nOptionDefinition> optionDefinitions = [
  const Chki18nOptionDefinition(
    flag: 'path',
    option: 'path',
    type: Chki18nOptionType.string,
    valueName: '<dir>',
    description: 'The directory where the files to be scanned are located (required)',
  ),
  Chki18nOptionDefinition(
    flag: 'target',
    option: 'target',
    type: Chki18nOptionType.string,
    valueName: '<locale>',
    description:
        'The language every other language is compared against (default: '
        '`$defaultTargetLocale`)',
  ),
  const Chki18nOptionDefinition(
    flag: 'format',
    option: 'format',
    type: Chki18nOptionType.string,
    valueName: '<format>',
    description: 'Layout of the translation files: `auto`, `single`, `folder` or `nested`',
  ),
  const Chki18nOptionDefinition(
    flag: 'checks',
    option: 'checks',
    type: Chki18nOptionType.list,
    valueName: '<codes>',
    description: 'Run only these comma separated check codes',
  ),
  const Chki18nOptionDefinition(
    flag: 'ignore-checks',
    option: 'ignoreChecks',
    type: Chki18nOptionType.list,
    valueName: '<codes>',
    description: 'Run every check except these comma separated check codes',
  ),
  const Chki18nOptionDefinition(
    flag: 'levels',
    option: 'levels',
    type: Chki18nOptionType.list,
    valueName: '<code=level>',
    description: 'Report a check at another severity, e.g. `EMPTY_VALUE=error`',
  ),
  Chki18nOptionDefinition(
    flag: 'interpolation-prefix',
    option: 'interpolationPrefix',
    type: Chki18nOptionType.string,
    valueName: '<str>',
    description:
        'Opening delimiter of an interpolation key (default: `$defaultInterpolationPrefix`)',
  ),
  Chki18nOptionDefinition(
    flag: 'interpolation-suffix',
    option: 'interpolationSuffix',
    type: Chki18nOptionType.string,
    valueName: '<str>',
    description:
        'Closing delimiter of an interpolation key (default: `$defaultInterpolationSuffix`)',
  ),
  const Chki18nOptionDefinition(
    flag: 'exclude',
    option: 'exclude',
    type: Chki18nOptionType.list,
    valueName: '<dirs>',
    description: 'Comma separated directory names or paths to skip while scanning',
  ),
  const Chki18nOptionDefinition(
    flag: 'exclude-files',
    option: 'excludeFiles',
    type: Chki18nOptionType.list,
    valueName: '<globs>',
    description: 'Comma separated file name patterns never read as translations',
  ),
  const Chki18nOptionDefinition(
    flag: 'source',
    option: 'source',
    type: Chki18nOptionType.string,
    valueName: '<dir>',
    description: 'Source files to read for key usages (enables `UNUSED_KEY` and `UNDEFINED_KEY`)',
  ),
  Chki18nOptionDefinition(
    flag: 'translate-functions',
    option: 'translateFunctions',
    type: Chki18nOptionType.list,
    valueName: '<names>',
    description:
        'Comma separated names a translation call goes by (default: '
        '`${translationFunctions.join('`, `')}`)',
  ),
  Chki18nOptionDefinition(
    flag: 'key-case',
    option: 'keyCase',
    type: Chki18nOptionType.string,
    valueName: '<case>',
    description:
        'Case every key segment has to use: '
        '`${Chki18nKeyCase.values.map((value) => value.name).join('`, `')}`',
  ),
  const Chki18nOptionDefinition(
    flag: 'max-key-depth',
    option: 'maxKeyDepth',
    type: Chki18nOptionType.string,
    valueName: '<levels>',
    description: 'How many levels a key may be nested, e.g. `2` for `attr.folder`',
  ),
  const Chki18nOptionDefinition(
    flag: 'length-ratio',
    option: 'lengthRatio',
    type: Chki18nOptionType.string,
    valueName: '<times>',
    description: 'Report a value more than this many times longer or shorter than the target',
  ),
  Chki18nOptionDefinition(
    flag: 'reporter',
    option: 'reporter',
    type: Chki18nOptionType.string,
    valueName: '<name>',
    description:
        'How to render the report: '
        '`${Chki18nReporter.values.map((value) => value.name).join('`, `')}`',
  ),
  Chki18nOptionDefinition(
    flag: 'group-by',
    option: 'groupBy',
    type: Chki18nOptionType.string,
    valueName: '<axis>',
    description:
        'Group the reported issues by '
        '`${Chki18nGroupBy.values.map((value) => value.name).join('`, `')}`',
  ),
  const Chki18nOptionDefinition(
    flag: 'output',
    option: 'output',
    type: Chki18nOptionType.string,
    valueName: '<file>',
    description: 'Also write the report to this file, in the format its extension implies',
  ),
  const Chki18nOptionDefinition(
    flag: 'width',
    option: 'width',
    type: Chki18nOptionType.string,
    valueName: '<columns>',
    description: 'Lay the report out to this many columns instead of measuring the terminal',
  ),
  const Chki18nOptionDefinition(
    flag: 'no-color',
    option: 'color',
    type: Chki18nOptionType.boolean,
    description: 'Do not colour the output',
  ),
  const Chki18nOptionDefinition(
    flag: 'no-info',
    option: 'info',
    type: Chki18nOptionType.boolean,
    description: 'Do not show info messages',
  ),
  const Chki18nOptionDefinition(
    flag: 'no-warn',
    option: 'warn',
    type: Chki18nOptionType.boolean,
    description: 'Do not show warning messages',
  ),
  const Chki18nOptionDefinition(
    flag: 'debug',
    option: 'debug',
    type: Chki18nOptionType.boolean,
    description: 'Show debug messages',
  ),
];

final RegExp _listSeparator = RegExp(r'[,\s]+');

/// Accepts `'A,B'` and `'A B'` alike, and drops what is left over.
List<String> splitOptionList(String? value) {
  if (value == null || value.trim().isEmpty) {
    return const [];
  }

  return [
    for (final item in value.split(_listSeparator))
      if (item.trim().isNotEmpty) item.trim(),
  ];
}

/// The reporter a file name asks for.
///
/// A `.json` or a `.md` report has a shape of its own; anything else is read as
/// plain text and gets the default reporter without its colours.
Chki18nReporter reporterOfFileName(String fileName) {
  final extension = fileName.split('.').last.toLowerCase();

  return reporterByExtension[extension] ?? defaultReporter;
}

/// Usage text for `--help`, generated from [optionDefinitions].
String buildUsageText(String binName) {
  final lines = [
    for (final definition in optionDefinitions)
      '  ${'--${definition.flag}'
              '${definition.valueName == null ? '' : ' ${definition.valueName}'}'.padRight(32)}'
          '${definition.description}',
  ];

  return [
    'Usage: `$binName [options]` or `$binName [options] <targetDirectory>`',
    '',
    'Options:',
    ...lines,
    '  --help                          Show this message',
    '  --version                       Show the installed version',
    '',
    'Check codes: ${analyzeCheckCodes.map((code) => code.code).join(', ')}',
  ].join('\n');
}

final RegExp _flagToCamel = RegExp('-([a-z])');

String _toCamelCase(String value) =>
    value.replaceAllMapped(_flagToCamel, (match) => match[1]!.toUpperCase());

/// Reads raw CLI arguments into the option shape shared with the Dart API.
///
/// `--path` and a bare positional argument mean the same thing, and negated
/// booleans (`--no-warn`) arrive already inverted. Everything a flag cannot
/// type as a value lands in [Chki18nOptions.text], which `resolveOptions`
/// parses and reports on.
Chki18nOptions optionsFromArgs(Map<String, Object?> args) {
  Object? read(String flag) => args[flag] ?? args[_toCamelCase(flag)];

  String? readString(String flag) {
    final value = read(flag);

    return value == null ? null : '$value';
  }

  bool? readBool(String flag) {
    final value = read(flag);

    return value is bool ? value : null;
  }

  final positional = args['_'];
  final path =
      readString('path') ??
      (positional is List && positional.isNotEmpty ? '${positional.first}' : null);

  return Chki18nOptions(
    path: path,
    target: readString('target'),
    interpolationPrefix: readString('interpolation-prefix'),
    interpolationSuffix: readString('interpolation-suffix'),
    source: readString('source'),
    output: readString('output'),
    color: readBool('color'),
    info: readBool('info'),
    warn: readBool('warn'),
    debug: readBool('debug'),
    text: Chki18nTextOptions(
      format: readString('format'),
      checks: readString('checks'),
      ignoreChecks: readString('ignore-checks'),
      levels: readString('levels'),
      exclude: readString('exclude'),
      excludeFiles: readString('exclude-files'),
      translateFunctions: readString('translate-functions'),
      keyCase: readString('key-case'),
      maxKeyDepth: readString('max-key-depth'),
      lengthRatio: readString('length-ratio'),
      reporter: readString('reporter'),
      groupBy: readString('group-by'),
      width: readString('width'),
    ),
  );
}

/// Resolved options, and whatever could not be used as given.
class Chki18nResolvedResult {
  /// Pairs the resolved options with the issues resolving them raised.
  const Chki18nResolvedResult(this.options, this.issues);

  /// The options every check of this run reads.
  final Chki18nResolvedOptions options;

  /// What could not be used as given, as `INVALID_OPTIONS` issues.
  final List<Chki18nIssue> issues;
}

/// Fills in defaults and normalises the loose forms an option may take, so that
/// everything downstream reads a single resolved shape.
///
/// Anything unusable is reported as an `INVALID_OPTIONS` issue instead of
/// throwing: a typo in one flag should not stop the rest of the scan.
Chki18nResolvedResult resolveOptions([Chki18nOptions? options, Chki18nOptions? defaults]) {
  final raw = options ?? const Chki18nOptions();
  final base = defaults ?? const Chki18nOptions();
  final text = raw.text;
  final issues = <Chki18nIssue>[];

  void invalid(String message) {
    issues.add(createIssue(Chki18nCheckCode.invalidOptions, message: message));
  }

  var target = raw.target ?? base.target;

  if (target == null || target.isEmpty) {
    // Reported so a caller can see which language it ended up comparing
    // against, but at `info`: leaving `target` out is a default, not a fault.
    issues.add(
      createIssue(
        Chki18nCheckCode.invalidOptions,
        level: Chki18nLevel.info,
        message: 'No target language is specified. Defaulting to `$defaultTargetLocale`.',
      ),
    );
    target = defaultTargetLocale;
  }

  var format = raw.format ?? base.format;

  if (format == null && text?.format != null) {
    format = Chki18nFileFormat.parse(text!.format!);

    if (format == null) {
      invalid('Unknown format `${text.format}`. Defaulting to `${Chki18nFileFormat.auto.name}`.');
    }
  }

  List<Chki18nCheckCode> readCheckCodes(
    List<Chki18nCheckCode>? typed,
    String? written,
    String optionName,
  ) {
    if (typed != null) {
      return typed;
    }

    final codes = <Chki18nCheckCode>[];

    for (final item in splitOptionList(written)) {
      final code = Chki18nCheckCode.parse(item);

      if (code == null) {
        invalid('Unknown check code `$item` in `$optionName` was ignored.');
        continue;
      }

      codes.add(code);
    }

    return codes;
  }

  final only = readCheckCodes(raw.checks ?? base.checks, text?.checks, 'checks');
  final ignored = readCheckCodes(
    raw.ignoreChecks ?? base.ignoreChecks,
    text?.ignoreChecks,
    'ignoreChecks',
  );
  final Set<Chki18nCheckCode> enabledChecks;

  if (only.isNotEmpty) {
    if (ignored.isNotEmpty) {
      invalid('`checks` and `ignoreChecks` cannot be used together. `ignoreChecks` was ignored.');
    }

    enabledChecks = {...only};
  } else {
    enabledChecks = {...analyzeCheckCodes}..removeAll(ignored);
  }

  Map<Chki18nCheckCode, Chki18nLevel>? levels;

  void addLevel(Chki18nCheckCode code, Chki18nLevel level) {
    (levels ??= <Chki18nCheckCode, Chki18nLevel>{})[code] = level;
  }

  final typedLevels = raw.levels ?? base.levels;

  if (typedLevels != null) {
    for (final entry in typedLevels.entries) {
      if (!analyzeCheckCodes.contains(entry.key)) {
        invalid('`${entry.key.code}` in `levels` is not a check whose severity can be changed.');
        continue;
      }

      addLevel(entry.key, entry.value);
    }
  } else {
    // `CODE=level` pairs, as the CLI writes them.
    for (final entry in splitOptionList(text?.levels)) {
      final parts = entry.split('=');
      final code = Chki18nCheckCode.parse(parts.first);
      final level = parts.length > 1 ? Chki18nLevel.parse(parts[1]) : null;

      if (code == null || !analyzeCheckCodes.contains(code)) {
        invalid('`${parts.first}` in `levels` is not a check whose severity can be changed.');
        continue;
      }

      if (level == null) {
        invalid(
          '`${parts.length > 1 ? parts[1] : ''}` is not a level. '
          'Use `error`, `warn` or `info`.',
        );
        continue;
      }

      addLevel(code, level);
    }
  }

  /// Reads a number an option needs, or `null` when there is none to read.
  ///
  /// An unusable value is reported and dropped rather than guessed at: a check
  /// that runs on a number nobody meant is worse than one that does not run.
  double? readNumber(String? written, String optionName, double least) {
    if (written == null || written.trim().isEmpty) {
      return null;
    }

    final parsed = double.tryParse(written.trim());

    if (parsed == null || !parsed.isFinite || parsed < least) {
      invalid('`$written` is not a usable `$optionName`. It was ignored.');

      return null;
    }

    return parsed;
  }

  var width = raw.width ?? base.width;

  if (width == null) {
    width = readNumber(text?.width, 'width', 1)?.floor();
  } else if (width < 1) {
    invalid('`$width` is not a usable `width`. It was ignored.');
    width = null;
  }

  var maxKeyDepth = raw.maxKeyDepth ?? base.maxKeyDepth;

  if (maxKeyDepth == null) {
    maxKeyDepth = readNumber(text?.maxKeyDepth, 'maxKeyDepth', 1)?.floor();
  } else if (maxKeyDepth < 1) {
    invalid('`$maxKeyDepth` is not a usable `maxKeyDepth`. It was ignored.');
    maxKeyDepth = null;
  }

  // A ratio of one would report every value whose length is not exactly the
  // target's, which is every value there is.
  var lengthRatio = raw.lengthRatio ?? base.lengthRatio;

  if (lengthRatio == null) {
    lengthRatio = readNumber(text?.lengthRatio, 'lengthRatio', 1.01);
  } else if (lengthRatio < 1.01) {
    invalid('`$lengthRatio` is not a usable `lengthRatio`. It was ignored.');
    lengthRatio = null;
  }

  var keyCase = raw.keyCase ?? base.keyCase;

  if (keyCase == null && text?.keyCase != null) {
    keyCase = Chki18nKeyCase.parse(text!.keyCase!);

    if (keyCase == null) {
      invalid('Unknown `keyCase` value `${text.keyCase}`. Key names were not checked.');
    }
  }

  var reporter = raw.reporter ?? base.reporter;
  final reporterNamed = reporter != null || (text?.reporter?.trim().isNotEmpty ?? false);

  if (reporter == null && (text?.reporter?.trim().isNotEmpty ?? false)) {
    reporter = Chki18nReporter.parse(text!.reporter!);

    if (reporter == null) {
      invalid(
        'Unknown `reporter` value `${text.reporter}`. Defaulting to `${defaultReporter.name}`.',
      );
    }
  }

  var groupBy = raw.groupBy ?? base.groupBy;

  if (groupBy == null && (text?.groupBy?.trim().isNotEmpty ?? false)) {
    groupBy = Chki18nGroupBy.parse(text!.groupBy!);

    if (groupBy == null) {
      invalid('Unknown `groupBy` value `${text.groupBy}`. Defaulting to `${defaultGroupBy.name}`.');
    }
  }

  final excludeList = raw.exclude ?? base.exclude ?? splitOptionList(text?.exclude);
  final excludeFileList =
      raw.excludeFiles ?? base.excludeFiles ?? splitOptionList(text?.excludeFiles);
  final translateFunctionList =
      raw.translateFunctions ??
      base.translateFunctions ??
      splitOptionList(text?.translateFunctions);
  final output = raw.output ?? base.output;
  final resolvedReporter = reporter ?? defaultReporter;

  return Chki18nResolvedResult(
    Chki18nResolvedOptions(
      path: (raw.path ?? base.path)?.isEmpty ?? true ? null : (raw.path ?? base.path),
      target: target,
      format: format ?? Chki18nFileFormat.auto,
      enabledChecks: enabledChecks,
      levels: levels,
      interpolationPrefix: _firstNonEmpty(
        raw.interpolationPrefix,
        base.interpolationPrefix,
        defaultInterpolationPrefix,
      ),
      interpolationSuffix: _firstNonEmpty(
        raw.interpolationSuffix,
        base.interpolationSuffix,
        defaultInterpolationSuffix,
      ),
      exclude: {...excludeList.isNotEmpty ? excludeList : defaultExcludeDirs},
      excludeFiles: {...excludeFileList.isNotEmpty ? excludeFileList : defaultExcludeFiles},
      source: (raw.source ?? base.source)?.isEmpty ?? true ? null : (raw.source ?? base.source),
      translateFunctions:
          translateFunctionList.isNotEmpty ? translateFunctionList : translationFunctions,
      keyCase: keyCase,
      maxKeyDepth: maxKeyDepth,
      lengthRatio: lengthRatio,
      reporter: resolvedReporter,
      groupBy: groupBy ?? defaultGroupBy,
      output: output == null || output.isEmpty ? null : output,
      // An explicit `reporter` always wins, so `--reporter list --output
      // out.txt` writes a list. Without one the file name decides, which is
      // what makes `--output report.json` do the obvious thing on its own.
      outputReporter:
          output == null || output.isEmpty
              ? null
              : (reporterNamed ? resolvedReporter : reporterOfFileName(output)),
      color: (raw.color ?? base.color) != false,
      width: width,
      flattened: (raw.flattened ?? base.flattened) == true,
      verbose: (raw.verbose ?? base.verbose) == true,
      info: (raw.info ?? base.info) != false,
      warn: (raw.warn ?? base.warn) != false,
      debug: (raw.debug ?? base.debug) == true,
    ),
    issues,
  );
}

String _firstNonEmpty(String? first, String? second, String fallback) {
  if (first != null && first.isNotEmpty) {
    return first;
  }

  if (second != null && second.isNotEmpty) {
    return second;
  }

  return fallback;
}
