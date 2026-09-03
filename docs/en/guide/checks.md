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
| Warning | `DUMMY_KEY` | A key this locale has and the target language does not |
| Warning | `EMPTY_VALUE` | A key defined with an empty string |
| Warning | `NOT_TRANSLATED_VALUE` | A value identical to the target language's |
| Warning | `DUPLICATE_VALUE` | Two keys in one locale with the same value |
| Warning | `SURROUNDING_WHITESPACE` | A value that begins or ends with whitespace |
| Warning | `MISSING_NUMBER` | Digits in the target language's value that the translation dropped |
| Warning | `INVALID_VALUE_TYPE` | A value that is not a string |

`INVALID_OPTIONS` also appears in a result, at whatever level fits: `info` when an option simply fell back to its default, `error` when the target language is nowhere in the files and there is nothing to compare against.

## Structural checks

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
npx chki18n ./locales --levels EMPTY_VALUE=error
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
npx chki18n ./locales --ignore-checks NOT_TRANSLATED_VALUE
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

## Usage checks

### `UNUSED_KEY`

Nothing in your source files appears to reference this key. Off unless you point chki18n at the sources to search:

```bash
npx chki18n ./locales --target en --source ./src
```

```javascript
await checkTranslationFiles('./locales', { target: 'en', source: './src' });
```

The search is for a key's **leaf segment** — `desc.hello` is looked up as `hello` — because code so often resolves a nested key by its last segment alone, through a scoped `t('hello')` or a namespace bound higher up. Matching the whole dotted key would report working code as unused, which is the worse mistake of the two.

That also decides the severity. A leaf like `name` or `title` will turn up in almost any codebase whether or not the key is used, so this is a hint rather than a finding: it is reported at `info`, it never fails a run, and it is worth reading as "start looking here" rather than "delete this".

The project's own translation files are never searched — a key appears verbatim in the file that defines it, so reading them would mark every key used. Only text files are read (source, styles, templates, docs), skipping anything over 5MB, and the `exclude` list applies here too.

If you already know the answer — an editor that has scanned the project itself — hand it over instead of having it worked out again:

```javascript
analyzeTranslations({ locales, unusedKeys: ['desc.orphan'] }, { target: 'en' });
```

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

### Custom delimiters

The default delimiters are `{` and `}`. If your project uses `{{ }}`, say so — otherwise every placeholder goes unrecognised and both interpolation checks silently pass:

```bash
npx chki18n ./locales --interpolation-prefix "{{" --interpolation-suffix "}}"
```

```javascript
await checkTranslationFiles('./locales', {
	interpolationPrefix: '{{',
	interpolationSuffix: '}}'
});
```

## Choosing which checks run

Run only some of them:

```bash
npx chki18n ./locales --checks NO_KEY,NO_INTERPOLATION_KEY
```

Or everything except some:

```bash
npx chki18n ./locales --ignore-checks DUPLICATE_VALUE,MISSING_NUMBER
```

The two cannot be combined — `checks` wins and `ignoreChecks` is reported as ignored. `INVALID_FILE` and `INVALID_OPTIONS` are not in either list: they report how the run itself went and cannot be switched off.

## Changing a check's severity

Every comparison check can be re-graded, which is how a project decides for itself what blocks a build:

```bash
npx chki18n ./locales --levels EMPTY_VALUE=error,DUPLICATE_VALUE=info
```

```javascript
await checkTranslationFiles('./locales', {
	levels: { EMPTY_VALUE: 'error', DUPLICATE_VALUE: 'info' }
});
```

Levels are `error`, `warn` and `info`. Only `error` fails a run, so demoting a check to `info` keeps it in the report without blocking anything. `INVALID_FILE` and `INVALID_OPTIONS` cannot be re-graded.

## Reading the codes from code

The codes and their metadata are exported, so a user interface never has to hard-code a string:

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

`summary` is the heading for a list of occurrences; `description` describes one. See [The result object](/reference/result) for how they fit together.
