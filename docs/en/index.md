---
layout: home

title: chki18n
titleTemplate: Check and verify your i18n translation files
description: Find the missing keys, the empty values and the broken interpolation in your i18n translation files. One check engine for the command line, for CI and for your own JavaScript — fast enough to lint as you type.

hero:
  name: chki18n
  text: Your translation files, checked
  tagline: Missing keys, empty values, strings never translated, interpolation that no longer matches. Eleven checks over every i18n JSON layout, from the command line or from your own code.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: What it checks
      link: /guide/checks
    - theme: alt
      text: API
      link: /api/
  image:
    src: /512x512.png
    alt: chki18n

features:
  - title: Eleven checks, one report
    details: Missing keys, empty values, untranslated strings, mismatched interpolation, duplicate values, stray whitespace, numbers dropped in translation. Each with a severity you can override.
    link: /guide/checks
    linkText: What it checks
  - title: Every layout you already use
    details: One file per locale, one folder per locale, or a single file holding them all. Files that share keys are compared as a group, so errors.json is never confused with common.json.
    link: /guide/file-layouts
    linkText: File layouts
  - title: The CLI and the API are one thing
    details: Every command-line flag is an API option and the other way round, resolved from a single definition. What passes in CI passes in your build script.
    link: /guide/options
    linkText: Options
  - title: Fast enough to lint as you type
    details: 5,000 keys across 5 locales compare in about 17ms, and re-checking one edited key takes about 2µs. An editor can validate on every keystroke.
    link: /api/create-analyzer
    linkText: createAnalyzer
  - title: Results you can render
    details: Every issue carries its level, its key, its locale and a sentence describing it, so a dashboard or a translation editor can show a result without hard-coding a single string.
    link: /reference/result
    linkText: The result object
  - title: Runs where your app runs
    details: The comparison engine imports no Node built-in and is published on its own as chki18n/core, so it bundles for a browser or an editor's renderer process.
    link: /api/core
    linkText: chki18n/core
---

## What it looks like

Point it at a folder and name the language everything is compared against:

```bash
npx chki18n ./locales --target en
```

```text
 Chki18n  ERROR  [NO_KEY] Some translation files did not include the following keys (1):
 - ko -> 'attr.folder' (en: "Folder")

 Chki18n  WARN  [NOT_TRANSLATED_VALUE] Some keys have the same value as the target language (1):
 - ko -> 'desc.no-str' (en: "12345")

 Chki18n  INFO  Compared 10 keys across 2 locales in 1 group. (3ms)
 Chki18n  INFO  Found 1 error and 1 warning.
```

It exits with `1` when an error level issue was found, so a CI job fails on it.

The same run from JavaScript, where the result is an object rather than a page of text:

```javascript
import { checkTranslationFiles } from 'chki18n';

const result = await checkTranslationFiles('./locales', { target: 'en' });

result.success; // false
result.summary; // { error: 1, warn: 1, info: 0, total: 2, byCode: {…}, byLocale: {…} }
result.issues[0];
// {
//   code: 'NO_KEY',
//   level: 'error',
//   locale: 'ko',
//   key: 'attr.folder',
//   group: '',
//   targetValue: 'Folder',
//   file: '/project/locales/ko.json',
//   message: 'The key exists in the target language but is missing here.'
// }
```

Installing it is one page, [Getting started](./guide/getting-started). What each check looks for is on [Checks](./guide/checks), and every option is on [Options](./guide/options).
