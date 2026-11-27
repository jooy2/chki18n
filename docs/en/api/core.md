---
title: The core entry point
---

# The core entry point

The comparison engine on its own, without the directory scanner, so it runs where there is no file system to read.

Each package publishes it under its own name:

| Package    | Import                               |
| ---------- | ------------------------------------ |
| JavaScript | `import { … } from 'chki18n/core'`   |
| Dart       | `import 'package:chki18n/core.dart'` |
| Python     | `from chki18n.core import …`         |
| Rust       | `use chki18n::core::…`               |

## How it differs from the package root

The package root reads directories, so it imports the file system modules: <Lang js="`node:fs`, `node:path` and `node:os`" dart="`dart:io`" py="`os` and `shutil`" rs="`std::fs` and `std::path`" />.

::: lang js dart py

A build that cannot supply them either fails or pulls in a stack of polyfills for code that will never run.

:::

The comparison itself uses none of them. The core entry point is the same engine with the file reading left out:

::: lang js

```javascript
import { analyzeTranslations, createAnalyzer, CHECK_META } from 'chki18n/core';
```

A test walks the subpath's import graph on every build and fails if a Node built-in appears in it.

:::

::: lang dart

```dart
import 'package:chki18n/core.dart';
```

A test walks the entry point's import graph on every run and fails if `dart:io` appears in it. That is what keeps the comparison usable in a Flutter web build.

:::

::: lang py

```python
from chki18n.core import CHECK_META, analyze_translations, create_analyzer
```

A test walks the module's import graph on every run and fails if `os`, `pathlib` or `shutil` appears in it.

:::

::: lang rs

```rust
use chki18n::core::analyzer::{analyze_translations, create_analyzer};
use chki18n::core::session::create_session;
```

Rust ships one crate, with no feature flag that leaves the scanner out, so `chki18n::core` is a module rather than a separate build. Nothing in it calls `std::fs` or `std::path`, and the same holds for `types`, `options` and `constants`, which it builds on. Using only `core` still compiles the whole crate, scanner included.

`analyze` reads the clock through `std::time::Instant` to fill `elapsed_ms`. `check_entry` does not.

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
| `isLocaleCode`, `extractInterpolationKeys`, `detectInterpolationDelimiters` |  |
| `createPathExcluder`, `createFileExcluder`, and every type |  |

The root re-exports all of it, so `import { createAnalyzer } from 'chki18n'` works too. Reach for the subpath when the bundle must not carry the scanner.

:::

::: lang dart

| Exported | Not exported |
| --- | --- |
| [`analyzeTranslations`](./analyze-translations), [`createAnalyzer`](./create-analyzer) | `checkTranslationFiles` |
| `createSession` (for translations you pass in) | `loadTranslations` |
| `Chki18nCheckCode`, `checkMeta`, `analyzeCheckCodes`, `crossKeyCheckCodes`, `Chki18nFileFormat` | `scanTranslationDirectory` |
| `groupIssuesByCode`, `summarizeIssues`, `createIssue`, `buildResult` | `findUnusedKeys` |
| `resolveOptions`, `optionsFromArgs`, `buildUsageText`, `optionDefinitions` | `formatResult` |
| `isLocaleCode`, `extractInterpolationKeys`, `detectInterpolationDelimiters` |  |
| `createPathExcluder`, `createFileExcluder`, and every type |  |

`package:chki18n/chki18n.dart` re-exports all of it, so one import covers both. Reach for `core.dart` when the build must not pull `dart:io` in.

:::

::: lang py

| Exported | Not exported |
| --- | --- |
| [`analyze_translations`](./analyze-translations), [`create_analyzer`](./create-analyzer) | `check_translation_files` |
| `create_session` (for translations you pass in) | `load_translations` |
| `CHECK_CODES`, `CHECK_META`, `ANALYZE_CHECK_CODES`, `CROSS_KEY_CHECK_CODES`, `FILE_FORMATS` | `scan_translation_directory` |
| `group_issues_by_code`, `summarize_issues`, `create_issue`, `build_result` | `find_unused_keys` |
| `resolve_options`, `options_from_args`, `build_usage_text`, `OPTION_DEFINITIONS` | `format_result` |
| `is_locale_code`, `extract_interpolation_keys`, `detect_interpolation_delimiters` |  |
| `create_path_excluder`, `create_file_excluder`, and every type |  |

`chki18n` re-exports all of it, so `from chki18n import create_analyzer` works too. Reach for `chki18n.core` when the module must not touch the disk.

:::

::: lang rs

| Reads no files | Reads files or the environment |
| --- | --- |
| `core::analyzer`: [`analyze_translations`](./analyze-translations), [`create_analyzer`](./create-analyzer), `Analyzer` | `check`: `check_translation_files` |
| `core::session`: `create_session`, `Session` (for translations you pass in) | `check`: `load_translations`, `FileSession` |
| `constants`: `CheckCode`, `check_meta`, `ANALYZE_CHECK_CODES`, `CROSS_KEY_CHECK_CODES`, `FileFormat` | `loader::scan`: `scan_translation_directory` |
| `core::issue` and `core::result`: `summarize_issues`, `create_issue`, `build_result` | `loader::unused_keys`: `find_unused_keys` |
| `options`: `resolve_options`, `options_from_args`, `build_usage_text`, `OPTION_DEFINITIONS` | `reporter`: `format_result`, which checks the environment and the terminal before it colours |
| `core::locale` and `core::interpolation`: `is_locale_code`, `extract_interpolation_keys`, `detect_interpolation_delimiters` |  |
| `core::exclude`: `create_path_excluder`, `create_file_excluder` |  |
| `types`: every type, and `CheckResult::issues_by_code` to group a result by code |  |

Every path above is under `chki18n::`. The crate root re-exports the ones used most, so `use chki18n::{create_analyzer, Entry, Options};` needs no module path. The rest are reached through their module, such as `chki18n::core::locale::is_locale_code`.

:::

## Using it

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

::: lang rs

```rust
use chki18n::{analyze_translations, Input, Options, TranslationMap};
use indexmap::IndexMap;

// Compiled into the binary, so nothing is read at run time.
let en: TranslationMap = serde_json::from_str(include_str!("../locales/en.json"))?;
let ko: TranslationMap = serde_json::from_str(include_str!("../locales/ko.json"))?;

let result = analyze_translations(
    &Input {
        locales: Some(IndexMap::from([("en".into(), en), ("ko".into(), ko)])),
        ..Input::default()
    },
    &Options {
        target: Some("en".into()),
        ..Options::default()
    },
);
```

:::

## In an editor

Run a full pass when a project opens, then check one key on every edit:

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

::: lang rs

```rust
use chki18n::{create_analyzer, Entry, Input, Options};

let analyzer = create_analyzer(&Options {
    target: Some("en".into()),
    ..Options::default()
});

analyzer.analyze(&Input {
    groups: Some(everything),
    ..Input::default()
}); // on open
analyzer.check_entry(&Entry {
    key,
    values,
    locales: Some(locales),
    group: None,
}); // on each keystroke
```

:::

See [`createAnalyzer`](./create-analyzer) for the whole pattern, and for why passing the values in works better than letting chki18n hold a second copy of them.

## Dependencies

::: lang js

None. Flattening, placeholder extraction and every other step are written out in the package itself. `chalk` and `minimist` belong to the CLI and are not reachable from here.

:::

::: lang dart py

None. The one thing the core entry point reaches outside itself is <Lang dart="`dart:convert`, for the `json` reporter" py="`json`, `re` and `dataclasses`, all of them standard library" />.

:::

::: lang rs

Three crates. `indexmap` and `serde_json` hold the translations, and `regex`, built without its default features, tells whether a value holds a letter of any script. Outside `core`, the crate also uses `libc` on Unix, to measure the terminal for the console report.

:::
