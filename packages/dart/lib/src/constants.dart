/// Every value the library is configured with, and the table of checks it runs.
///
/// The JavaScript package writes these as string unions; Dart has enums, so
/// each one carries the wire spelling the CLI and the JSON reporter use. That
/// spelling is the contract — `Chki18nCheckCode.noKey.code` is `NO_KEY` in
/// every package.
library;

/// A problem a check can report.
///
/// The `INVALID_*` codes and [unknown] describe how the run itself went rather
/// than what the translations say, which is why they are not in
/// [analyzeCheckCodes] and cannot be switched off.
enum Chki18nCheckCode {
  /// An unexpected problem occurred.
  unknown('UNKNOWN'),

  /// An option value is missing or not usable.
  invalidOptions('INVALID_OPTIONS'),

  /// A translation file is missing, empty, unreadable or not valid JSON.
  invalidFile('INVALID_FILE'),

  /// A value is not a string, so it cannot be compared or translated.
  invalidValueType('INVALID_VALUE_TYPE'),

  /// A group holds no translations at all for a language.
  noLocale('NO_LOCALE'),

  /// The key exists in the target language and is missing here.
  noKey('NO_KEY'),

  /// The key is missing from the target language, so it may be unused.
  dummyKey('DUMMY_KEY'),

  /// The key is defined twice, so one of its two values is silently lost.
  duplicateKey('DUPLICATE_KEY'),

  /// Nothing in the scanned sources appears to reference this key.
  unusedKey('UNUSED_KEY'),

  /// The source calls for this key and no language file defines it.
  undefinedKey('UNDEFINED_KEY'),

  /// The language needs a plural form of this key that the file does not have.
  noPluralForm('NO_PLURAL_FORM'),

  /// The key is not written in the case `keyCase` asks for.
  keyNaming('KEY_NAMING'),

  /// The key has more levels than `maxKeyDepth` allows.
  keyDepth('KEY_DEPTH'),

  /// The key is defined but its value is an empty string.
  emptyValue('EMPTY_VALUE'),

  /// An interpolation key of the target language is missing from this value.
  noInterpolationKey('NO_INTERPOLATION_KEY'),

  /// This value has an interpolation key the target language does not define.
  extraInterpolationKey('EXTRA_INTERPOLATION_KEY'),

  /// The value repeats an interpolation key a different number of times.
  interpolationCount('INTERPOLATION_COUNT'),

  /// The markup tags of this value are not the target language's.
  tagMismatch('TAG_MISMATCH'),

  /// The value is identical to the target language.
  notTranslatedValue('NOT_TRANSLATED_VALUE'),

  /// The value holds no character of the script this language is written in.
  untranslatedScript('UNTRANSLATED_SCRIPT'),

  /// Another key in the same locale already uses this value.
  duplicateValue('DUPLICATE_VALUE'),

  /// Another key with the same target language value is translated differently.
  inconsistentValue('INCONSISTENT_VALUE'),

  /// The value has leading or trailing whitespace.
  surroundingWhitespace('SURROUNDING_WHITESPACE'),

  /// The value holds a zero width, bidirectional or non-breaking character.
  invisibleCharacter('INVISIBLE_CHARACTER'),

  /// The target language value contains digits and this value does not.
  missingNumber('MISSING_NUMBER'),

  /// The numbers in this value are not the target language's.
  numberMismatch('NUMBER_MISMATCH'),

  /// The value is further from the target language length than allowed.
  suspiciousLength('SUSPICIOUS_LENGTH');

  const Chki18nCheckCode(this.code);

  /// The spelling every package, the CLI and the JSON reporter share.
  final String code;

  /// The check a wire spelling names, or `null` when it names none.
  static Chki18nCheckCode? parse(String value) {
    final wanted = value.trim().toUpperCase();

    for (final code in values) {
      if (code.code == wanted) {
        return code;
      }
    }

    return null;
  }

  @override
  String toString() => code;
}

/// How badly a reported issue is meant to be taken.
enum Chki18nLevel {
  /// Fails the run.
  error,

  /// Worth fixing, but never fails a run.
  warn,

  /// A note. Never fails a run.
  info;

  /// The level a wire spelling names, or `null` when it names none.
  static Chki18nLevel? parse(String value) {
    final wanted = value.trim().toLowerCase();

    for (final level in values) {
      if (level.name == wanted) {
        return level;
      }
    }

    return null;
  }

  @override
  String toString() => name;
}

/// Everything a consumer needs to render a check without hard-coding strings.
class Chki18nCheckMeta {
  /// Creates the description of one check.
  const Chki18nCheckMeta({required this.level, required this.summary, required this.description});

  /// The severity the check reports at unless `levels` re-grades it.
  final Chki18nLevel level;

  /// A heading for a list of occurrences.
  final String summary;

  /// What the check means, in one sentence.
  final String description;
}

/// What each check is called, what it means, and how badly it is meant.
const Map<Chki18nCheckCode, Chki18nCheckMeta> checkMeta = {
  Chki18nCheckCode.unknown: Chki18nCheckMeta(
    level: Chki18nLevel.error,
    summary: 'An unexpected problem occurred',
    description: 'Unknown error.',
  ),
  Chki18nCheckCode.invalidOptions: Chki18nCheckMeta(
    level: Chki18nLevel.warn,
    summary: 'Some options could not be used as given',
    description: 'The option value is missing or not usable.',
  ),
  Chki18nCheckCode.invalidFile: Chki18nCheckMeta(
    level: Chki18nLevel.error,
    summary: 'Some translation files could not be read',
    description: 'The file is missing, empty, unreadable or not valid JSON.',
  ),
  Chki18nCheckCode.invalidValueType: Chki18nCheckMeta(
    level: Chki18nLevel.warn,
    summary: 'Some values are not translatable strings',
    description: 'The value is not a string, so it cannot be compared or translated.',
  ),
  Chki18nCheckCode.noLocale: Chki18nCheckMeta(
    level: Chki18nLevel.error,
    summary: 'Some languages have no file in a group at all',
    description: 'This group holds no translations for the language, so none of its keys exist.',
  ),
  Chki18nCheckCode.noKey: Chki18nCheckMeta(
    level: Chki18nLevel.error,
    summary: 'Some translation files did not include the following keys',
    description: 'The key exists in the target language but is missing here.',
  ),
  Chki18nCheckCode.dummyKey: Chki18nCheckMeta(
    level: Chki18nLevel.warn,
    summary: 'The following keys do not exist in the target language',
    description: 'The key is missing from the target language, so it may be unused.',
  ),
  Chki18nCheckCode.duplicateKey: Chki18nCheckMeta(
    level: Chki18nLevel.error,
    summary: 'Some keys are defined more than once',
    description: 'The key is defined twice, so one of its two values is silently lost.',
  ),
  Chki18nCheckCode.unusedKey: Chki18nCheckMeta(
    level: Chki18nLevel.info,
    summary: 'The following keys were not found in the scanned source files',
    description: 'Nothing in the scanned sources appears to reference this key.',
  ),
  Chki18nCheckCode.keyNaming: Chki18nCheckMeta(
    level: Chki18nLevel.warn,
    summary: 'Some keys are not named the way the project asked',
    description: 'The key is not written in the case `keyCase` asks for.',
  ),
  Chki18nCheckCode.keyDepth: Chki18nCheckMeta(
    level: Chki18nLevel.warn,
    summary: 'Some keys are nested deeper than the project allows',
    description: 'The key has more levels than `maxKeyDepth` allows.',
  ),
  Chki18nCheckCode.undefinedKey: Chki18nCheckMeta(
    level: Chki18nLevel.warn,
    summary: 'The scanned source files ask for keys nothing defines',
    description: 'The source calls for this key and no language file defines it.',
  ),
  Chki18nCheckCode.noPluralForm: Chki18nCheckMeta(
    level: Chki18nLevel.warn,
    summary: 'Some keys are missing a plural form their language needs',
    description: 'The language needs a plural form of this key that the file does not define.',
  ),
  Chki18nCheckCode.emptyValue: Chki18nCheckMeta(
    level: Chki18nLevel.warn,
    summary: 'The value for the following items is empty',
    description: 'The key is defined but its value is an empty string.',
  ),
  Chki18nCheckCode.noInterpolationKey: Chki18nCheckMeta(
    level: Chki18nLevel.error,
    summary: 'The interpolation key does not match the target language',
    description: 'An interpolation key of the target language is missing from this value.',
  ),
  Chki18nCheckCode.extraInterpolationKey: Chki18nCheckMeta(
    level: Chki18nLevel.error,
    summary: 'Some values use interpolation keys the target language does not have',
    description: 'This value has an interpolation key that the target language does not define.',
  ),
  Chki18nCheckCode.interpolationCount: Chki18nCheckMeta(
    level: Chki18nLevel.error,
    summary: 'Some values use an interpolation key a different number of times',
    description:
        'The value repeats an interpolation key more or fewer times than the target language.',
  ),
  Chki18nCheckCode.tagMismatch: Chki18nCheckMeta(
    level: Chki18nLevel.warn,
    summary: 'Some values do not carry the same markup as the target language',
    description: 'The markup tags of this value are not the ones the target language uses.',
  ),
  Chki18nCheckCode.notTranslatedValue: Chki18nCheckMeta(
    level: Chki18nLevel.warn,
    summary: 'Some keys have the same value as the target language',
    description:
        'The value is identical to the target language, so the translation may be incomplete.',
  ),
  Chki18nCheckCode.untranslatedScript: Chki18nCheckMeta(
    level: Chki18nLevel.warn,
    summary: 'Some values are not written in the script of their language',
    description: 'The value holds no character of the script this language is written in.',
  ),
  Chki18nCheckCode.duplicateValue: Chki18nCheckMeta(
    level: Chki18nLevel.warn,
    summary: 'Some keys have duplicate values',
    description: 'Another key in the same locale already uses this value.',
  ),
  Chki18nCheckCode.inconsistentValue: Chki18nCheckMeta(
    level: Chki18nLevel.warn,
    summary: 'Some keys with one shared original are translated differently',
    description: 'Another key with the same target language value is translated differently here.',
  ),
  Chki18nCheckCode.surroundingWhitespace: Chki18nCheckMeta(
    level: Chki18nLevel.warn,
    summary: 'Some values begin or end with whitespace',
    description: 'The value has leading or trailing whitespace, which is usually accidental.',
  ),
  Chki18nCheckCode.invisibleCharacter: Chki18nCheckMeta(
    level: Chki18nLevel.warn,
    summary: 'Some values hold a character nothing will draw',
    description: 'The value holds a zero width, bidirectional or non-breaking character.',
  ),
  Chki18nCheckCode.missingNumber: Chki18nCheckMeta(
    level: Chki18nLevel.warn,
    summary: 'Some values dropped a number the target language has',
    description: 'The target language value contains digits but this value does not.',
  ),
  Chki18nCheckCode.numberMismatch: Chki18nCheckMeta(
    level: Chki18nLevel.warn,
    summary: 'Some values changed a number the target language has',
    description: 'The numbers in this value are not the ones the target language uses.',
  ),
  Chki18nCheckCode.suspiciousLength: Chki18nCheckMeta(
    level: Chki18nLevel.info,
    summary: 'Some values are far longer or shorter than the target language',
    description: 'The value is further from the target language length than `lengthRatio` allows.',
  ),
};

/// Checks that compare translation data, in report order.
///
/// `INVALID_*` and `UNKNOWN` are excluded: they report how the run itself went
/// and cannot be switched off through `checks` / `ignoreChecks`.
const List<Chki18nCheckCode> analyzeCheckCodes = [
  Chki18nCheckCode.invalidValueType,
  Chki18nCheckCode.noLocale,
  Chki18nCheckCode.noKey,
  Chki18nCheckCode.dummyKey,
  Chki18nCheckCode.duplicateKey,
  Chki18nCheckCode.unusedKey,
  Chki18nCheckCode.undefinedKey,
  Chki18nCheckCode.noPluralForm,
  Chki18nCheckCode.keyNaming,
  Chki18nCheckCode.keyDepth,
  Chki18nCheckCode.emptyValue,
  Chki18nCheckCode.noInterpolationKey,
  Chki18nCheckCode.extraInterpolationKey,
  Chki18nCheckCode.interpolationCount,
  Chki18nCheckCode.tagMismatch,
  Chki18nCheckCode.notTranslatedValue,
  Chki18nCheckCode.untranslatedScript,
  Chki18nCheckCode.duplicateValue,
  Chki18nCheckCode.inconsistentValue,
  Chki18nCheckCode.surroundingWhitespace,
  Chki18nCheckCode.invisibleCharacter,
  Chki18nCheckCode.missingNumber,
  Chki18nCheckCode.numberMismatch,
  Chki18nCheckCode.suspiciousLength,
];

/// Checks that need to see every key of a locale at once, so they cannot be
/// answered by `checkEntry`, which is handed one key at a time.
const List<Chki18nCheckCode> crossKeyCheckCodes = [
  Chki18nCheckCode.duplicateValue,
  // Two keys have to be seen together for one to be the other's disagreement,
  // and a language missing from a group is a fact about the whole group.
  Chki18nCheckCode.inconsistentValue,
  Chki18nCheckCode.noLocale,
  // A key can only be seen twice by looking at the whole file, and whether one
  // is referenced is a fact about the source tree rather than about the key.
  Chki18nCheckCode.duplicateKey,
  Chki18nCheckCode.unusedKey,
  // Whether the source asks for a key is a fact about the source tree, and a
  // language needs every form of a plural key before any of them is right.
  Chki18nCheckCode.undefinedKey,
  Chki18nCheckCode.noPluralForm,
];

/// How translation files are laid out on disk.
enum Chki18nFileFormat {
  /// Decide by looking at the scanned paths.
  auto,

  /// One file per locale: `en.json`, `ko.json`.
  single,

  /// One folder per locale: `en/common.json`, `ko/common.json`.
  folder,

  /// One file holding every locale at the top level: `{ "en": {...} }`.
  nested;

  /// The layout a wire spelling names, or `null` when it names none.
  static Chki18nFileFormat? parse(String value) {
    final wanted = value.trim().toLowerCase();

    for (final format in values) {
      if (format.name == wanted) {
        return format;
      }
    }

    return null;
  }

  @override
  String toString() => name;
}

/// Case a project writes the segments of its translation keys in.
enum Chki18nKeyCase {
  /// `attr-folder`.
  kebab,

  /// `attrFolder`.
  camel,

  /// `attr_folder`.
  snake;

  /// The case a wire spelling names, or `null` when it names none.
  static Chki18nKeyCase? parse(String value) {
    final wanted = value.trim().toLowerCase();

    for (final keyCase in values) {
      if (keyCase.name == wanted) {
        return keyCase;
      }
    }

    return null;
  }

  @override
  String toString() => name;
}

/// How a finished result is rendered.
///
/// The checks and the counts are the same whichever one is chosen; only the
/// shape of the text changes.
enum Chki18nReporter {
  /// Grouped, coloured sections, meant to be read in a terminal.
  pretty,

  /// One line per issue, for grepping and for editor integrations.
  list,

  /// The whole result object, for another tool to parse.
  json,

  /// Tables, for pasting into a pull request or a report.
  markdown,

  /// Workflow commands, so GitHub Actions annotates the files themselves.
  github;

  /// The reporter a wire spelling names, or `null` when it names none.
  static Chki18nReporter? parse(String value) {
    final wanted = value.trim().toLowerCase();

    for (final reporter in values) {
      if (reporter.name == wanted) {
        return reporter;
      }
    }

    return null;
  }

  @override
  String toString() => name;
}

/// The axis a report groups its issues by.
enum Chki18nGroupBy {
  /// One section per language. What a translator works through.
  locale,

  /// One section per check code. What a maintainer fixes in one pass.
  code,

  /// One section per comparable set of files.
  group,

  /// One section per translation file on disk.
  file,

  /// No sections at all.
  none;

  /// The axis a wire spelling names, or `null` when it names none.
  static Chki18nGroupBy? parse(String value) {
    final wanted = value.trim().toLowerCase();

    for (final groupBy in values) {
      if (groupBy.name == wanted) {
        return groupBy;
      }
    }

    return null;
  }

  @override
  String toString() => name;
}

/// The language every other language is compared against, unless one is named.
const String defaultTargetLocale = 'en';

/// Opening delimiter of an interpolation placeholder, unless one is named.
const String defaultInterpolationPrefix = '{';

/// Closing delimiter of an interpolation placeholder, unless one is named.
const String defaultInterpolationSuffix = '}';

/// Directory names never worth scanning for translation files.
const List<String> defaultExcludeDirs = [
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.git',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.turbo',
  '.cache',
];

/// File names that are never translation files, as `*` glob patterns.
///
/// Configuration and lock files, in other words. The scanner is often pointed
/// at an application's root rather than at a folder of locales, where reading
/// and parsing a `package-lock.json` on every run costs more than everything
/// else the scan does put together. Hidden files are skipped whatever this
/// holds.
const List<String> defaultExcludeFiles = [
  'package.json',
  'tsconfig.json',
  'tsconfig.*.json',
  'eslintrc.json',
  '*-lock.json',
  '*-config.json',
  '*.config.json',
];

/// File extensions the scanner reads.
const List<String> supportedExtensions = ['json'];

/// Extensions the unused-key scan will read.
///
/// An allowlist rather than a blocklist of binaries: an unknown binary decoded
/// as UTF-8 could contain a key's bytes by chance and wrongly mark it used, so
/// anything unrecognised is skipped.
const List<String> sourceExtensions = [
  // Web and app source
  'js',
  'jsx',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'mts',
  'cts',
  'vue',
  'svelte',
  'astro',
  'html',
  'htm',
  'xml',
  'xhtml',
  'php',
  'rb',
  'py',
  'go',
  'rs',
  'java',
  'kt',
  'kts',
  'swift',
  'dart',
  'cs',
  'ex',
  'exs',
  // Styles and templates
  'css',
  'scss',
  'sass',
  'less',
  'styl',
  'hbs',
  'ejs',
  'pug',
  'twig',
  'erb',
  'liquid',
  // Data and docs that can carry a key
  'json',
  'jsonc',
  'json5',
  'yaml',
  'yml',
  'toml',
  'md',
  'mdx',
  'txt',
];

/// Names a translation call goes by, for the `UNDEFINED_KEY` scan.
///
/// `t('key')` covers i18next, react-i18next and vue-i18n, including `i18n.t`
/// and a `t` bound by `useTranslation`, since a call is matched wherever the
/// name ends.
const List<String> translationFunctions = ['t', r'$t', 'translate'];

/// Files above this size are skipped by the unused-key scan.
const int sourceMaxFileBytes = 5 * 1024 * 1024;

/// The reporter a finished result is rendered with, unless one is named.
const Chki18nReporter defaultReporter = Chki18nReporter.pretty;

/// The axis a report groups its issues by, unless one is named.
const Chki18nGroupBy defaultGroupBy = Chki18nGroupBy.locale;

/// The reporter an `output` file name implies.
///
/// Anything not listed here is treated as plain text and gets the default
/// reporter without its colours.
const Map<String, Chki18nReporter> reporterByExtension = {
  'json': Chki18nReporter.json,
  'md': Chki18nReporter.markdown,
  'markdown': Chki18nReporter.markdown,
};

/// Width a report is laid out at when the terminal does not report its own.
const int defaultReportWidth = 96;

/// Widest a report lays itself out to when the width was measured rather than
/// asked for.
///
/// A very wide terminal would otherwise put the counts so far from the labels
/// that the two stop reading as one line. `width` overrides it.
const int maxMeasuredReportWidth = 120;
