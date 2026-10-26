/// Flattening nested translations into dotted keys, and the keys that end up
/// defined twice on the way.
///
/// `{"a": {"b": 1}, "a.b": 2}` flattens to `{"a.b": 2}`: two definitions went
/// in and one value came out, with nothing said about the one that lost. The
/// same happens to `{"a": ["x"], "a.0": "y"}`. Both are easy to write by hand
/// and impossible to see afterwards, since by the time anything reads the
/// translations there is only one key left.
///
/// One walk answers every question below, so the keys counted are exactly the
/// keys the comparison sees. A map or a list with anything in it is descended
/// into; everything else, an empty map or list included, is a leaf and keeps
/// its value.
library;

import 'package:chki18n/src/types.dart';

/// The separator between the levels of a flattened key.
const String keySeparator = '.';

/// A key a JavaScript object keeps ahead of the others: a whole number below
/// 2³² − 1, written without a leading zero.
final RegExp _arrayIndexPattern = RegExp(r'^(?:0|[1-9][0-9]{0,9})$');

bool _isArrayIndex(String key) => _arrayIndexPattern.hasMatch(key) && int.parse(key) < 4294967295;

/// The entries of [map] in the order a JavaScript object holds its keys, which
/// is the order the reference package reaches them in.
///
/// A JavaScript object lists whole-number keys first, in ascending order, and
/// every other key after them in the order it was written. Read in the file's
/// own order instead, `{"title": …, "404": …}` would be reported in another
/// order than the JavaScript package reports it.
List<MapEntry<String, Object?>> _entriesInObjectOrder(Map<Object?, Object?> map) {
  final entries = [for (final entry in map.entries) MapEntry('${entry.key}', entry.value)];
  final indices = entries.where((entry) => _isArrayIndex(entry.key)).toList();

  if (indices.isEmpty) {
    return entries;
  }

  indices.sort((a, b) => int.parse(a.key).compareTo(int.parse(b.key)));

  return [...indices, ...entries.where((entry) => !_isArrayIndex(entry.key))];
}

bool _isBranch(Object? value) =>
    (value is Map && value.isNotEmpty) || (value is List && value.isNotEmpty);

/// Every leaf below [translations], with its flattened key, in the order the
/// keys are reached.
void _walkLeaves(Object? translations, void Function(String key, Object? value) visit) {
  void walk(Object? value, String path) {
    if (value is Map && value.isNotEmpty) {
      for (final entry in _entriesInObjectOrder(value)) {
        walk(entry.value, path.isEmpty ? entry.key : '$path$keySeparator${entry.key}');
      }

      return;
    }

    if (value is List && value.isNotEmpty) {
      for (var index = 0; index < value.length; index += 1) {
        walk(value[index], path.isEmpty ? '$index' : '$path$keySeparator$index');
      }

      return;
    }

    visit(path, value);
  }

  if (!_isBranch(translations)) {
    return;
  }

  if (translations is List) {
    for (var index = 0; index < translations.length; index += 1) {
      walk(translations[index], '$index');
    }

    return;
  }

  for (final entry in _entriesInObjectOrder(translations! as Map)) {
    walk(entry.value, entry.key);
  }
}

/// The translations as the flat map the comparison works on, and the keys more
/// than one definition produced, in the order they are first reached.
///
/// Where two definitions produce one key the later one wins, exactly as it does
/// once the file is read back.
({TranslationMap translations, List<String> duplicates}) flattenWithDuplicates(
  Object? translations,
) {
  final flat = <String, Object?>{};
  List<String>? duplicates;

  _walkLeaves(translations, (key, value) {
    if (flat.containsKey(key) && !(duplicates ??= <String>[]).contains(key)) {
      duplicates!.add(key);
    }

    flat[key] = value;
  });

  return (translations: flat, duplicates: duplicates ?? const []);
}

/// Flattens nested translations into the dotted keys the comparison works on.
TranslationMap flattenTranslations(Object? translations) =>
    flattenWithDuplicates(translations).translations;

/// Every flattened key an object will produce, added to [into].
Set<String> collectFlatKeys(Object? translations, Set<String> into) {
  _walkLeaves(translations, (key, _) => into.add(key));

  return into;
}

/// Flattened keys that more than one definition produces, in the order they are
/// first reached, or an empty list for the overwhelmingly common case.
List<String> findDuplicateKeys(Object? translations) {
  final seen = <String>{};
  List<String>? duplicates;

  _walkLeaves(translations, (key, _) {
    if (!seen.add(key) && !(duplicates ??= <String>[]).contains(key)) {
      duplicates!.add(key);
    }
  });

  return duplicates ?? const [];
}
