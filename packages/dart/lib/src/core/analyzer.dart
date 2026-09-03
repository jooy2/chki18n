/// The comparison itself: every check that reads translation data.
library;

import 'package:chki18n/src/constants.dart';
import 'package:chki18n/src/core/duplicate.dart';
import 'package:chki18n/src/core/interpolation.dart';
import 'package:chki18n/src/core/issue.dart';
import 'package:chki18n/src/core/key.dart';
import 'package:chki18n/src/core/plural.dart';
import 'package:chki18n/src/core/result.dart';
import 'package:chki18n/src/core/value.dart';
import 'package:chki18n/src/core/width.dart';
import 'package:chki18n/src/options.dart';
import 'package:chki18n/src/types.dart';

final RegExp _digitPattern = RegExp(r'\d');

final RegExp _surroundingWhitespacePattern = RegExp(r'^\s|\s$');

const List<String> _noKeys = [];

/// Below this many columns a length ratio says nothing: `OK` and its four
/// character translation are four times apart and both are correct.
const int _minMeasuredLength = 8;

String _times(int count) => '$count time${count == 1 ? '' : 's'}';

/// `a`, `a and b`, `a, b and c` -- a list as a sentence reads it.
String _listOf(List<String> items) {
  if (items.length < 3) {
    return items.join(' and ');
  }

  return '${items.sublist(0, items.length - 1).join(', ')} and ${items.last}';
}

/// How often each item appears, for the checks that compare two multisets.
Map<String, int> _countOf(List<String> items) {
  final counts = <String, int>{};

  for (final item in items) {
    counts[item] = (counts[item] ?? 0) + 1;
  }

  return counts;
}

/// The same items in the same numbers, whatever order they appear in.
bool _sameItems(List<String> a, List<String> b) {
  if (a.length != b.length) {
    return false;
  }

  // A translation almost always keeps the numbers in the order it found them,
  // so the answer is usually one walk and no allocation at all.
  for (var index = 0; index < a.length; index += 1) {
    if (a[index] != b[index]) {
      final left = [...a]..sort();
      final right = [...b]..sort();

      // A separator no digit run can hold, so two lists only compare equal
      // when their items do.
      return left.join('\u0000') == right.join('\u0000');
    }
  }

  return true;
}

/// One markup tag, counted and quoted as it was actually written.
class _TagCount {
  _TagCount(this.text) : count = 1;

  final String text;
  int count;
}

/// Markup tags by their lower case spelling, keeping the first spelling seen so
/// a message can quote the tag as it was actually written. HTML tag names are
/// case insensitive, so `<B>` and `<b>` are the same tag.
Map<String, _TagCount> _countTags(List<String> tags) {
  final counts = <String, _TagCount>{};

  for (final tag in tags) {
    final id = tag.toLowerCase();
    final found = counts[id];

    if (found != null) {
      found.count += 1;
      continue;
    }

    counts[id] = _TagCount(tag);
  }

  return counts;
}

/// Whether each comparison check is enabled, resolved once instead of asking
/// the enabled-set again for every key of every locale.
class _CheckFlags {
  _CheckFlags(Set<Chki18nCheckCode> enabled)
    : invalidValueType = enabled.contains(Chki18nCheckCode.invalidValueType),
      noLocale = enabled.contains(Chki18nCheckCode.noLocale),
      noKey = enabled.contains(Chki18nCheckCode.noKey),
      dummyKey = enabled.contains(Chki18nCheckCode.dummyKey),
      unusedKey = enabled.contains(Chki18nCheckCode.unusedKey),
      undefinedKey = enabled.contains(Chki18nCheckCode.undefinedKey),
      noPluralForm = enabled.contains(Chki18nCheckCode.noPluralForm),
      emptyValue = enabled.contains(Chki18nCheckCode.emptyValue),
      noInterpolationKey = enabled.contains(Chki18nCheckCode.noInterpolationKey),
      extraInterpolationKey = enabled.contains(Chki18nCheckCode.extraInterpolationKey),
      interpolationCount = enabled.contains(Chki18nCheckCode.interpolationCount),
      tagMismatch = enabled.contains(Chki18nCheckCode.tagMismatch),
      notTranslatedValue = enabled.contains(Chki18nCheckCode.notTranslatedValue),
      untranslatedScript = enabled.contains(Chki18nCheckCode.untranslatedScript),
      duplicateValue = enabled.contains(Chki18nCheckCode.duplicateValue),
      inconsistentValue = enabled.contains(Chki18nCheckCode.inconsistentValue),
      surroundingWhitespace = enabled.contains(Chki18nCheckCode.surroundingWhitespace),
      invisibleCharacter = enabled.contains(Chki18nCheckCode.invisibleCharacter),
      missingNumber = enabled.contains(Chki18nCheckCode.missingNumber),
      numberMismatch = enabled.contains(Chki18nCheckCode.numberMismatch),
      suspiciousLength = enabled.contains(Chki18nCheckCode.suspiciousLength);

  final bool invalidValueType;
  final bool noLocale;
  final bool noKey;
  final bool dummyKey;
  final bool unusedKey;
  final bool undefinedKey;
  final bool noPluralForm;
  final bool emptyValue;
  final bool noInterpolationKey;
  final bool extraInterpolationKey;
  final bool interpolationCount;
  final bool tagMismatch;
  final bool notTranslatedValue;
  final bool untranslatedScript;
  final bool duplicateValue;
  final bool inconsistentValue;
  final bool surroundingWhitespace;
  final bool invisibleCharacter;
  final bool missingNumber;
  final bool numberMismatch;
  final bool suspiciousLength;
}

/// The file one group's locale was read from, or `null` when nothing was read.
typedef _FileLookup = String? Function(String group, String locale);

/// Values are reported as text, whatever their original type was.
String _asDisplayValue(Object? value) => value is String ? value : '$value';

/// What JavaScript's `typeof` would call this value, so the wording of an
/// `INVALID_VALUE_TYPE` message is the same in every package.
String _typeNameOf(Object? value) {
  if (value is num) {
    return 'number';
  }

  if (value is bool) {
    return 'boolean';
  }

  return 'object';
}

_FileLookup? _buildFileLookup(List<Chki18nSourceFile>? files) {
  if (files == null || files.isEmpty) {
    return null;
  }

  final paths = <String, String>{};

  for (final file in files) {
    paths['${file.group} ${file.locale}'] = file.path;
  }

  return (group, locale) => paths['$group $locale'];
}

/// Fields every issue about one locale's value carries.
class _IssueBase {
  const _IssueBase({
    required this.locale,
    required this.key,
    required this.group,
    this.file,
    this.targetValue,
  });

  final String locale;
  final String key;
  final String group;
  final String? file;
  final String? targetValue;
}

/// Reports the markup this value does not carry the way the target language
/// does.
///
/// Counts rather than presence: a value that opens `<b>` twice and closes it
/// once renders as broken as one that dropped the tag altogether.
void _reportTagMismatch(
  List<Chki18nIssue> issues,
  _IssueBase base,
  String value,
  Map<String, _TagCount> expected,
) {
  final found = _countTags(extractTags(value));

  if (found.isEmpty && expected.isEmpty) {
    return;
  }

  final missing = <String>[];
  final extra = <String>[];

  // One finding per direction rather than per tag: a dropped `<b>...</b>` is a
  // single mistake, and reporting its two halves separately reads as two.
  for (final entry in expected.entries) {
    final count = found[entry.key]?.count ?? 0;

    if (count < entry.value.count) {
      missing.add(
        count < 1
            ? '`${entry.value.text}`'
            : '`${entry.value.text}` (${_times(count)} of ${entry.value.count})',
      );
    }
  }

  for (final entry in found.entries) {
    final count = expected[entry.key]?.count ?? 0;

    if (entry.value.count > count) {
      extra.add(
        count < 1
            ? '`${entry.value.text}`'
            : '`${entry.value.text}` (${_times(entry.value.count)} of $count)',
      );
    }
  }

  if (missing.isNotEmpty) {
    issues.add(
      createIssue(
        Chki18nCheckCode.tagMismatch,
        locale: base.locale,
        key: base.key,
        group: base.group,
        file: base.file,
        targetValue: base.targetValue,
        value: value,
        message:
            'The ${missing.length == 1 ? 'tag' : 'tags'} ${_listOf(missing)} of the target '
            'language ${missing.length == 1 ? 'is' : 'are'} missing from this value.',
      ),
    );
  }

  if (extra.isNotEmpty) {
    issues.add(
      createIssue(
        Chki18nCheckCode.tagMismatch,
        locale: base.locale,
        key: base.key,
        group: base.group,
        file: base.file,
        targetValue: base.targetValue,
        value: value,
        message:
            'The ${extra.length == 1 ? 'tag' : 'tags'} ${_listOf(extra)} '
            '${extra.length == 1 ? 'is' : 'are'} not in the target language.',
      ),
    );
  }
}

/// Compares one key across every locale.
///
/// Locales are addressed by index into three parallel lists rather than by one
/// object per key: a full analysis calls this once per key per group, so the
/// caller can refill the same lists instead of allocating on every iteration.
void _checkKeySlots(
  List<Chki18nIssue> issues,
  String key,
  String group,
  List<String> localeNames,
  List<Object?> values,
  List<bool> present,
  int targetIndex,
  _CheckFlags flags,
  Chki18nResolvedOptions options,
  _FileLookup? fileOf,
) {
  final hasTargetKey = targetIndex != -1 && present[targetIndex];
  final targetValue = hasTargetKey ? values[targetIndex] : null;
  final targetIsString = hasTargetKey && targetValue is String;
  final targetText = hasTargetKey ? _asDisplayValue(targetValue) : null;
  final targetInterpolations =
      targetIsString
          ? extractInterpolationKeys(
            targetValue,
            options.interpolationPrefix,
            options.interpolationSuffix,
          )
          : _noKeys;
  final targetHasDigit = targetIsString && _digitPattern.hasMatch(targetValue);
  final targetNumbers =
      flags.numberMismatch && targetHasDigit ? extractNumbers(targetValue) : _noKeys;
  // Counted once per key rather than once per locale: what the target language
  // carries does not change while the locales are walked.
  final targetTagCounts =
      flags.tagMismatch && targetIsString ? _countTags(extractTags(targetValue)) : null;
  final targetWidth =
      flags.suspiciousLength && options.lengthRatio != null && targetIsString
          ? displayWidth(targetValue)
          : 0;
  final targetInterpolationCounts =
      flags.interpolationCount && targetInterpolations.isNotEmpty
          ? _countOf(targetInterpolations)
          : null;
  final checkInterpolation =
      flags.noInterpolationKey || flags.extraInterpolationKey || flags.interpolationCount;
  // A plural key belongs to one language's grammar. Korean needs only `other`,
  // so `item_one` being absent from it is correct rather than missing, and
  // Russian needs `item_few` that English never writes.
  final plural = pluralPartsOf(key);

  for (var index = 0; index < localeNames.length; index += 1) {
    if (index == targetIndex) {
      continue;
    }

    final locale = localeNames[index];
    final value = values[index];
    final file = fileOf == null ? null : fileOf(group, locale);
    final base = _IssueBase(
      locale: locale,
      key: key,
      group: group,
      file: file,
      targetValue: targetText,
    );

    if (!present[index]) {
      if (hasTargetKey &&
          flags.noKey &&
          (plural == null || usesPluralCategory(locale, plural.category))) {
        issues.add(
          createIssue(
            Chki18nCheckCode.noKey,
            locale: locale,
            key: key,
            group: group,
            file: file,
            targetValue: targetText,
          ),
        );
      }

      continue;
    }

    final text = _asDisplayValue(value);

    if (!hasTargetKey &&
        flags.dummyKey &&
        // The target language may simply have no use for this plural form.
        (plural == null || usesPluralCategory(options.target, plural.category))) {
      issues.add(
        createIssue(
          Chki18nCheckCode.dummyKey,
          locale: locale,
          key: key,
          group: group,
          file: file,
          targetValue: targetText,
          value: text,
        ),
      );
    }

    if (value is! String) {
      if (flags.invalidValueType) {
        issues.add(
          createIssue(
            Chki18nCheckCode.invalidValueType,
            locale: locale,
            key: key,
            group: group,
            file: file,
            targetValue: targetText,
            value: text,
            message:
                'The value is ${value == null ? '`null`' : 'a `${_typeNameOf(value)}`'}, '
                'not a translatable string.',
          ),
        );
      }

      continue;
    }

    if (value.isEmpty) {
      if (flags.emptyValue) {
        issues.add(
          createIssue(
            Chki18nCheckCode.emptyValue,
            locale: locale,
            key: key,
            group: group,
            file: file,
            targetValue: targetText,
            value: value,
          ),
        );
      }

      continue;
    }

    if (flags.surroundingWhitespace && _surroundingWhitespacePattern.hasMatch(value)) {
      issues.add(
        createIssue(
          Chki18nCheckCode.surroundingWhitespace,
          locale: locale,
          key: key,
          group: group,
          file: file,
          targetValue: targetText,
          value: value,
        ),
      );
    }

    if (flags.invisibleCharacter) {
      final invisible = findInvisibleCharacter(value);

      if (invisible != null) {
        issues.add(
          createIssue(
            Chki18nCheckCode.invisibleCharacter,
            locale: locale,
            key: key,
            group: group,
            file: file,
            targetValue: targetText,
            value: value,
            message:
                'The value holds ${nameOfInvisibleCharacter(invisible)}, '
                'which nothing will draw.',
          ),
        );
      }
    }

    if (targetIsString) {
      if (flags.notTranslatedValue && value == targetValue) {
        issues.add(
          createIssue(
            Chki18nCheckCode.notTranslatedValue,
            locale: locale,
            key: key,
            group: group,
            file: file,
            targetValue: targetText,
            value: value,
          ),
        );
      }

      if (flags.missingNumber && targetHasDigit && !_digitPattern.hasMatch(value)) {
        issues.add(
          createIssue(
            Chki18nCheckCode.missingNumber,
            locale: locale,
            key: key,
            group: group,
            file: file,
            targetValue: targetText,
            value: value,
          ),
        );
      }

      if (flags.numberMismatch && targetHasDigit && _digitPattern.hasMatch(value)) {
        final numbers = extractNumbers(value);

        if (!_sameItems(targetNumbers, numbers)) {
          issues.add(
            createIssue(
              Chki18nCheckCode.numberMismatch,
              locale: locale,
              key: key,
              group: group,
              file: file,
              targetValue: targetText,
              value: value,
              message:
                  'The target language uses ${targetNumbers.join(', ')} and this value '
                  'uses ${numbers.join(', ')}.',
            ),
          );
        }
      }

      if (targetTagCounts != null && (targetTagCounts.isNotEmpty || value.contains('<'))) {
        _reportTagMismatch(issues, base, value, targetTagCounts);
      }

      // A value identical to the target language is already reported as
      // untranslated; saying it twice adds nothing.
      if (flags.untranslatedScript && value != targetValue) {
        final script = scriptOfLocale(locale);

        if (script != null &&
            !script.hasMatch(value) &&
            hasTranslatableText(value, options.interpolationPrefix, options.interpolationSuffix)) {
          issues.add(
            createIssue(
              Chki18nCheckCode.untranslatedScript,
              locale: locale,
              key: key,
              group: group,
              file: file,
              targetValue: targetText,
              value: value,
            ),
          );
        }
      }

      final lengthRatio = options.lengthRatio;

      if (targetWidth >= _minMeasuredLength && lengthRatio != null) {
        final ratio = displayWidth(value) / targetWidth;

        if (ratio > lengthRatio || ratio * lengthRatio < 1) {
          issues.add(
            createIssue(
              Chki18nCheckCode.suspiciousLength,
              locale: locale,
              key: key,
              group: group,
              file: file,
              targetValue: targetText,
              value: value,
              message:
                  'The value is ${ratio.toStringAsFixed(1)} times the length of the '
                  'target language value.',
            ),
          );
        }
      }
    }

    if (!hasTargetKey || !checkInterpolation) {
      continue;
    }

    final currentInterpolations = extractInterpolationKeys(
      value,
      options.interpolationPrefix,
      options.interpolationSuffix,
    );

    if (flags.noInterpolationKey) {
      for (final interpolation in targetInterpolations) {
        if (currentInterpolations.contains(interpolation)) {
          continue;
        }

        issues.add(
          createIssue(
            Chki18nCheckCode.noInterpolationKey,
            locale: locale,
            key: key,
            group: group,
            file: file,
            targetValue: targetText,
            value: value,
            interpolation: interpolation,
            message:
                'The interpolation key `${options.interpolationPrefix}$interpolation'
                '${options.interpolationSuffix}` of the target language is missing from '
                'this value.',
          ),
        );
      }
    }

    if (flags.extraInterpolationKey) {
      for (final interpolation in currentInterpolations) {
        if (targetInterpolations.contains(interpolation)) {
          continue;
        }

        issues.add(
          createIssue(
            Chki18nCheckCode.extraInterpolationKey,
            locale: locale,
            key: key,
            group: group,
            file: file,
            targetValue: targetText,
            value: value,
            interpolation: interpolation,
            message:
                'The interpolation key `${options.interpolationPrefix}$interpolation'
                '${options.interpolationSuffix}` is not defined by the target language.',
          ),
        );
      }
    }

    // Only a repeated placeholder can differ in number, and the two checks
    // above already report one that is missing or unknown outright.
    if (targetInterpolationCounts == null ||
        (targetInterpolations.length < 2 && currentInterpolations.length < 2)) {
      continue;
    }

    final currentCounts = _countOf(currentInterpolations);

    for (final entry in targetInterpolationCounts.entries) {
      final found = currentCounts[entry.key];

      if (found == null || found == entry.value) {
        continue;
      }

      issues.add(
        createIssue(
          Chki18nCheckCode.interpolationCount,
          locale: locale,
          key: key,
          group: group,
          file: file,
          targetValue: targetText,
          value: value,
          interpolation: entry.key,
          message:
              'The interpolation key `${options.interpolationPrefix}${entry.key}'
              '${options.interpolationSuffix}` is used ${_times(found)} here and '
              '${_times(entry.value)} in the target language.',
        ),
      );
    }
  }
}

/// Reports keys of one locale that repeat a value another key already uses.
///
/// This is the one check that has to see a whole locale at once, so it cannot
/// live in `_checkKeySlots`. A map keyed by the value keeps it linear.
void _checkDuplicateValues(
  List<Chki18nIssue> issues,
  String group,
  List<String> localeNames,
  List<TranslationMap> maps,
  int targetIndex,
  _FileLookup? fileOf,
) {
  for (var index = 0; index < localeNames.length; index += 1) {
    final locale = localeNames[index];
    final map = maps[index];
    final firstKeyOfValue = <String, String>{};

    for (final key in map.keys) {
      final value = map[key];

      if (value is! String || value.isEmpty) {
        continue;
      }

      final firstKey = firstKeyOfValue[value];

      if (firstKey == null) {
        firstKeyOfValue[value] = key;
        continue;
      }

      final targetValue = targetIndex == -1 ? null : maps[targetIndex][key];

      issues.add(
        createIssue(
          Chki18nCheckCode.duplicateValue,
          locale: locale,
          key: key,
          group: group,
          value: value,
          targetValue: targetValue == null ? null : _asDisplayValue(targetValue),
          relatedKey: firstKey,
          file: fileOf == null ? null : fileOf(group, locale),
          message: 'The key `$firstKey` in the same locale already uses this value.',
        ),
      );
    }
  }
}

/// Reports keys that share one target language string but are translated two
/// different ways.
///
/// `DUPLICATE_VALUE` asks whether one locale repeats itself; this asks the
/// opposite question, and catches the terminology drift that turns one `Save`
/// button into two different words on two screens.
void _checkInconsistentValues(
  List<Chki18nIssue> issues,
  String group,
  List<String> localeNames,
  List<TranslationMap> maps,
  int targetIndex,
  String target,
  _FileLookup? fileOf,
) {
  final targetMap = maps[targetIndex];
  final keysOfValue = <String, List<String>>{};

  for (final key in targetMap.keys) {
    final value = targetMap[key];

    if (value is! String || value.isEmpty) {
      continue;
    }

    (keysOfValue[value] ??= <String>[]).add(key);
  }

  for (final entry in keysOfValue.entries) {
    if (entry.value.length < 2) {
      continue;
    }

    for (var index = 0; index < localeNames.length; index += 1) {
      if (index == targetIndex) {
        continue;
      }

      final map = maps[index];
      var firstKey = '';
      var firstValue = '';

      for (final key in entry.value) {
        final value = map[key];

        // A key this locale does not have, or has not filled in, is somebody
        // else's finding.
        if (value is! String || value.isEmpty) {
          continue;
        }

        if (firstKey.isEmpty) {
          firstKey = key;
          firstValue = value;
          continue;
        }

        if (value == firstValue) {
          continue;
        }

        issues.add(
          createIssue(
            Chki18nCheckCode.inconsistentValue,
            locale: localeNames[index],
            key: key,
            group: group,
            value: value,
            targetValue: entry.key,
            relatedKey: firstKey,
            file: fileOf == null ? null : fileOf(group, localeNames[index]),
            message:
                'The key `$firstKey` has the same $target value but is translated as '
                '"$firstValue".',
          ),
        );
      }
    }
  }
}

/// Reports a plural key one of whose forms the language needs and does not
/// have.
///
/// Which forms a language needs is a fact about the language, not about the
/// target: English writes two, Russian four, Korean one, and a file that
/// follows its own language is right even where it does not follow the
/// original.
void _checkPluralForms(
  List<Chki18nIssue> issues,
  String group,
  List<String> localeNames,
  List<TranslationMap> maps,
  _FileLookup? fileOf,
) {
  for (var index = 0; index < localeNames.length; index += 1) {
    final locale = localeNames[index];
    final categories = pluralCategoriesOf(locale);

    if (categories == null) {
      continue;
    }

    final formsOfBase = <String, Set<Chki18nPluralCategory>>{};

    for (final key in maps[index].keys) {
      final parts = pluralPartsOf(key);

      if (parts == null) {
        continue;
      }

      (formsOfBase[parts.base] ??= <Chki18nPluralCategory>{}).add(parts.category);
    }

    for (final entry in formsOfBase.entries) {
      final missing = categories.where((category) => !entry.value.contains(category)).toList();

      if (missing.isEmpty) {
        continue;
      }

      issues.add(
        createIssue(
          Chki18nCheckCode.noPluralForm,
          locale: locale,
          key: entry.key,
          group: group,
          file: fileOf == null ? null : fileOf(group, locale),
          message:
              '`$locale` needs '
              '${_listOf([for (final category in missing) '`${entry.key}_${category.name}`'])} '
              'and the file does not define ${missing.length == 1 ? 'it' : 'them'}.',
        ),
      );
    }
  }
}

/// Keys of every locale, target language first so reports follow its order.
List<String> collectKeys(List<TranslationMap> maps, int targetIndex) {
  final keys = <String>[];
  final seen = <String>{};

  void collect(TranslationMap map) {
    for (final key in map.keys) {
      if (seen.add(key)) {
        keys.add(key);
      }
    }
  }

  if (targetIndex != -1) {
    collect(maps[targetIndex]);
  }

  for (var index = 0; index < maps.length; index += 1) {
    if (index != targetIndex) {
      collect(maps[index]);
    }
  }

  return keys;
}

/// Brings the input into the `group -> locale -> flat map` shape the analysis
/// works on.
///
/// With `flattened` the caller's own maps are used as they are, which is what
/// makes analysing data already held in memory allocation free. [flattened]
/// overrides what the options say, which is how a session flattens once up
/// front and still hands the analyzer maps it is told are already flat.
TranslationGroups prepareGroups(
  Chki18nInput input,
  Chki18nResolvedOptions options,
  List<Chki18nIssue> issues, {
  bool? flattened,
}) {
  final alreadyFlat = flattened ?? options.flattened;
  final source =
      input.groups ??
      <String, Map<String, TranslationMap>>{'': input.locales ?? <String, TranslationMap>{}};
  final prepared = <String, Map<String, TranslationMap>>{};

  for (final group in source.keys) {
    final locales = source[group] ?? <String, TranslationMap>{};
    final preparedLocales = <String, TranslationMap>{};

    for (final locale in locales.keys) {
      final map = locales[locale];

      if (map == null) {
        issues.add(
          createIssue(
            Chki18nCheckCode.invalidFile,
            locale: locale,
            group: group,
            message: 'The translations of `$locale` are not an object.',
          ),
        );
        continue;
      }

      if (alreadyFlat) {
        preparedLocales[locale] = map;
        continue;
      }

      // Before flattening, because flattening is what hides it: two definitions
      // go in and one key comes out.
      if (options.enabledChecks.contains(Chki18nCheckCode.duplicateKey)) {
        for (final key in findDuplicateKeys(map)) {
          issues.add(
            createIssue(
              Chki18nCheckCode.duplicateKey,
              locale: locale,
              group: group,
              key: key,
              message: 'The key `$key` is defined more than once, so one of its values is lost.',
            ),
          );
        }
      }

      preparedLocales[locale] = flattenTranslations(map);
    }

    prepared[group] = preparedLocales;
  }

  return prepared;
}

/// A reusable analyzer bound to one set of options.
///
/// Prefer this over calling [analyzeTranslations] repeatedly: the options, the
/// enabled checks and the interpolation delimiters are resolved once, so a
/// caller re-checking after every edit pays only for the comparison itself.
class Chki18nAnalyzer {
  /// Creates an analyzer bound to [options].
  factory Chki18nAnalyzer({Chki18nOptions? options}) => Chki18nAnalyzer._(resolveOptions(options));

  Chki18nAnalyzer._(Chki18nResolvedResult resolved)
    : options = resolved.options,
      optionIssues = resolved.issues,
      _flags = _CheckFlags(resolved.options.enabledChecks);

  /// The options every call of this analyzer runs with.
  final Chki18nResolvedOptions options;

  /// Issues raised while resolving those options, replayed into every result.
  final List<Chki18nIssue> optionIssues;

  final _CheckFlags _flags;

  /// Compares a whole set of translations held in memory.
  Chki18nResult analyze(Chki18nInput input) {
    final startedAt = DateTime.now().millisecondsSinceEpoch;
    // Whatever produced the input may already have found problems (an
    // unreadable file, say); they belong in the same report.
    final issues = <Chki18nIssue>[...?input.issues, ...optionIssues];
    final groups = prepareGroups(input, options, issues);
    final groupNames = groups.keys.toList();
    // Collected before the comparison rather than during it: a group can only
    // be missing a language once every group has said which ones it has.
    final allLocales = <String>{};

    for (final group in groupNames) {
      allLocales.addAll(groups[group]!.keys);
    }

    final fileOf = _buildFileLookup(input.files);
    // Supplied rather than worked out: whether a key is referenced is a fact
    // about the source tree, which the comparison never sees.
    final unusedKeys =
        _flags.unusedKey && (input.unusedKeys?.isNotEmpty ?? false)
            ? input.unusedKeys!.toSet()
            : null;

    if (_flags.undefinedKey) {
      for (final usage in input.undefinedKeys ?? const <Chki18nKeyUsage>[]) {
        issues.add(
          createIssue(
            Chki18nCheckCode.undefinedKey,
            key: usage.key,
            file: usage.file,
            message: 'The scanned source asks for `${usage.key}` and no language file defines it.',
          ),
        );
      }
    }

    var keyCount = 0;

    for (final group in groupNames) {
      final localeMaps = groups[group]!;
      final localeNames = localeMaps.keys.toList();

      // Only worth asking with more than one group: with a single one, every
      // language that exists at all is in it by definition.
      if (_flags.noLocale && groupNames.length > 1) {
        for (final locale in allLocales) {
          if (localeMaps.containsKey(locale)) {
            continue;
          }

          issues.add(
            createIssue(
              Chki18nCheckCode.noLocale,
              locale: locale,
              group: group,
              message:
                  '`$group` holds no translations for `$locale`, so none of its keys exist '
                  'there.',
            ),
          );
        }
      }

      final targetIndex = localeNames.indexOf(options.target);

      if (targetIndex == -1) {
        issues.add(
          createIssue(
            Chki18nCheckCode.invalidOptions,
            level: Chki18nLevel.error,
            group: group,
            message:
                'The target language `${options.target}` was not found'
                '${group.isEmpty ? '' : ' in `$group`'}. There is nothing to compare against.',
          ),
        );
        continue;
      }

      final maps = [for (final locale in localeNames) localeMaps[locale]!];
      final keys = collectKeys(maps, targetIndex);
      final values = List<Object?>.filled(maps.length, null);
      final present = List<bool>.filled(maps.length, false);

      keyCount += keys.length;

      for (final key in keys) {
        // The shape of a key is the same in every language, so it is judged
        // once rather than once per locale.
        checkKeyShape(issues, key, group, options);

        for (var index = 0; index < maps.length; index += 1) {
          final exists = maps[index].containsKey(key);

          present[index] = exists;
          values[index] = exists ? maps[index][key] : null;
        }

        _checkKeySlots(
          issues,
          key,
          group,
          localeNames,
          values,
          present,
          targetIndex,
          _flags,
          options,
          fileOf,
        );

        // Not locale-bound: the key is unreferenced, not one language's
        // translation of it.
        if (unusedKeys != null && unusedKeys.contains(key)) {
          issues.add(createIssue(Chki18nCheckCode.unusedKey, key: key, group: group));
        }
      }

      if (_flags.duplicateValue) {
        _checkDuplicateValues(issues, group, localeNames, maps, targetIndex, fileOf);
      }

      if (_flags.noPluralForm) {
        _checkPluralForms(issues, group, localeNames, maps, fileOf);
      }

      if (_flags.inconsistentValue) {
        _checkInconsistentValues(
          issues,
          group,
          localeNames,
          maps,
          targetIndex,
          options.target,
          fileOf,
        );
      }
    }

    applyLevelOverrides(issues, options.levels);

    return buildResult(
      issues,
      options,
      locales: allLocales.toList(),
      groups: groupNames,
      keyCount: keyCount,
      files: input.files ?? const [],
      fileFormat: input.fileFormat,
      elapsedMs: DateTime.now().millisecondsSinceEpoch - startedAt,
    );
  }

  /// Compares a single key across locales.
  ///
  /// Cross-key checks (`DUPLICATE_VALUE` and the rest of [crossKeyCheckCodes])
  /// cannot be answered from one key and are never reported here.
  List<Chki18nIssue> checkEntry(Chki18nEntry entry) {
    final issues = <Chki18nIssue>[];
    final entryValues = entry.values;
    final localeNames = entry.locales ?? entryValues.keys.toList();
    final values = List<Object?>.filled(localeNames.length, null);
    final present = List<bool>.filled(localeNames.length, false);

    for (var index = 0; index < localeNames.length; index += 1) {
      final exists = entryValues.containsKey(localeNames[index]);

      present[index] = exists;
      values[index] = exists ? entryValues[localeNames[index]] : null;
    }

    checkKeyShape(issues, entry.key, entry.group ?? '', options);
    _checkKeySlots(
      issues,
      entry.key,
      entry.group ?? '',
      localeNames,
      values,
      present,
      localeNames.indexOf(options.target),
      _flags,
      options,
      null,
    );

    return applyLevelOverrides(issues, options.levels);
  }
}

/// A reusable analyzer bound to one set of options.
Chki18nAnalyzer createAnalyzer({Chki18nOptions? options}) => Chki18nAnalyzer(options: options);

/// Compares translations held in memory.
///
/// Does no file system work at all, so this is the entry point to use when the
/// strings are already loaded.
Chki18nResult analyzeTranslations(Chki18nInput input, {Chki18nOptions? options}) =>
    Chki18nAnalyzer(options: options).analyze(input);
