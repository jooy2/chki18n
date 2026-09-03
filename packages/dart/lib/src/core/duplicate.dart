/// Keys that end up defined twice, which flattening then silently resolves.
///
/// `{"a": {"b": 1}, "a.b": 2}` flattens to `{"a.b": 2}`: two definitions went
/// in and one value came out, with nothing said about the one that lost. The
/// same happens to `{"a": ["x"], "a.0": "y"}`. Both are easy to write by hand
/// and impossible to see afterwards, since by the time anything reads the
/// translations there is only one key left.
///
/// The walk mirrors what [flattenTranslations] does — a map or a list with
/// anything in it is descended into, everything else (including an empty map or
/// list) is a leaf — so the paths counted here are exactly the keys that will
/// exist.
library;

import 'package:chki18n/src/types.dart';

/// The separator between the levels of a flattened key.
const String keySeparator = '.';

bool _isBranch(Object? value) {
  if (value is Map) {
    return value.isNotEmpty;
  }

  if (value is List) {
    return value.isNotEmpty;
  }

  return false;
}

void _walk(Object? value, String path, void Function(String path) leaf) {
  if (value is Map) {
    if (value.isEmpty) {
      if (path.isNotEmpty) {
        leaf(path);
      }

      return;
    }

    for (final entry in value.entries) {
      final key = '${entry.key}';

      _walk(entry.value, path.isEmpty ? key : '$path$keySeparator$key', leaf);
    }

    return;
  }

  if (value is List) {
    if (value.isEmpty) {
      if (path.isNotEmpty) {
        leaf(path);
      }

      return;
    }

    for (var index = 0; index < value.length; index += 1) {
      _walk(value[index], path.isEmpty ? '$index' : '$path$keySeparator$index', leaf);
    }

    return;
  }

  if (path.isNotEmpty) {
    leaf(path);
  }
}

/// Every flattened key an object will produce, added to [into].
Set<String> collectFlatKeys(Object? translations, Set<String> into) {
  _walk(translations, '', into.add);

  return into;
}

/// Flattens nested translations into the dotted keys the comparison works on.
///
/// A map or a list with anything in it is descended into; everything else,
/// including an empty map or list, is a leaf and keeps its value. Where two
/// definitions produce one key the later one wins, exactly as it does once the
/// file is read back — which is the loss [findDuplicateKeys] is there to report
/// before it happens.
TranslationMap flattenTranslations(Object? translations) {
  final flat = <String, Object?>{};

  void walk(Object? value, String path) {
    if (value is Map && value.isNotEmpty) {
      for (final entry in value.entries) {
        final key = '${entry.key}';

        walk(entry.value, path.isEmpty ? key : '$path$keySeparator$key');
      }

      return;
    }

    if (value is List && value.isNotEmpty) {
      for (var index = 0; index < value.length; index += 1) {
        walk(value[index], path.isEmpty ? '$index' : '$path$keySeparator$index');
      }

      return;
    }

    if (path.isNotEmpty) {
      flat[path] = value;
    }
  }

  walk(translations, '');

  return flat;
}

/// Flattened keys that more than one definition produces, in the order they are
/// first reached.
///
/// Returns an empty list for the overwhelmingly common case, and allocates
/// nothing while doing so.
List<String> findDuplicateKeys(Object? translations) {
  if (!_isBranch(translations)) {
    return const [];
  }

  final seen = <String>{};
  List<String>? duplicates;

  _walk(translations, '', (path) {
    if (seen.contains(path)) {
      duplicates ??= <String>[];

      if (!duplicates!.contains(path)) {
        duplicates!.add(path);
      }

      return;
    }

    seen.add(path);
  });

  return duplicates ?? const [];
}
