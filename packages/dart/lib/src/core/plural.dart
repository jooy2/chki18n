/// Which plural forms a language needs, and how a key names the one it holds.
///
/// The table is deliberately conservative. Recent CLDR releases added a `many`
/// category to several languages for compact decimals, and a project on an
/// older i18n runtime does not write it; asking for a form nobody uses would
/// report a correct file as broken. Where the answer is not settled the
/// language is left out, and a language that is left out is never judged.
library;

/// A plural form a language may need, in the order CLDR lists them.
enum Chki18nPluralCategory {
  /// The form for none of a thing.
  zero,

  /// The singular.
  one,

  /// The dual.
  two,

  /// The small-count form several Slavic and Celtic languages carry.
  few,

  /// The large-count form.
  many,

  /// The form every language has, and the only one some of them have.
  other;

  /// The category a suffix names, or `null` when it names none.
  static Chki18nPluralCategory? parse(String value) {
    for (final category in values) {
      if (category.name == value) {
        return category;
      }
    }

    return null;
  }

  @override
  String toString() => name;
}

/// Every plural category, in the order CLDR lists them.
const List<Chki18nPluralCategory> pluralCategories = Chki18nPluralCategory.values;

/// The i18next suffix that predates the named categories, paired with a bare
/// key for the singular.
///
/// It is not read as a category: which of the two forms is which depends on the
/// language, so requiring either would report a correct file as broken. A key
/// written this way is judged as an ordinary key, exactly as it was before this
/// check existed.
const String _legacyPluralSuffix = 'plural';

const List<Chki18nPluralCategory> _onlyOther = [Chki18nPluralCategory.other];

const List<Chki18nPluralCategory> _oneOther = [
  Chki18nPluralCategory.one,
  Chki18nPluralCategory.other,
];

const List<Chki18nPluralCategory> _oneFewOther = [
  Chki18nPluralCategory.one,
  Chki18nPluralCategory.few,
  Chki18nPluralCategory.other,
];

const List<Chki18nPluralCategory> _oneFewManyOther = [
  Chki18nPluralCategory.one,
  Chki18nPluralCategory.few,
  Chki18nPluralCategory.many,
  Chki18nPluralCategory.other,
];

const Map<String, List<Chki18nPluralCategory>> _categoriesOfLanguage = {
  'af': _oneOther,
  'am': _oneOther,
  'ar': Chki18nPluralCategory.values,
  'az': _oneOther,
  'be': _oneFewManyOther,
  'bg': _oneOther,
  'bn': _oneOther,
  'bs': _oneFewOther,
  'ca': _oneOther,
  'cs': _oneFewManyOther,
  'cy': Chki18nPluralCategory.values,
  'da': _oneOther,
  'de': _oneOther,
  'el': _oneOther,
  'en': _oneOther,
  'es': _oneOther,
  'et': _oneOther,
  'eu': _oneOther,
  'fa': _oneOther,
  'fi': _oneOther,
  'fr': _oneOther,
  'ga': [
    Chki18nPluralCategory.one,
    Chki18nPluralCategory.two,
    Chki18nPluralCategory.few,
    Chki18nPluralCategory.many,
    Chki18nPluralCategory.other,
  ],
  'gu': _oneOther,
  'ha': _oneOther,
  'hi': _oneOther,
  'hr': _oneFewOther,
  'hu': _oneOther,
  'hy': _oneOther,
  'id': _onlyOther,
  'is': _oneOther,
  'it': _oneOther,
  'ja': _onlyOther,
  'ka': _oneOther,
  'kk': _oneOther,
  'km': _onlyOther,
  'kn': _oneOther,
  'ko': _onlyOther,
  'ky': _oneOther,
  'lo': _onlyOther,
  'lt': _oneFewManyOther,
  'lv': [Chki18nPluralCategory.zero, Chki18nPluralCategory.one, Chki18nPluralCategory.other],
  'ml': _oneOther,
  'mn': _oneOther,
  'mr': _oneOther,
  'ms': _onlyOther,
  'my': _onlyOther,
  'nb': _oneOther,
  'ne': _oneOther,
  'nl': _oneOther,
  'nn': _oneOther,
  'no': _oneOther,
  'pl': _oneFewManyOther,
  'pt': _oneOther,
  'ro': _oneFewOther,
  'ru': _oneFewManyOther,
  'si': _oneOther,
  'sk': _oneFewManyOther,
  'sl': [
    Chki18nPluralCategory.one,
    Chki18nPluralCategory.two,
    Chki18nPluralCategory.few,
    Chki18nPluralCategory.other,
  ],
  'sq': _oneOther,
  'sr': _oneFewOther,
  'sv': _oneOther,
  'sw': _oneOther,
  'ta': _oneOther,
  'te': _oneOther,
  'th': _onlyOther,
  'tr': _oneOther,
  'uk': _oneFewManyOther,
  'ur': _oneOther,
  'uz': _oneOther,
  'vi': _onlyOther,
  'zh': _onlyOther,
  'zu': _oneOther,
};

final Map<String, List<Chki18nPluralCategory>?> _cache = {};

final RegExp _subtagSeparator = RegExp('[-_]');

/// The plural forms a locale's language needs, or `null` when the language is
/// not one this table is sure about.
///
/// A language it is not sure about is left exactly as it was: nothing is
/// required of it and nothing is excused it.
List<Chki18nPluralCategory>? pluralCategoriesOf(String locale) {
  if (_cache.containsKey(locale)) {
    return _cache[locale];
  }

  final categories = _categoriesOfLanguage[locale.toLowerCase().split(_subtagSeparator).first];

  _cache[locale] = categories;

  return categories;
}

/// The key and the plural form a suffixed key names.
class Chki18nPluralParts {
  /// Creates the two halves of a plural key.
  const Chki18nPluralParts(this.base, this.category);

  /// The key without its plural suffix.
  final String base;

  /// The form the suffix names.
  final Chki18nPluralCategory category;
}

/// The key and the plural form a suffixed key names, or `null` when the key is
/// an ordinary one. `item_one` is the `one` form of `item`.
Chki18nPluralParts? pluralPartsOf(String key) {
  final separator = key.lastIndexOf('_');

  if (separator < 1) {
    return null;
  }

  final category = Chki18nPluralCategory.parse(key.substring(separator + 1));

  return category == null ? null : Chki18nPluralParts(key.substring(0, separator), category);
}

/// The key a plural form belongs to, whichever convention wrote it, or `null`
/// when the key is not a plural form at all.
///
/// Looser than [pluralPartsOf] on purpose: this answers "what does the source
/// call this?", where the legacy suffix is as good an answer as a named
/// category, and no check depends on which of the two it was.
String? pluralBaseOf(String key) {
  final parts = pluralPartsOf(key);

  if (parts != null) {
    // The source asks for `place` with `ordinal: true`, never for the infix.
    return isOrdinalBase(parts.base)
        ? parts.base.substring(0, parts.base.length - _ordinalInfix.length)
        : parts.base;
  }

  final separator = key.lastIndexOf('_');

  return separator > 0 && key.substring(separator + 1) == _legacyPluralSuffix
      ? key.substring(0, separator)
      : null;
}

/// Whether a locale's language uses a plural form at all.
///
/// A language the table does not cover is assumed to use every form, so nothing
/// changes for it.
bool usesPluralCategory(String locale, Chki18nPluralCategory category) {
  final categories = pluralCategoriesOf(locale);

  return categories == null || categories.contains(category);
}

/// What i18next writes between a key and the category of an ordinal form, as in
/// `place_ordinal_one`. Ordinal forms follow rules of their own, which the table
/// above does not hold: English needs `two` and `few` for `2nd` and `3rd`, while
/// German and Russian need only `other`.
const String _ordinalInfix = '_ordinal';

/// Whether the base of a plural key names ordinal forms, as `place_ordinal`
/// does.
bool isOrdinalBase(String base) =>
    base.length > _ordinalInfix.length && base.endsWith(_ordinalInfix);

/// Whether a locale's language uses the form a plural key names.
///
/// An ordinal form is asked for nothing beyond `other`: which ordinal forms a
/// language needs is not in the table, and `other` is the one every language
/// has.
bool usesPluralForm(String locale, Chki18nPluralParts parts) =>
    isOrdinalBase(parts.base)
        ? parts.category == Chki18nPluralCategory.other
        : usesPluralCategory(locale, parts.category);

/// The forms a plural key needs in a locale, or `null` when its language is
/// not one the table is sure about. Ordinal forms need `other` alone, for the
/// reason [usesPluralForm] gives.
List<Chki18nPluralCategory>? pluralFormsNeeded(String locale, String base) {
  final categories = pluralCategoriesOf(locale);

  return categories != null && isOrdinalBase(base)
      ? const [Chki18nPluralCategory.other]
      : categories;
}
