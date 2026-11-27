---
title: checkTranslationFiles
---

# `checkTranslationFiles`

Reads a directory of translation files and compares every language against the target language, in one call. It does what the CLI does and returns the result as a value you can act on. Reach for it when a directory is checked once.

## Signature

::: lang js

```typescript
function checkTranslationFiles(path?: string, options?: Chki18nOptions): Promise<Chki18nResult>;
```

:::

::: lang dart

```dart
Future<Chki18nResult> checkTranslationFiles({String? path, Chki18nOptions? options});
```

:::

::: lang py

```python
def check_translation_files(
    path: str | None = None,
    options: Options | None = None,
) -> Result: ...
```

Synchronous, unlike the JavaScript package. Python's file reads are synchronous, so an `async` signature would promise concurrency this package cannot deliver.

:::

::: lang rs

```rust
pub fn check_translation_files(path: Option<&str>, options: &Options) -> CheckResult
```

Synchronous, unlike the JavaScript and Dart packages. Files are read with the standard library, which blocks, and the crate depends on no async runtime. When `source` is set, the source files are read on several threads at once, but inside the call, which still returns only once all of them have been read. Rust has no default arguments, so pass `None` for no path and `&Options::default()` for no options.

:::

## Usage

::: lang js

```javascript
import { checkTranslationFiles } from 'chki18n';

const result = await checkTranslationFiles('./locales', { target: 'en' });

result.success; // false
result.summary.error; // 1
result.issues;
// [
//   {
//     code: 'NO_KEY',
//     level: 'error',
//     locale: 'ko',
//     key: 'attr.folder',
//     group: '',
//     targetValue: 'Folder',
//     file: '/project/locales/ko.json',
//     message: 'The key exists in the target language but is missing here.'
//   }
// ]
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
result.of(Chki18nCheckCode.noKey).first;
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
result.of("NO_KEY")[0]
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

::: lang rs

```rust
use chki18n::{check_translation_files, CheckCode, Options};

let result = check_translation_files(
    Some("./locales"),
    &Options {
        target: Some("en".into()),
        ..Options::default()
    },
);

result.success; // false
result.summary.error; // 1
result.issues_by_code()[&CheckCode::NoKey][0];
// Issue {
//     code: NoKey,
//     level: Error,
//     locale: "ko",
//     key: "attr.folder",
//     group: "",
//     value: None,
//     target_value: Some(
//         "Folder",
//     ),
//     interpolation: None,
//     related_key: None,
//     file: Some(
//         "/project/locales/ko.json",
//     ),
//     message: "The key exists in the target language but is missing here.",
// }
```

Every field of `Options` is an `Option`, so `..Options::default()` leaves out the ones you do not set. `issues_by_code()` groups the issues by check, and `result.issues` is a plain `Vec<Issue>` to filter however you like.

:::

The path can also be given as an option, which is how the CLI passes its positional argument:

::: lang js

```javascript
await checkTranslationFiles(undefined, { path: './locales', target: 'en' });
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  options: const Chki18nOptions(path: './locales', target: 'en'),
);
```

:::

::: lang py

```python
check_translation_files(options=Options(path="./locales", target="en"))
```

:::

::: lang rs

```rust
check_translation_files(
    None,
    &Options {
        path: Some("./locales".into()),
        target: Some("en".into()),
        ..Options::default()
    },
);
```

When both are given, `path` in the options wins over the argument.

:::

Every option is on [Options](/guide/options), and the result on [The result object](/reference/result).

## Printing and exiting

Two things this function deliberately does not do:

- **It prints nothing** unless `verbose` is set. Importing the module cannot pollute a host application's output.
- **It never exits the process.** A failing check comes back as <Lang js="result.success === false" dart="result.success == false" py="result.success is False" rs="result.success == false" code />. Exiting is the CLI's job, and it does it after this function returns.

Turn the output on when you want the CLI's report from your own script:

::: lang js

```javascript
await checkTranslationFiles('./locales', { target: 'en', verbose: true });
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(target: 'en', verbose: true),
);
```

:::

::: lang py

```python
check_translation_files("./locales", Options(target="en", verbose=True))
```

:::

::: lang rs

```rust
check_translation_files(
    Some("./locales"),
    &Options {
        target: Some("en".into()),
        verbose: Some(true),
        ..Options::default()
    },
);
```

:::

`reporter` and `groupBy` shape that report exactly as they shape the CLI's. `output` writes it to a file whether or not `verbose` is set, because saving a file is something the caller asked for explicitly.

::: lang js

```javascript
await checkTranslationFiles('./locales', { target: 'en', output: 'report.md' });
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(target: 'en', output: 'report.md'),
);
```

:::

::: lang py

```python
check_translation_files("./locales", Options(target="en", output="report.md"))
```

:::

::: lang rs

```rust
check_translation_files(
    Some("./locales"),
    &Options {
        target: Some("en".into()),
        output: Some("report.md".into()),
        ..Options::default()
    },
);
```

:::

To render a result without printing or saving it, call <Lang js="formatResult" dart="formatResult" py="format_result" rs="format_result" code /> yourself:

::: lang js

```javascript
import { formatResult, resolveOptions } from 'chki18n';

formatResult(result, resolveOptions({ target: 'en', reporter: 'markdown' }).options);
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

formatResult(
  result,
  resolveOptions(
    const Chki18nOptions(target: 'en', reporter: Chki18nReporter.markdown),
  ).options,
);
```

:::

::: lang py

```python
from chki18n import Options, format_result, resolve_options

format_result(result, resolve_options(Options(target="en", reporter="markdown"))[0])
```

:::

::: lang rs

```rust
use chki18n::{format_result, resolve_options, Options, ReportInit};

let (options, _issues) = resolve_options(&Options {
    target: Some("en".into()),
    reporter: Some("markdown".into()),
    ..Options::default()
});

format_result(&result, &options, &ReportInit::default());
```

`resolve_options` returns the resolved options together with the `INVALID_OPTIONS` issues it raised. The third argument of `format_result` is what one rendering may set beyond the options: the reporter, the colour, the width, and the directory that paths are shown relative to. With `ReportInit::default()` the reporter and colour come from the options, the report is 96 columns wide, and paths are shown in full.

:::

## Failing a build

::: lang js

```javascript
import { checkTranslationFiles } from 'chki18n';

const result = await checkTranslationFiles('./locales', { target: 'en' });

if (!result.success) {
	for (const issue of result.issues.filter((one) => one.level === 'error')) {
		console.error(`${issue.locale} ${issue.key}: ${issue.message}`);
	}

	process.exit(1);
}
```

:::

::: lang dart

```dart
import 'dart:io';

import 'package:chki18n/chki18n.dart';

final result = await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(target: 'en'),
);

if (!result.success) {
  for (final issue in result.issues.where((one) => one.level == Chki18nLevel.error)) {
    stderr.writeln('${issue.locale} ${issue.key}: ${issue.message}');
  }

  exitCode = 1;
}
```

:::

::: lang py

```python
import sys

from chki18n import Options, check_translation_files

result = check_translation_files("./locales", Options(target="en"))

if not result.success:
    for issue in (one for one in result.issues if one.level == "error"):
        print(f"{issue.locale} {issue.key}: {issue.message}", file=sys.stderr)

    sys.exit(1)
```

:::

::: lang rs

```rust
use std::process;

use chki18n::{check_translation_files, Level, Options};

let result = check_translation_files(
    Some("./locales"),
    &Options {
        target: Some("en".into()),
        ..Options::default()
    },
);

if !result.success {
    for issue in result.issues.iter().filter(|one| one.level == Level::Error) {
        eprintln!("{} {}: {}", issue.locale, issue.key, issue.message);
    }

    process::exit(1);
}
```

:::

`success` is false when at least one issue is at `error` level. Warnings never make it false, so promote one with [`levels`](/guide/options#levels) if your project treats it as a blocker.

## How errors are reported

A missing directory, an unreadable file, JSON that does not parse, a target language that is nowhere in the files: none of these raise. They come back as issues, so one bad file does not hide everything else that was found:

::: lang js

```javascript
const result = await checkTranslationFiles('./does-not-exist');

result.success; // false
result.issuesByCode.INVALID_FILE;
// [{ code: 'INVALID_FILE', level: 'error', message: "Failed to read the directory …" }]
```

:::

::: lang dart

```dart
final result = await checkTranslationFiles(path: './does-not-exist');

result.success; // false
result.of(Chki18nCheckCode.invalidFile);
// [Chki18nIssue(code: INVALID_FILE, level: error, message: "Failed to read the directory …")]
```

:::

::: lang py

```python
result = check_translation_files("./does-not-exist")

result.success  # False
result.of("INVALID_FILE")
# [Issue(code="INVALID_FILE", level="error", message="Failed to read the directory …")]
```

:::

::: lang rs

```rust
let result = check_translation_files(Some("./does-not-exist"), &Options::default());

result.success; // false
result.issues_by_code().get(&CheckCode::InvalidFile);
// Some([
//     Issue { code: InvalidFile, level: Error, message: "Failed to read the directory …", .. },
//     Issue { code: InvalidFile, level: Error, message: "No translation file was found in …", .. },
// ])
```

:::

Calling it with no path at all is reported the same way, as an `INVALID_OPTIONS` error.

## Timing

<Lang js="result.elapsedMs" dart="result.elapsedMs" py="result.elapsed_ms" rs="result.elapsed_ms" code /> covers the whole call: the scan, the parse and the comparison. Checking the same directory more than once means scanning it more than once, so use [`loadTranslations`](./load-translations) for that kind of work.

## See also

- [`analyzeTranslations`](./analyze-translations) — the same comparison, on data you already hold.
- [`loadTranslations`](./load-translations) — scan once, then check as often as you like.
- [Command line](/guide/cli) — the same thing, as a command.
