---
title: The core entry point
---

# The core entry point

The comparison engine on its own, without the directory scanner — so it runs where there is no file system to read.

Each package publishes it under its own name:

| Package    | Import                               |
| ---------- | ------------------------------------ |
| JavaScript | `import { … } from 'chki18n/core'`   |
| Dart       | `import 'package:chki18n/core.dart'` |
| Python     | `from chki18n.core import …`         |

## Why it exists

The package root reads directories, so it reaches for the file system: <Lang js="`node:fs`, `node:path` and `node:os`" dart="`dart:io`" py="`os` and `shutil`" />. A build that cannot offer those either fails or pulls in a pile of polyfills for code that will never run.

The comparison itself never needed any of it. The core entry point is the same engine with the file system left out:

::: lang js

```javascript
import { analyzeTranslations, createAnalyzer, CHECK_META } from 'chki18n/core';
```

A test walks the subpath's import graph on every build and fails if a Node built-in ever appears in it, so this is a guarantee rather than an intention.

:::

::: lang dart

```dart
import 'package:chki18n/core.dart';
```

A test walks the entry point's import graph on every run and fails if `dart:io` ever appears in it, so this is a guarantee rather than an intention. It is what makes the comparison usable in a Flutter web build.

:::

::: lang py

```python
from chki18n.core import CHECK_META, analyze_translations, create_analyzer
```

A test walks the module's import graph on every run and fails if `os`, `pathlib` or `shutil` ever appears in it, so this is a guarantee rather than an intention.

:::

## What it exports

Everything the root does **except** the parts that read files:

::: lang js

| Exported | Not exported |
| --- | --- |
| [`analyzeTranslations`](./analyze-translations), [`createAnalyzer`](./create-analyzer) | `checkTranslationFiles` |
| `createSession` (for translations you pass in) | `loadTranslations` |
| `CHECK_CODE`, `CHECK_META`, `ANALYZE_CHECK_CODES`, `CROSS_KEY_CHECK_CODES`, `FILE_FORMAT` | `scanTranslationDirectory` |
| `groupIssuesByCode`, `summarizeIssues`, `createIssue`, `buildResult` | `findUnusedKeys` |
| `resolveOptions`, `argsToOptions`, `buildUsageText`, `OPTION_DEFINITIONS` |  |
| `isLocaleCode`, `extractInterpolationKeys`, and every type |  |

The root re-exports all of it, so `import { createAnalyzer } from 'chki18n'` works too — reach for the subpath when the bundle must not carry the scanner.

:::

::: lang dart

| Exported | Not exported |
| --- | --- |
| [`analyzeTranslations`](./analyze-translations), [`createAnalyzer`](./create-analyzer) | `checkTranslationFiles` |
| `createSession` (for translations you pass in) | `loadTranslations` |
| `Chki18nCheckCode`, `checkMeta`, `analyzeCheckCodes`, `crossKeyCheckCodes`, `Chki18nFileFormat` | `scanTranslationDirectory` |
| `groupIssuesByCode`, `summarizeIssues`, `createIssue`, `buildResult` | `findUnusedKeys` |
| `resolveOptions`, `optionsFromArgs`, `buildUsageText`, `optionDefinitions` | `formatResult` |
| `isLocaleCode`, `extractInterpolationKeys`, and every type |  |

`package:chki18n/chki18n.dart` re-exports all of it, so one import covers both — reach for `core.dart` when the build must not pull `dart:io` in.

:::

::: lang py

| Exported | Not exported |
| --- | --- |
| [`analyze_translations`](./analyze-translations), [`create_analyzer`](./create-analyzer) | `check_translation_files` |
| `create_session` (for translations you pass in) | `load_translations` |
| `CHECK_CODES`, `CHECK_META`, `ANALYZE_CHECK_CODES`, `CROSS_KEY_CHECK_CODES`, `FILE_FORMATS` | `scan_translation_directory` |
| `group_issues_by_code`, `summarize_issues`, `create_issue`, `build_result` | `find_unused_keys` |
| `resolve_options`, `options_from_args`, `build_usage_text`, `OPTION_DEFINITIONS` | `format_result` |
| `is_locale_code`, `extract_interpolation_keys`, and every type |  |

`chki18n` re-exports all of it, so `from chki18n import create_analyzer` works too — reach for `chki18n.core` when the module must not touch the disk.

:::

## Where it earns its place

Read the files with whatever the environment already uses, then hand the parsed objects over:

::: lang js

```javascript
import { analyzeTranslations } from 'chki18n/core';

const en = await fetch('/locales/en.json').then((res) => res.json());
const ko = await fetch('/locales/ko.json').then((res) => res.json());

const result = analyzeTranslations({ locales: { en, ko } }, { target: 'en' });
```

:::

::: lang dart

```dart
import 'dart:convert';

import 'package:chki18n/core.dart';
import 'package:flutter/services.dart' show rootBundle;

final en = jsonDecode(await rootBundle.loadString('locales/en.json'));
final ko = jsonDecode(await rootBundle.loadString('locales/ko.json'));

final result = analyzeTranslations(
  Chki18nInput(locales: {'en': en as Map<String, Object?>, 'ko': ko as Map<String, Object?>}),
  options: const Chki18nOptions(target: 'en'),
);
```

:::

::: lang py

```python
import json

from chki18n.core import Input, Options, analyze_translations

en = json.loads(request.files["en"].read())
ko = json.loads(request.files["ko"].read())

result = analyze_translations(Input(locales={"en": en, "ko": ko}), Options(target="en"))
```

:::

## In an editor

The pairing this was built for — a full pass when a project opens, and one key on every edit:

::: lang js

```javascript
import { createAnalyzer } from 'chki18n/core';

const analyzer = createAnalyzer({ target: 'en' });

analyzer.analyze({ groups: everything }); // on open
analyzer.checkEntry({ key, values, locales }); // on each keystroke
```

:::

::: lang dart

```dart
import 'package:chki18n/core.dart';

final analyzer = createAnalyzer(options: const Chki18nOptions(target: 'en'));

analyzer.analyze(Chki18nInput(groups: everything)); // on open
analyzer.checkEntry(Chki18nEntry(key: key, values: values, locales: locales)); // on each keystroke
```

:::

::: lang py

```python
from chki18n.core import Entry, Input, Options, create_analyzer

analyzer = create_analyzer(Options(target="en"))

analyzer.analyze(Input(groups=everything))  # on open
analyzer.check_entry(Entry(key=key, values=values, locales=locales))  # on each keystroke
```

:::

See [`createAnalyzer`](./create-analyzer) for the whole pattern, and for why passing values in beats letting chki18n hold a second copy of them.

## Dependencies

::: lang js

Two, both of them small and neither of them Node-specific: `flat` for flattening nested keys, and `qsu` for extracting interpolation placeholders. `chalk` and `minimist` belong to the CLI and are not reachable from here.

:::

::: lang dart py

None. The one thing the core entry point reaches outside itself is <Lang dart="`dart:convert`, for the `json` reporter" py="`json`, `re` and `dataclasses`, all of them standard library" />.

:::
