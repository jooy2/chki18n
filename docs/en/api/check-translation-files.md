---
title: checkTranslationFiles
---

# `checkTranslationFiles`

Reads a directory of translation files and compares every language against the target language, in one call. This is what the CLI does, as a value you can act on — and the entry point to reach for when a directory is checked once.

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

Synchronous, unlike the JavaScript package: Python's file system is, and an `async` surface would be a promise this package cannot keep anything with.

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

The path can also be given as an option, which is what the CLI does with its positional argument:

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

Every option is on [Options](/guide/options), and the result on [The result object](/reference/result).

## It never prints and never exits

Two things this function deliberately does not do:

- **It prints nothing** unless `verbose` is set. Importing the module cannot pollute a host application's output.
- **It never exits the process.** A failing check is <Lang js="result.success === false" dart="result.success == false" py="result.success is False" code />, not an exit call. Exiting is the CLI's job, and it does it after this function returns.

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

`reporter` and `groupBy` shape that report exactly as they shape the CLI's. `output` writes it to a file, and that happens whether or not `verbose` is set: a file is something you asked for rather than something printed at you.

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

To render a result without printing or saving it, call <Lang js="formatResult" dart="formatResult" py="format_result" code /> yourself:

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

`success` is false when at least one issue is at `error` level. Warnings never make it false — promote one with [`levels`](/guide/options#levels) if your project treats it as a blocker.

## Errors are reported, not raised

A missing directory, an unreadable file, JSON that does not parse, a target language that is nowhere in the files — none of these raise. They come back as issues, so one bad file does not hide everything else that was found:

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

Calling it with no path at all is reported the same way, as an `INVALID_OPTIONS` error.

## Timing

<Lang js="result.elapsedMs" dart="result.elapsedMs" py="result.elapsed_ms" code /> covers the whole call — the scan, the parse and the comparison. Checking the same directory more than once means scanning it more than once; use [`loadTranslations`](./load-translations) when that is the shape of the work.

## See also

- [`analyzeTranslations`](./analyze-translations) — the same comparison, on data you already hold.
- [`loadTranslations`](./load-translations) — scan once, then check as often as you like.
- [Command line](/guide/cli) — the same thing, as a command.
