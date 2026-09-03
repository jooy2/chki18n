/// The shape of a key rather than what it translates to.
library;

import 'package:chki18n/src/constants.dart';
import 'package:chki18n/src/core/duplicate.dart';
import 'package:chki18n/src/core/issue.dart';
import 'package:chki18n/src/types.dart';

final Map<Chki18nKeyCase, RegExp> _segmentPattern = {
  Chki18nKeyCase.kebab: RegExp(r'^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  Chki18nKeyCase.camel: RegExp(r'^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$'),
  Chki18nKeyCase.snake: RegExp(r'^[a-z0-9]+(?:_[a-z0-9]+)*$'),
};

/// What i18next appends to a key to pick a plural form or a context.
///
/// These are written with an underscore whatever case the project uses for its
/// keys, so a kebab-case project still writes `item-count_one`.
const Set<String> _librarySuffixes = {
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
  'plural',
  'ordinal',
  'interval',
  'male',
  'female',
};

/// The segment without the plural or context suffix a library added to it.
String _withoutLibrarySuffix(String segment, Chki18nKeyCase keyCase) {
  if (keyCase == Chki18nKeyCase.snake) {
    return segment;
  }

  final separator = segment.lastIndexOf('_');

  if (separator < 1 || !_librarySuffixes.contains(segment.substring(separator + 1))) {
    return segment;
  }

  return segment.substring(0, separator);
}

/// Checks the shape of a key: the case its segments are written in, and how
/// deeply it is nested.
///
/// Both are off until the project says what it wants, because neither has a
/// right answer on its own. Reported once per key rather than once per locale:
/// a key is named the same everywhere, so one badly named key is one finding,
/// not one per language.
void checkKeyShape(
  List<Chki18nIssue> issues,
  String key,
  String group,
  Chki18nResolvedOptions options,
) {
  // Asked of every key of every group, so the case where the project has said
  // nothing costs nothing: not even splitting the key into its segments.
  if (key.isEmpty || (options.maxKeyDepth == null && options.keyCase == null)) {
    return;
  }

  final segments = key.split(keySeparator);
  final maxKeyDepth = options.maxKeyDepth;

  if (maxKeyDepth != null &&
      segments.length > maxKeyDepth &&
      options.enabledChecks.contains(Chki18nCheckCode.keyDepth)) {
    issues.add(
      createIssue(
        Chki18nCheckCode.keyDepth,
        key: key,
        group: group,
        message:
            'The key is ${segments.length} levels deep, and `maxKeyDepth` allows $maxKeyDepth.',
      ),
    );
  }

  final keyCase = options.keyCase;

  if (keyCase == null || !options.enabledChecks.contains(Chki18nCheckCode.keyNaming)) {
    return;
  }

  final pattern = _segmentPattern[keyCase]!;

  for (final segment in segments) {
    if (pattern.hasMatch(_withoutLibrarySuffix(segment, keyCase))) {
      continue;
    }

    issues.add(
      createIssue(
        Chki18nCheckCode.keyNaming,
        key: key,
        group: group,
        message:
            segments.length > 1
                ? 'The part `$segment` is not written in ${keyCase.name} case.'
                : 'The key is not written in ${keyCase.name} case.',
      ),
    );

    // One finding per key. Naming a second bad segment of the same key adds
    // nothing to what has to be done about it.
    return;
  }
}
