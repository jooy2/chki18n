---
title: Getting started
---

# Getting started

Install chki18n, point it at the folder your translation files live in, and name the language everything else is compared against. There is no configuration file: a path and a target language are all it takes.

## Pick a package

chki18n ships for three languages, and the three are one library: the same twenty-five checks in the same order, the same option names, the same report to the column, and the same exit code. Pick the one your project already speaks. The switch at the top of the sidebar rewrites every code sample on this site to match.

| Language | Registry | Install | Requires |
| --- | --- | --- | --- |
| JavaScript | [npm](https://www.npmjs.com/package/chki18n) | `npm install chki18n` | Node.js 18 or newer |
| Dart | [pub.dev](https://pub.dev/packages/chki18n) | `dart pub add chki18n` | Dart 3.7 or newer |
| Python | [PyPI](https://pypi.org/project/chki18n/) | `pip install chki18n` | Python 3.10 or newer |

### How the names map

Every function and every option is documented under its **JavaScript spelling**, because a heading and an anchor have to read the same for every reader. The other two follow one rule each, and this is the only place it is stated:

- **Dart** keeps the JavaScript spelling: `checkTranslationFiles`, `interpolationPrefix`, `maxKeyDepth`. What differs is the shape. Options are one `Chki18nOptions` object built with named parameters, and the closed value sets are enums, so `Chki18nCheckCode.noKey` stands in for `'NO_KEY'`. Its `code` is still `NO_KEY`.
- **Python** is snake_case throughout. `check_translation_files`, `interpolation_prefix`, `max_key_depth`. The check codes, the severities and the option choices stay the strings they are everywhere else: `"NO_KEY"`, `"error"`, `"kebab"`.

## Install

::: lang js

Run it without installing anything, the usual form for a CI job:

```bash
npx chki18n ./locales --target en
```

Or add it to the project when you are going to call it from code:

```bash
npm install chki18n
```

```bash
pnpm add chki18n
```

```bash
yarn add chki18n
```

The package is ESM with type declarations and has four small runtime dependencies.

:::

::: lang dart

Install the command once and it is on your path:

```bash
dart pub global activate chki18n
```

Or add it to the project when you are going to call it from code:

```bash
dart pub add chki18n
```

In a Flutter project that is `flutter pub add chki18n`. Inside a project that already depends on it, `dart run chki18n` runs the command without installing it globally. The package has no dependencies.

:::

::: lang py

Run it without installing anything, the usual form for a CI job:

```bash
pipx run chki18n ./locales --target en
```

Or add it to the project when you are going to call it from code:

```bash
pip install chki18n
```

```bash
uv add chki18n
```

The package is fully typed, ships `py.typed`, and has no dependencies.

:::

## Your first check

Say your project holds two translation files:

```text
locales/
  en.json
  ko.json
```

```json
// locales/en.json
{
	"desc": { "hello": "Hello {name}", "bye": "Goodbye" },
	"attr": { "folder": "Folder" }
}
```

```json
// locales/ko.json
{
	"desc": { "hello": "안녕하세요", "bye": "안녕히 계세요" }
}
```

Run it:

::: lang js

```bash
npx chki18n ./locales --target en
```

:::

::: lang dart py

```bash
chki18n ./locales --target en
```

:::

```text
  Path     ./locales
  Target   en
  Locales  en, ko
  Layout   single, 1 group, 3 keys

 ko ─────────────────────────────────────────────────────────────────────────────────── 2 errors

  ERROR  NO_KEY (1)
         The key exists in the target language but is missing here.
    attr.folder  en: "Folder"

  ERROR  NO_INTERPOLATION_KEY (1)
    desc.hello   en: "Hello {name}"
      The interpolation key `{name}` of the target language is missing from this value.

 Summary ───────────────────────────────────────────────────────────────────────────────────────

  Compared 3 keys across 2 locales in 1 group. (2ms)
  2 errors
  Clean: en

  By check
    NO_INTERPOLATION_KEY  1 error
    NO_KEY                1 error

  FAIL  2 errors must be fixed before this passes.
```

Two real problems: the Korean translation dropped the `{name}` placeholder, and it is missing a key entirely. The command exits with `1`, so a CI job fails here.

[Command line](./cli) has the rest: every flag, the exit code, and how to wire it into CI.

## From code

The same check, as a value you can act on:

::: lang js

```javascript
import { checkTranslationFiles } from 'chki18n';

const result = await checkTranslationFiles('./locales', { target: 'en' });

if (!result.success) {
	for (const issue of result.issues) {
		console.log(`${issue.level} ${issue.locale} ${issue.key}: ${issue.message}`);
	}
}
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

final result = await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(target: 'en'),
);

if (!result.success) {
  for (final issue in result.issues) {
    print('${issue.level.name} ${issue.locale} ${issue.key}: ${issue.message}');
  }
}
```

:::

::: lang py

```python
from chki18n import Options, check_translation_files

result = check_translation_files("./locales", Options(target="en"))

if not result.success:
    for issue in result.issues:
        print(f"{issue.level} {issue.locale} {issue.key}: {issue.message}")
```

:::

Nothing is printed unless you ask for it, and the process is never exited for you. The returned result is the only thing to act on. See [The result object](/reference/result) for everything it carries.

## Which entry point

Four functions, depending on who owns the translations and how often you check them:

| Situation | Use |
| --- | --- |
| Check a directory once — CI, a script, a pre-commit hook | [`checkTranslationFiles`](/api/check-translation-files) |
| Check data you already have in memory, once | [`analyzeTranslations`](/api/analyze-translations) |
| Read a directory once, then check it repeatedly | [`loadTranslations`](/api/load-translations) |
| Your own application owns the values and needs only a verdict | [`createAnalyzer().checkEntry`](/api/create-analyzer) |

`checkTranslationFiles` and `loadTranslations` read a directory. `analyzeTranslations` and `createAnalyzer` do no file system work at all, and are also published on their own as <Lang js="chki18n/core" dart="package:chki18n/core.dart" py="chki18n.core" code />, which runs where there is no disk to read. See [The core entry point](/api/core).

## Next

- [What it checks](./checks) — the twenty-five checks, and how to switch one off.
- [File layouts](./file-layouts) — if your files are not one-per-locale.
- [Options](./options) — everything you can pass, from either side.
