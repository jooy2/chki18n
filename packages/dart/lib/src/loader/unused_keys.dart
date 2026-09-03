/// What the source tree says about the translation keys: which ones nothing
/// references, and which ones it asks for that nothing defines.
///
/// The search is for a key's **leaf segment** — `desc.hello` is looked up as
/// `hello` — because code very often resolves a nested key by its last segment
/// alone, through a scoped `t('hello')` or a namespace bound higher up.
/// Matching the whole dotted key would report those as unused, and a check that
/// cries wolf on working code is worse than one that misses something.
///
/// That trade also decides the severity: this can only ever be a hint, so
/// `UNUSED_KEY` is reported at `info` and never fails a run.
library;

import 'dart:io';

import 'package:chki18n/src/constants.dart';
import 'package:chki18n/src/core/plural.dart';
import 'package:chki18n/src/loader/paths.dart';
import 'package:chki18n/src/types.dart';

final Set<String> _extensions = sourceExtensions.toSet();

final RegExp _wordStart = RegExp(r'^\w');

final RegExp _regExpMeta = RegExp(r'[.*+?^${}()|[\]\\]');

/// `desc.hello` to `hello`, and `desc.item_one` to `item`.
///
/// The plural suffix comes off because no source file writes it: the code asks
/// for `item` and the runtime picks the form. Searching for `item_one` would
/// report every plural key in the project as unused.
String leafOfKey(String key) {
  final cut = key.lastIndexOf('.');
  final leaf = cut == -1 ? key : key.substring(cut + 1);

  return pluralBaseOf(leaf) ?? leaf;
}

bool _isScannableName(String name) => _extensions.contains(extensionOf(name));

/// What one walk of a source tree found.
class Chki18nUsageScan {
  /// Creates the result of one usage scan.
  const Chki18nUsageScan({
    required this.unusedKeys,
    required this.undefinedKeys,
    required this.scannedFileCount,
  });

  /// Keys whose leaf segment was found in no scanned file.
  final List<String> unusedKeys;

  /// Keys the source asks for that no translation file defines.
  final List<Chki18nKeyUsage> undefinedKeys;

  /// How many files were actually read.
  final int scannedFileCount;
}

/// A key written as the first argument of a translation call, or as `i18nKey`.
List<RegExp> _callPatterns(List<String> names) => [
  RegExp(
    '(?:${names.map((name) => '${_wordStart.hasMatch(name) ? r'\b' : ''}'
    '${name.replaceAllMapped(_regExpMeta, (match) => '\\${match[0]}')}').join('|')})'
    r'''\s*\(\s*(['"`])([^'"`\r\n]*)\1''',
  ),
  RegExp(r'''\bi18nKey\s*=\s*\{?\s*(['"`])([^'"`\r\n]*)\1'''),
];

/// Keys a file asks a translation function for.
///
/// A template literal holding an expression is skipped: the key is only known
/// at run time, and guessing at it would report a working call as broken.
Set<String> _callsIn(String content, List<RegExp> patterns) {
  final keys = <String>{};

  for (final pattern in patterns) {
    for (final found in pattern.allMatches(content)) {
      final key = found[2] ?? '';

      if (key.isNotEmpty && !key.contains(r'${')) {
        // `t('common:attr.folder')` names a namespace this comparison does not
        // have, and the key it wants is the part after it.
        keys.add(key.substring(key.indexOf(':') + 1));
      }
    }
  }

  return keys;
}

/// Every way a defined key can be addressed: in full, by its plural base, and
/// by any run of segments that ends either.
///
/// A `t` bound with a `keyPrefix`, or a namespace loaded higher up, asks for
/// `folder` rather than `attr.folder`, and reporting that as undefined would
/// cry wolf on working code — the same trade the unused scan makes.
Set<String> _addressesOf(List<String> keys) {
  final addresses = <String>{};

  void add(String key) {
    addresses.add(key);

    var separator = key.indexOf('.');

    while (separator != -1) {
      addresses.add(key.substring(separator + 1));
      separator = key.indexOf('.', separator + 1);
    }
  }

  for (final key in keys) {
    add(key);

    // The source asks for `item`, never for `item_one`: the runtime picks the
    // form, so the base is an address of the key as much as the key is.
    final base = pluralBaseOf(key);

    if (base != null) {
      add(base);
    }
  }

  return addresses;
}

/// Searches [sourcePath] for each key, and reports the ones never found.
///
/// [skipFiles] are the project's own translation files: a key appears verbatim
/// in the file that defines it, so searching those would mark every key used
/// and the scan would never report anything.
Future<Chki18nUsageScan> findUnusedKeys(
  String sourcePath,
  List<String> keys,
  Chki18nResolvedOptions options, {
  Iterable<String> skipFiles = const [],
}) async {
  // One leaf can belong to several keys (`a.name` and `b.name`), so the answer
  // is looked up per leaf and applied to every key that shares it.
  final keysByLeaf = <String, List<String>>{};

  for (final key in keys) {
    final leaf = leafOfKey(key);

    if (leaf.isNotEmpty) {
      (keysByLeaf[leaf] ??= <String>[]).add(key);
    }
  }

  // Only worth reading every file for; the unused scan can stop as soon as the
  // last leaf turns up, and this one cannot.
  final wantsUndefined = options.enabledChecks.contains(Chki18nCheckCode.undefinedKey);
  final addresses = wantsUndefined ? _addressesOf(keys) : null;
  final patterns = wantsUndefined ? _callPatterns(options.translateFunctions) : <RegExp>[];
  final undefinedKeys = <Chki18nKeyUsage>[];
  final reported = <String>{};

  if (keysByLeaf.isEmpty && !wantsUndefined) {
    return const Chki18nUsageScan(unusedKeys: [], undefinedKeys: [], scannedFileCount: 0);
  }

  // Shrinks as leaves turn up. Searching only what is still missing is what
  // keeps this cheap: in a real project most keys are found in the first
  // handful of files, and every later file costs one search per remaining leaf.
  final remaining = keysByLeaf.keys.toSet();
  final skip = skipFiles.toSet();
  var scannedFileCount = 0;

  Future<void> walk(String directory) async {
    if (remaining.isEmpty && !wantsUndefined) {
      return;
    }

    List<FileSystemEntity> entries;

    try {
      entries = await Directory(directory).list(followLinks: false).toList();
    } catch (_) {
      // A folder that cannot be read should degrade the scan, not fail it.
      return;
    }

    for (final entry in entries) {
      if (remaining.isEmpty && !wantsUndefined) {
        return;
      }

      final name = basenameOf(entry.path);

      if (name.startsWith('.') || options.exclude.contains(name)) {
        continue;
      }

      final path = joinPath(directory, name);

      if (entry is Directory) {
        await walk(path);
        continue;
      }

      if (!_isScannableName(name) || skip.contains(path)) {
        continue;
      }

      String content;

      try {
        if (await File(path).length() > sourceMaxFileBytes) {
          continue;
        }

        content = await File(path).readAsString();
      } catch (_) {
        continue;
      }

      scannedFileCount += 1;

      remaining.removeWhere(content.contains);

      if (addresses == null) {
        continue;
      }

      for (final key in _callsIn(content, patterns)) {
        if (addresses.contains(key) || reported.contains(key)) {
          continue;
        }

        reported.add(key);
        undefinedKeys.add(Chki18nKeyUsage(key: key, file: path));
      }
    }
  }

  // Absolute from here on, so `skipFiles` (which are absolute) compare equal.
  await walk(absolutePath(sourcePath));

  final unusedKeys = <String>[];

  for (final leaf in remaining) {
    unusedKeys.addAll(keysByLeaf[leaf] ?? const []);
  }

  return Chki18nUsageScan(
    unusedKeys: unusedKeys,
    undefinedKeys: undefinedKeys,
    scannedFileCount: scannedFileCount,
  );
}
