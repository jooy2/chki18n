---
title: Getting started
---

# Getting started

Install chki18n, point it at the folder your translation files live in, and name the language everything else is compared against. There is no configuration file: a path and a target language are the whole contract.

## Requirements

Node.js **18 or newer**. The package is ESM with type declarations and has four small runtime dependencies.

## Install

Run it without installing anything, which is what a CI job usually wants:

```bash
npx chki18n ./locales --target en
```

Or add it to the project, which is what you want if you are going to call it from code:

```bash
npm install chki18n
```

```bash
pnpm add chki18n
```

```bash
yarn add chki18n
```

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

```bash
npx chki18n ./locales --target en
```

```text
 Chki18n  INFO  Process to check specified translation files... (Current path: /project/locales)
 Chki18n  INFO  This comparison is based on the following language: en

 Chki18n  ERROR  [NO_INTERPOLATION_KEY] The interpolation key does not match the target language (1):
 - ko -> 'desc.hello' (en: "Hello {name}") The interpolation key `{name}` of the target language is missing from this value.

 Chki18n  ERROR  [NO_KEY] Some translation files did not include the following keys (1):
 - ko -> 'attr.folder' (en: "Folder")

 Chki18n  INFO  Compared 3 keys across 2 locales in 1 group. (2ms)
 Chki18n  INFO  Found 2 errors and 0 warnings.
```

Two real problems: the Korean translation dropped the `{name}` placeholder, and it is missing a key entirely. The command exits with `1`, so a CI job fails here.

There is more on the command line — every flag, the exit code, how to wire it into CI — on [Command line](./cli).

## From JavaScript

The same check, as a value you can act on:

```javascript
import { checkTranslationFiles } from 'chki18n';

const result = await checkTranslationFiles('./locales', { target: 'en' });

if (!result.success) {
	for (const issue of result.issues) {
		console.log(`${issue.level} ${issue.locale} ${issue.key}: ${issue.message}`);
	}
}
```

Nothing is printed unless you ask for it, and the process is never exited for you — the returned result is the only thing to act on. See [The result object](/reference/result) for everything it carries.

## Which entry point

Four functions, depending on who owns the translations and how often you check them:

| Situation | Use |
| --- | --- |
| Check a directory once — CI, a script, a pre-commit hook | [`checkTranslationFiles`](/api/check-translation-files) |
| Check data you already have in memory, once | [`analyzeTranslations`](/api/analyze-translations) |
| Read a directory once, then check it repeatedly | [`loadTranslations`](/api/load-translations) |
| Your own application owns the values and needs only a verdict | [`createAnalyzer().checkEntry`](/api/create-analyzer) |

The first two read files and need Node. The last two do no file system work at all and are also published as [`chki18n/core`](/api/core), which bundles for a browser.

## Next

- [What it checks](./checks) — the thirteen checks, and how to switch one off.
- [File layouts](./file-layouts) — if your files are not one-per-locale.
- [Options](./options) — everything you can pass, from either side.
