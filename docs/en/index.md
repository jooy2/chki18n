---
layout: home

title: chki18n
titleTemplate: Check and verify your i18n translation files
description: Find the missing keys, the empty values and the broken interpolation in your i18n translation files. One check engine for the command line, for CI and for your own code, in JavaScript, Dart or Python.

hero:
  name: chki18n
  text: Your translation files, checked
  tagline: Twenty-five checks over every i18n JSON layout, run from the command line, in CI, or from your own code. JavaScript, Dart and Python.
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
    src: /640x640.png
    alt: chki18n

features:
  - title: Twenty-five checks, one report
    details: Missing keys, empty values, strings nobody translated, interpolation that does not match, invisible characters, terminology that drifted between two screens. Every comparison check reports at a severity you can override.
    link: /guide/checks
    linkText: What it checks
  - title: Every layout you already use
    details: One file per locale, one folder per locale, or a single file holding them all. Files that share keys are compared as a group, so errors.json is never confused with common.json.
    link: /guide/file-layouts
    linkText: File layouts
  - title: Three languages, one library
    details: JavaScript, Dart and Python packages that run the same checks in the same order and print the same report, character for character. Pick the one your project already speaks.
    link: /guide/getting-started
    linkText: Getting started
  - title: The CLI and the API are one thing
    details: Every command-line flag is an API option and the other way round, resolved from a single definition. What passes in CI passes in your build script.
    link: /guide/options
    linkText: Options
  - title: Results you can render
    details: Every issue carries its level, its key, its locale and a sentence describing it, so a dashboard or a translation editor can show a result without hard-coding a single string.
    link: /reference/result
    linkText: The result object
  - title: Runs where your app runs
    details: The comparison engine reaches no file system and is published on its own, so it bundles for a browser, a Flutter web build or a sandbox with no disk.
    link: /api/core
    linkText: The core entry point
---

## What it looks like

Point it at a folder and name the language everything is compared against:

::: lang js

```bash
npx chki18n ./locales --target en
```

:::

::: lang dart

```bash
dart pub global activate chki18n
chki18n ./locales --target en
```

:::

::: lang py

```bash
pip install chki18n
chki18n ./locales --target en
```

:::

```text
  Path     ./locales
  Target   en
  Locales  en, ko
  Layout   single, 1 group, 10 keys

 ko ──────────────────────────────────────────────────────────────────────── 1 error · 1 warning

  ERROR  NO_KEY (1)
         The key exists in the target language but is missing here.
    attr.folder  en: "Folder"

  WARN   NOT_TRANSLATED_VALUE (1)
         The value is identical to the target language, so the translation may be incomplete.
    desc.no-str  en: "12345"

 Summary ───────────────────────────────────────────────────────────────────────────────────────

  Compared 10 keys across 2 locales in 1 group. (3ms)
  1 error · 1 warning
  Clean: en

  FAIL  1 error must be fixed before this passes.
```

It exits with `1` when an error level issue was found, so a CI job fails on it. Every package prints that report to the column, whichever one you install.

The same run from code returns an object instead of a page of text:

::: lang js

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

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

final result = await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(target: 'en'),
);

result.success; // false
result.summary.error; // 1
result.issues.first;
// Chki18nIssue(
//   code: Chki18nCheckCode.noKey,
//   level: Chki18nLevel.error,
//   locale: 'ko',
//   key: 'attr.folder',
//   group: '',
//   targetValue: 'Folder',
//   file: '/project/locales/ko.json',
//   message: 'The key exists in the target language but is missing here.',
// )
```

:::

::: lang py

```python
from chki18n import Options, check_translation_files

result = check_translation_files("./locales", Options(target="en"))

result.success  # False
result.summary.error  # 1
result.issues[0]
# Issue(
#     code="NO_KEY",
#     level="error",
#     locale="ko",
#     key="attr.folder",
#     group="",
#     target_value="Folder",
#     file="/project/locales/ko.json",
#     message="The key exists in the target language but is missing here.",
# )
```

:::

Installing it is one page, [Getting started](./guide/getting-started). What each check looks for is on [Checks](./guide/checks), and every option is on [Options](./guide/options).
