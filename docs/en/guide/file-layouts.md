---
title: File layouts
---

# File layouts

Translation files are laid out in one of three ways, and chki18n recognises all of them without being told which. Files that hold the same keys in different languages are compared as a group, so a project split across several translation files is checked file by file rather than as one flat pile of keys.

## The three layouts

### `single` — one file per locale

The most common shape, and what most i18n setups start with:

```text
locales/
  en.json
  ko.json
  ja.json
```

The file's name is the locale. Sub-folders are allowed, and each becomes its own group:

```text
locales/
  en.json
  ko.json
  admin/
    en.json
    ko.json
```

### `folder` — one folder per locale

What `next-i18next` and most namespace-based setups use:

```text
locales/
  en/
    common.json
    errors.json
  ko/
    common.json
    errors.json
```

The folder is the locale and the file is the namespace. `common.json` and `errors.json` are two groups: a key missing from one is never reported against the other.

### `nested` — one file holding every locale

```text
locales/
  translation.json
```

```json
{
	"en": { "desc": { "hello": "Hello" } },
	"ko": { "desc": { "hello": "안녕하세요" } }
}
```

The top-level keys are the locales. Several such files are allowed, each becoming its own group.

## How the layout is detected

Path shape alone is ambiguous — `a/ko.json` and `ko/common.json` both have two segments — so the decision is made by **which segment is a real locale code**:

1. A file whose name is a locale (`ko.json`) means `single`.
2. A folder whose name is a locale (`ko/`) means `folder`.
3. Neither, but a file whose top-level keys are locales, means `nested`.

A locale code is recognised by its base language subtag, so `en`, `en-US`, `pt_BR` and `zh-Hans` are all accepted.

Force the answer when you need to:

```bash
chki18n ./locales --format folder
```

::: lang js

```javascript
await checkTranslationFiles('./locales', { format: 'folder' });
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(format: Chki18nFileFormat.folder),
);
```

:::

::: lang py

```python
check_translation_files("./locales", Options(format="folder"))
```

:::

If a forced layout matches no file, that is reported as an `INVALID_FILE` error rather than passing quietly with nothing checked.

## Groups

A **group** is one set of files that hold the same keys in different languages. Every check runs inside a group and never across two.

| Layout   | Path                   | Group               | Locale             |
| -------- | ---------------------- | ------------------- | ------------------ |
| `single` | `en.json`              | `` (the root)       | `en`               |
| `single` | `admin/en.json`        | `admin`             | `en`               |
| `folder` | `en/common.json`       | `common.json`       | `en`               |
| `folder` | `admin/en/common.json` | `admin/common.json` | `en`               |
| `nested` | `translation.json`     | `translation.json`  | each top-level key |

This is what stops `errors.json` from being reported as missing every key that only `common.json` has. A project with one group — the usual `single` layout at a folder root — has the group name `''`, and the CLI leaves it off the line rather than printing an empty `@`.

Groups appear on every issue as `issue.group`, and in the result as `result.groups`.

## What gets scanned

Only `.json` files are read. Hidden entries — anything whose name starts with `.` — are skipped, and so are these directories:

```text
node_modules  dist  build  out  coverage
.git  .next  .nuxt  .svelte-kit  .turbo  .cache
```

Replace that list with your own when the defaults do not fit:

```bash
chki18n ./locales --exclude tmp,vendor
```

::: lang js

```javascript
await checkTranslationFiles('./locales', { exclude: ['tmp', 'vendor'] });
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(exclude: ['tmp', 'vendor']),
);
```

:::

::: lang py

```python
check_translation_files("./locales", Options(exclude=["tmp", "vendor"]))
```

:::

Note that `exclude` **replaces** the default list rather than adding to it, so include the defaults you still want.

A file that is read but does not belong to a locale is skipped silently; `--debug` names every one of them, which is the fastest way to find out why a scan came back empty.

## Nested keys

Keys are flattened before they are compared, so a nested object and a dotted key are the same thing:

```json
{ "desc": { "hello": "Hello" } }
```

is compared as `desc.hello`. That is the form every issue reports, and the form [`session.get`](/api/load-translations) and [`checkEntry`](/api/create-analyzer) expect.
