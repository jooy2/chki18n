---
title: Checks
---

# Checks

Every problem chki18n reports has a check code, a severity and a sentence describing it. Errors fail the run; warnings are reported and do not. This page lists all of them, what each one looks for, and when it is worth switching one off.

## At a glance

| Level | Code | What it catches |
| --- | --- | --- |
| Error | `INVALID_FILE` | A file that could not be read, parsed or matched to a locale |
| Error | `NO_KEY` | A key the target language has and this locale does not |
| Error | `NO_INTERPOLATION_KEY` | A placeholder the target language has and this value does not |
| Error | `EXTRA_INTERPOLATION_KEY` | A placeholder this value has and the target language does not |
| Error | `DUPLICATE_KEY` | A key defined twice, so one of its two values is lost |
| Warning | `DUMMY_KEY` | A key this locale has and the target language does not |
| Warning | `EMPTY_VALUE` | A key defined with an empty string |
| Warning | `NOT_TRANSLATED_VALUE` | A value identical to the target language's |
| Warning | `DUPLICATE_VALUE` | Two keys in one locale with the same value |
| Warning | `SURROUNDING_WHITESPACE` | A value that begins or ends with whitespace |
| Warning | `MISSING_NUMBER` | Digits in the target language's value that the translation dropped |
| Warning | `INVALID_VALUE_TYPE` | A value that is not a string |
| Error | `NO_LOCALE` | A group with no file for a language the other groups have |
| Error | `INTERPOLATION_COUNT` | A placeholder used a different number of times |
| Warning | `TAG_MISMATCH` | Markup the target language has and this value does not |
| Warning | `UNTRANSLATED_SCRIPT` | A value with no character of its language's script |
| Warning | `INCONSISTENT_VALUE` | Two keys with one original translated two ways |
| Warning | `INVISIBLE_CHARACTER` | A zero width, bidirectional or non-breaking character |
| Warning | `NUMBER_MISMATCH` | A number the translation changed rather than dropped |
| Warning | `KEY_NAMING` | A key not written in the case `keyCase` asks for |
| Warning | `KEY_DEPTH` | A key nested deeper than `maxKeyDepth` allows |
| Info | `SUSPICIOUS_LENGTH` | A value far longer or shorter than the target language's |
| Info | `UNUSED_KEY` | A key nothing in the scanned source appears to reference |
| Warning | `UNDEFINED_KEY` | A key the source asks for that no language file defines |
| Warning | `NO_PLURAL_FORM` | A plural form a language needs and the file does not have |

The last three are off until an option says what the project wants: `keyCase`, `maxKeyDepth` and `lengthRatio`. None of them has a right answer on its own.

`INVALID_OPTIONS` also appears in a result, at whatever level fits: `info` when an option simply fell back to its default, `error` when the target language is nowhere in the files and there is nothing to compare against.

## Structural checks

### `NO_LOCALE`

A group of files holds nothing for a language the other groups do have. This is what a missing file looks like: `ja/common.json` exists, `ja/errors.json` was never created, and without this check every key it should have held drops out of the comparison and the run passes.

```text
locales/
  en/common.json  en/errors.json
  ja/common.json
```

```text
[NO_LOCALE] ja @errors.json
```

It needs more than one group to mean anything. With a single set of files, every language that exists at all is in it.

### `NO_KEY`

The target language defines a key and this locale does not. The most common finding, and the one most worth failing a build on: a missing key is a string your users will see untranslated, or a crash, depending on your i18n runtime.

```json
// en.json
{ "attr": { "folder": "Folder" } }
// ko.json
{ "attr": {} }
```

```text
[NO_KEY] ko -> 'attr.folder' (en: "Folder")
```

### `DUMMY_KEY`

The reverse: this locale has a key the target language does not. Usually a key that was renamed or deleted in the source language and left behind in the translations — dead weight rather than a defect, which is why it is a warning.

```json
// en.json
{ "attr": { "folder": "Folder" } }
// ko.json
{ "attr": { "folder": "폴더", "legacy": "예전 문구" } }
```

```text
[DUMMY_KEY] ko -> 'attr.legacy' (ko: "예전 문구")
```

### `DUPLICATE_KEY`

The same key is defined twice, so one of the two values is thrown away before anything gets to read it. Two ways to write it, and neither is visible afterwards:

```json
// The literal kind — valid JSON, and `JSON.parse` answers "Hi" without a word
{ "greeting": "Hello", "greeting": "Hi" }
```

```json
// The collision kind — a nested key and a dotted one flatten to the same thing
{ "attr": { "folder": "Folder" }, "attr.folder": "Directory" }
```

The first is what a botched merge conflict leaves behind; the second is what happens when part of a file is written in dotted form and part of it nested. Both are found — the literal kind by reading the file's text before it is parsed, which is the only moment the evidence still exists, and the message names the line it is on.

An error, because a value is being lost. This is the one check whose severity chki18n would rather you did not lower, though `levels` will let you.

### `INVALID_FILE`

A file that could not be read, was empty, did not parse as JSON, or — when a layout was forced with `format` — matched no file at all. Reported before any comparison, and always an error: a file that could not be read is not a file that passed.

## Value checks

### `EMPTY_VALUE`

The key is defined but its value is `""`. Often a placeholder someone left for later, which is exactly the thing that ships by accident. It is a warning by default; promote it if your project treats an empty string as a missing translation:

```bash
chki18n ./locales --levels EMPTY_VALUE=error
```

### `NOT_TRANSLATED_VALUE`

The value is byte-for-byte identical to the target language's. Either the translation was never done, or the word is genuinely the same in both languages — `OK`, `Wi-Fi`, a product name. Both are common, which is why this is a warning rather than an error.

```json
// en.json
{ "desc": { "same": "Same" } }
// ko.json
{ "desc": { "same": "Same" } }
```

If your project has many legitimately identical strings, switching it off is reasonable:

```bash
chki18n ./locales --ignore-checks NOT_TRANSLATED_VALUE
```

### `SURROUNDING_WHITESPACE`

The value begins or ends with whitespace. Almost always accidental — a trailing space that survived a copy-paste — and it shows up as a layout bug that is hard to see in a diff.

```json
{ "attr": { "trim": " Folder " } }
```

### `MISSING_NUMBER`

The target language's value contains digits and the translation does not. Catches a number dropped while translating: `You have 3 items` becoming `여러 개 있습니다`. A heuristic, so a warning — a translation that deliberately spells the number out will trip it.

### `INVALID_VALUE_TYPE`

The value is not a string: a number, a boolean, `null`, or an object that survived flattening. Most i18n runtimes want strings, and a `null` is a bug in whatever wrote the file. A warning, because arrays and numbers do have legitimate uses in some setups.

### `DUPLICATE_VALUE`

Two keys in the same locale carry the same value. Sometimes duplication worth collapsing, sometimes two genuinely different strings that happen to read the same. The issue names the first key that used the value, in `relatedKey`.

```text
[DUPLICATE_VALUE] ko -> 'dup-b' (en: "Beta") The key `dup-a` in the same locale already uses this value.
```

Like `DUPLICATE_KEY` and `UNUSED_KEY`, this one has to see more than a single key, so it is **not** reported by [`checkEntry`](/api/create-analyzer). The codes with that property are listed in `CROSS_KEY_CHECK_CODES`.

### `NUMBER_MISMATCH`

`MISSING_NUMBER` asks whether the translation kept any digits at all. This one asks whether it kept the same ones. A translation that says five where the original says three is a worse bug than one that says neither, and it passes every other check.

```json
// en.json
{ "count": "You have 3 items" }
// ko.json
{ "count": "5개 있습니다" }
```

Numbers the translation reordered are fine — `3 of 5` and `5 중 3` hold the same numbers — and a translation that spells its numbers out is left to `MISSING_NUMBER`.

### `TAG_MISMATCH`

The markup a value carries, compared against the target language's. A dropped `<b>` renders as plain text; a dropped `</b>` bolds the rest of the page; and in a `<Trans>` component a tag the translation does not have is a child that never renders.

```json
// en.json
{ "hint": "Click <b>here</b> to continue" }
// ko.json
{ "hint": "계속하려면 여기를 누르세요" }
```

```text
[TAG_MISMATCH] ko -> 'hint' The tags `<b>` and `</b>` of the target language are missing from this value.
```

Tags are counted, not just looked for, so a value that opens twice and closes once is reported too. Tag names are read case-insensitively, and text that merely compares two numbers — `a < b` — is not mistaken for markup.

This is a warning rather than an error because `<Ctrl>` in a keyboard hint is a tag as far as any pattern can tell. Promote it with `--levels TAG_MISMATCH=error` once you know your files.

### `UNTRANSLATED_SCRIPT`

A value that holds no character of the script its language is written in. `NOT_TRANSLATED_VALUE` only catches a translation that is character-for-character the original; add an exclamation mark and it passes.

```json
// en.json
{ "greet": "Hello" }
// ko.json
{ "greet": "Hello!" }
```

Only languages whose script says something are checked — Korean, Japanese, Chinese, Russian, Arabic, Greek, Hebrew, Thai and the rest of that list. A language written in the Latin alphabet is not, since there would be nothing to tell it apart from the English nobody translated. A locale that names its own script, such as `sr-Latn`, is left alone.

A value that is only a placeholder, a tag or a number is skipped. A brand name that stays in English is not, which is the false positive to expect here.

### `INCONSISTENT_VALUE`

`DUPLICATE_VALUE` asks whether one locale repeats itself. This asks the opposite: two keys share one string in the target language, and this locale translates them differently.

```json
// en.json
{ "save-a": "Save", "save-b": "Save" }
// ko.json
{ "save-a": "저장", "save-b": "보관" }
```

```text
[INCONSISTENT_VALUE] ko -> 'save-b' The key `save-a` has the same en value but is translated as "저장".
```

This is the terminology drift that turns one button into two different words on two screens. It is a warning because the same English word does sometimes need two translations.

### `INVISIBLE_CHARACTER`

A zero width space, a byte order mark, a bidirectional control, or a non-breaking space where an ordinary space was meant. These survive a copy out of a design tool or a spreadsheet, they break a lookup that compares strings, and no review will ever see them.

```text
[INVISIBLE_CHARACTER] ko -> 'clean' The value holds a zero width space (U+200B), which nothing will draw.
```

### `SUSPICIOUS_LENGTH`

A value far longer or shorter than the one it translates, which is what a truncated string or a pasted paragraph looks like. `lengthRatio` says how far is too far: `4` reports anything under a quarter or over four times the original.

```bash
chki18n ./locales --length-ratio 3
```

Lengths are counted in columns rather than characters, so Korean and Japanese are not short by default. Originals under eight columns are skipped, because a ratio says nothing about `OK`. Reported at `info`: languages differ in length honestly, and this is a prompt to look rather than a defect.

## Usage checks

### `UNUSED_KEY`

Nothing in your source files appears to reference this key. Off unless you point chki18n at the sources to search:

```bash
chki18n ./locales --target en --source ./src
```

::: lang js

```javascript
await checkTranslationFiles('./locales', { target: 'en', source: './src' });
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(target: 'en', source: './src'),
);
```

:::

::: lang py

```python
check_translation_files("./locales", Options(target="en", source="./src"))
```

:::

The search is for a key's **leaf segment** — `desc.hello` is looked up as `hello` — because code so often resolves a nested key by its last segment alone, through a scoped `t('hello')` or a namespace bound higher up. Matching the whole dotted key would report working code as unused, which is the worse mistake of the two.

That also decides the severity. A leaf like `name` or `title` will turn up in almost any codebase whether or not the key is used, so this is a hint rather than a finding: it is reported at `info`, it never fails a run, and it is worth reading as "start looking here" rather than "delete this".

The project's own translation files are never searched — a key appears verbatim in the file that defines it, so reading them would mark every key used. Only text files are read (source, styles, templates, docs), skipping anything over 5MB, and the `exclude` list applies here too.

If you already know the answer — an editor that has scanned the project itself — hand it over instead of having it worked out again:

::: lang js

```javascript
analyzeTranslations({ locales, unusedKeys: ['desc.orphan'] }, { target: 'en' });
```

:::

::: lang dart

```dart
analyzeTranslations(
  Chki18nInput(locales: locales, unusedKeys: const ['desc.orphan']),
  options: const Chki18nOptions(target: 'en'),
);
```

:::

::: lang py

```python
analyze_translations(
    Input(locales=locales, unused_keys=["desc.orphan"]), Options(target="en")
)
```

:::

### `UNDEFINED_KEY`

The reverse of `UNUSED_KEY`, and the more serious of the two: the source calls for a key and no language file defines it. Depending on the runtime the user sees the raw key, an empty string, or nothing at all.

```javascript
t('attr.missing'); // no language file has it
```

```text
[UNDEFINED_KEY] 'attr.missing' The scanned source asks for `attr.missing` and no language file defines it.
```

It needs the same `source` directory `UNUSED_KEY` does, and reads the calls it finds there. `translateFunctions` says which names a call goes by; the default covers `t`, `$t` and `translate`, which between them cover i18next, react-i18next and vue-i18n, including `i18n.t` and a `t` bound by `useTranslation`. The `i18nKey` attribute a `<Trans>` component takes is read as well.

Three shapes are deliberately let through, on the same reasoning that makes `UNUSED_KEY` search for the leaf: a check that cries wolf on working code is worse than one that misses something.

- A key built at run time — ``t(`error.${code}`)`` — because the key is not known until it runs.
- A key reached through a prefix — `t('folder')` where the file defines `attr.folder` — because a bound `keyPrefix` or namespace resolves it.
- A plural key asked for by its base — `t('item')` where the file defines `item_one` and `item_other` — because the runtime picks the form.

A namespace written in front of the key, as in `t('common:attr.folder')`, is read and set aside; the key after it is what is looked up.

## Plural checks

### `NO_PLURAL_FORM`

A key written with plural suffixes, missing a form the language needs. Which forms a language needs is a fact about the language rather than about the original: English writes two, Russian four, Korean one.

```json
// ru.json — Russian needs one, few, many and other
{ "item_one": "{count} элемент", "item_other": "{count} элементов" }
```

```text
[NO_PLURAL_FORM] ru -> 'item' `ru` needs `item_few` and `item_many` and the file does not define them.
```

Only the named categories are read: `_zero`, `_one`, `_two`, `_few`, `_many` and `_other`. The older i18next pairing of a bare key with `_plural` is left as ordinary keys, because which of the two forms is which depends on the language.

A language the table does not cover is never judged. The table is deliberately conservative: recent CLDR releases added a `many` category to several languages for compact decimals, and a project on an older runtime does not write it.

### What this changes for `NO_KEY` and `DUMMY_KEY`

A plural form belongs to one language's grammar, so the two key checks stopped asking every language for every form. Korean needs only `item_other`, and `item_one` being absent from it is correct rather than missing; Russian needs an `item_few` that English never writes, and that is not a stray key.

This applies only to keys ending in a named plural category, and only to languages the table covers. Everything else is compared exactly as before.

## Key shape checks

Both are off until you say what the project wants, because a key's shape has no right answer of its own — only the one your project chose. They are judged once per key rather than once per locale: a key is named the same everywhere.

### `KEY_NAMING`

`keyCase` names the case every segment of a key has to be written in: `kebab`, `camel` or `snake`.

```bash
chki18n ./locales --key-case kebab
```

```text
[KEY_NAMING] 'attr.badName' The part `badName` is not written in kebab case.
```

The plural and context suffixes an i18n library appends — `item-count_one`, `greeting_male` — are accepted whatever case you chose, because that underscore belongs to the library rather than to your naming.

A key is reported once however many of its parts are wrong. Naming the second one adds nothing to what has to be done about it.

### `KEY_DEPTH`

`maxKeyDepth` is how many levels a key may be nested. `2` allows `attr.folder` and reports `attr.folder.name`.

```bash
chki18n ./locales --max-key-depth 2
```

```text
[KEY_DEPTH] 'a.b.c.d' The key is 4 levels deep, and `maxKeyDepth` allows 2.
```

Deep nesting is what makes a key hard to search for and a translation file hard to merge. One level of grouping is usually enough.

## Interpolation checks

An interpolation key is a placeholder inside a string — `{name}` by default. Both sides of the comparison are extracted and the two sets are compared, so a placeholder that was translated along with the sentence gets caught.

### `NO_INTERPOLATION_KEY`

The target language's value has a placeholder that this value does not. At run time this is a variable that never gets substituted, so it is an error.

```json
// en.json
{ "desc": { "hello": "Hello {name}" } }
// ko.json
{ "desc": { "hello": "안녕하세요" } }
```

```text
[NO_INTERPOLATION_KEY] ko -> 'desc.hello' (en: "Hello {name}")
  The interpolation key `{name}` of the target language is missing from this value.
```

### `EXTRA_INTERPOLATION_KEY`

The reverse: this value has a placeholder the target language does not define. Usually a typo (`{nmae}`) or a placeholder invented during translation, and at run time it renders as literal braces.

### `INTERPOLATION_COUNT`

The two checks above ask which placeholders a value uses. This one asks how many times it uses each. A string naming the same placeholder twice and a translation naming it once agree on the set and disagree on the sentence.

```json
// en.json
{ "invite": "{name} invited {name}" }
// ko.json
{ "invite": "{name}님이 초대했습니다" }
```

```text
[INTERPOLATION_COUNT] ko -> 'invite' The interpolation key `{name}` is used 1 time here and 2 times in the target language.
```

A placeholder that is missing outright, or that the target language does not have at all, is left to the two checks above.

### Custom delimiters

The default delimiters are `{` and `}`. If your project uses `{{ }}`, say so — otherwise every placeholder goes unrecognised and both interpolation checks silently pass:

```bash
chki18n ./locales --interpolation-prefix "{{" --interpolation-suffix "}}"
```

::: lang js

```javascript
await checkTranslationFiles('./locales', {
	interpolationPrefix: '{{',
	interpolationSuffix: '}}'
});
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(interpolationPrefix: '{{', interpolationSuffix: '}}'),
);
```

:::

::: lang py

```python
check_translation_files(
    "./locales", Options(interpolation_prefix="{{", interpolation_suffix="}}")
)
```

:::

## Choosing which checks run

Run only some of them:

```bash
chki18n ./locales --checks NO_KEY,NO_INTERPOLATION_KEY
```

Or everything except some:

```bash
chki18n ./locales --ignore-checks DUPLICATE_VALUE,MISSING_NUMBER
```

The two cannot be combined — `checks` wins and `ignoreChecks` is reported as ignored. `INVALID_FILE` and `INVALID_OPTIONS` are not in either list: they report how the run itself went and cannot be switched off.

## Changing a check's severity

Every comparison check can be re-graded, which is how a project decides for itself what blocks a build:

```bash
chki18n ./locales --levels EMPTY_VALUE=error,DUPLICATE_VALUE=info
```

::: lang js

```javascript
await checkTranslationFiles('./locales', {
	levels: { EMPTY_VALUE: 'error', DUPLICATE_VALUE: 'info' }
});
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(
    levels: {
      Chki18nCheckCode.emptyValue: Chki18nLevel.error,
      Chki18nCheckCode.duplicateValue: Chki18nLevel.info,
    },
  ),
);
```

:::

::: lang py

```python
check_translation_files(
    "./locales",
    Options(levels={"EMPTY_VALUE": "error", "DUPLICATE_VALUE": "info"}),
)
```

:::

Levels are `error`, `warn` and `info`. Only `error` fails a run, so demoting a check to `info` keeps it in the report without blocking anything. `INVALID_FILE` and `INVALID_OPTIONS` cannot be re-graded.

## Reading the codes from code

The codes and their metadata are exported, so a user interface never has to hard-code a string:

::: lang js

```javascript
import { ANALYZE_CHECK_CODES, CHECK_CODE, CHECK_META } from 'chki18n';

CHECK_META[CHECK_CODE.NO_KEY];
// {
//   level: 'error',
//   summary: 'Some translation files did not include the following keys',
//   description: 'The key exists in the target language but is missing here.'
// }

ANALYZE_CHECK_CODES; // every code that compares translations, in report order
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

checkMeta[Chki18nCheckCode.noKey];
// Chki18nCheckMeta(
//   level: Chki18nLevel.error,
//   summary: 'Some translation files did not include the following keys',
//   description: 'The key exists in the target language but is missing here.',
// )

analyzeCheckCodes; // every code that compares translations, in report order
```

:::

::: lang py

```python
from chki18n import ANALYZE_CHECK_CODES, CHECK_META

CHECK_META["NO_KEY"]
# CheckMeta(
#     level="error",
#     summary="Some translation files did not include the following keys",
#     description="The key exists in the target language but is missing here.",
# )

ANALYZE_CHECK_CODES  # every code that compares translations, in report order
```

:::

`summary` is the heading for a list of occurrences; `description` describes one. See [The result object](/reference/result) for how they fit together.
