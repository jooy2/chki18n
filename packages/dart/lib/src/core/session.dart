/// Holding a set of translations and checking them repeatedly.
library;

import 'package:chki18n/src/constants.dart';
import 'package:chki18n/src/core/analyzer.dart';
import 'package:chki18n/src/types.dart';

/// A set of translations held in memory, checked as often as needed.
///
/// Options are resolved once, the translations are flattened once, and every
/// later call works on what is already in memory. Use it when this module owns
/// the data; when your own application owns it, [Chki18nAnalyzer.checkEntry]
/// takes the values directly and keeps a single source of truth.
class Chki18nSession {
  /// Creates a session over translations that are already in memory.
  ///
  /// [options] shapes every check the session runs. Set `flattened` on it when
  /// the maps handed in are already keyed by their dotted paths.
  Chki18nSession(Chki18nInput input, {Chki18nOptions? options})
    // The session flattens once, up front, so the analyzer never has to.
    : _analyzer = Chki18nAnalyzer(
        options: (options ?? const Chki18nOptions()).copyWith(flattened: true),
      ),
      _inputIsFlat = options?.flattened == true {
    reset(input);
  }

  final Chki18nAnalyzer _analyzer;
  final bool _inputIsFlat;

  TranslationGroups _groups = {};
  List<String> _groupNames = [];
  List<String> _localeNames = [];
  List<Chki18nSourceFile> _files = const [];
  Chki18nFileFormat? _fileFormat;
  List<Chki18nIssue> _sourceIssues = const [];
  List<String> _unusedKeys = const [];
  List<Chki18nKeyUsage> _undefinedKeys = const [];

  /// The options every check of this session runs with.
  Chki18nResolvedOptions get options => _analyzer.options;

  /// Every locale the session holds.
  List<String> get locales => List.unmodifiable(_localeNames);

  /// Every group the session holds, in scan order.
  List<String> get groups => List.unmodifiable(_groupNames);

  /// The files the translations were read from, when they came from disk.
  List<Chki18nSourceFile> get files => _files;

  /// Layout the translations came from, or `null` for in-memory input.
  Chki18nFileFormat? get fileFormat => _fileFormat;

  /// Replaces the translations, keeping the options and the analyzer.
  void reset(Chki18nInput input) {
    final loadIssues = <Chki18nIssue>[];

    _groups = prepareGroups(input, _analyzer.options, loadIssues, flattened: _inputIsFlat);
    _groupNames = _groups.keys.toList();
    _files = input.files ?? const [];
    _fileFormat = input.fileFormat;
    _sourceIssues = [...?input.issues, ...loadIssues];
    _unusedKeys = input.unusedKeys ?? const [];
    _undefinedKeys = input.undefinedKeys ?? const [];

    final seen = <String>{};

    for (final group in _groupNames) {
      seen.addAll(_groups[group]!.keys);
    }

    _localeNames = seen.toList();
  }

  /// Which group a call means.
  ///
  /// With one group there is nothing to decide; with several, an unnamed key is
  /// looked for where it actually lives, so callers only have to name a group
  /// when adding a key that does not exist yet.
  String _resolveGroup(String? key, String? group) {
    if (group != null) {
      return group;
    }

    if (_groupNames.length < 2 || key == null) {
      return _groupNames.isEmpty ? '' : _groupNames.first;
    }

    for (final name in _groupNames) {
      for (final locale in _groups[name]!.keys) {
        if (_groups[name]![locale]!.containsKey(key)) {
          return name;
        }
      }
    }

    return _groupNames.isEmpty ? '' : _groupNames.first;
  }

  List<String> _localesOf(String group) => _groups[group]?.keys.toList() ?? const [];

  /// Keys of a group, target language first.
  List<String> keys([String? group]) {
    final name = _resolveGroup(null, group);
    final locales = _localesOf(name);

    return collectKeys([
      for (final locale in locales) _groups[name]![locale]!,
    ], locales.indexOf(_analyzer.options.target));
  }

  /// The flattened translations of a group, keyed by locale.
  ///
  /// The maps are the session's own: read them freely, but write through [set]
  /// and [remove].
  Map<String, TranslationMap> translations([String? group]) =>
      _groups[_resolveGroup(null, group)] ?? <String, TranslationMap>{};

  /// One value, or `null` when that locale does not define the key.
  Object? get(String locale, String key, [String? group]) =>
      _groups[_resolveGroup(key, group)]?[locale]?[key];

  /// Writes a value and reports what that key now looks like.
  List<Chki18nIssue> set(String locale, String key, String value, [String? group]) {
    final name = _resolveGroup(key, group);

    ((_groups[name] ??= <String, TranslationMap>{})[locale] ??= <String, Object?>{})[key] = value;

    if (!_localeNames.contains(locale)) {
      _localeNames = [..._localeNames, locale];
    }

    if (!_groupNames.contains(name)) {
      _groupNames = [..._groupNames, name];
    }

    return checkKey(key, name);
  }

  /// Drops a key from one locale, or from every locale, and re-checks it.
  List<Chki18nIssue> remove(String key, {String? locale, String? group}) {
    final name = _resolveGroup(key, group);
    final locales = locale != null ? [locale] : _localesOf(name);

    for (final one in locales) {
      _groups[name]?[one]?.remove(key);
    }

    return checkKey(key, name);
  }

  /// Checks a single key. Cross-key checks are not reported here.
  List<Chki18nIssue> checkKey(String key, [String? group]) {
    final name = _resolveGroup(key, group);
    final locales = _localesOf(name);
    final values = <String, Object?>{};

    for (final locale in locales) {
      if (_groups[name]![locale]!.containsKey(key)) {
        values[locale] = _groups[name]![locale]![key];
      }
    }

    return _analyzer.checkEntry(
      Chki18nEntry(key: key, values: values, locales: locales, group: name),
    );
  }

  /// Checks everything the session holds. Reads no files.
  Chki18nResult analyze() => _analyzer.analyze(
    Chki18nInput(
      groups: _groups,
      files: _files,
      issues: _sourceIssues,
      unusedKeys: _unusedKeys,
      undefinedKeys: _undefinedKeys,
      fileFormat: _fileFormat,
    ),
  );
}

/// Holds a set of translations and checks them repeatedly.
Chki18nSession createSession(Chki18nInput input, {Chki18nOptions? options}) =>
    Chki18nSession(input, options: options);
