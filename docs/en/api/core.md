---
title: chki18n/core
---

# `chki18n/core`

The comparison engine on its own, without the directory scanner. It imports no Node built-in, so it bundles for a browser, a worker, or an editor's renderer process — anywhere `node:fs` is not available.

## Why it exists

The package root reads directories, so it imports `node:fs`, `node:path` and `node:os`. A bundler pointed at it in a browser build either fails or pulls in a pile of polyfills for code that will never run.

The comparison itself never needed any of that. `chki18n/core` is the same engine with the file system left out:

```javascript
import { analyzeTranslations, createAnalyzer, CHECK_META } from 'chki18n/core';
```

A test walks the subpath's import graph on every build and fails if a Node built-in ever appears in it, so this is a guarantee rather than an intention.

## What it exports

Everything the root does **except** the parts that read files:

| Exported | Not exported |
| --- | --- |
| [`analyzeTranslations`](./analyze-translations), [`createAnalyzer`](./create-analyzer) | `checkTranslationFiles` |
| `createSession` (for translations you pass in) | `loadTranslations` |
| `CHECK_CODE`, `CHECK_META`, `ANALYZE_CHECK_CODES`, `CROSS_KEY_CHECK_CODES`, `FILE_FORMAT` | `scanTranslationDirectory` |
| `groupIssuesByCode`, `summarizeIssues`, `createIssue`, `buildResult` |  |
| `resolveOptions`, `argsToOptions`, `buildUsageText`, `OPTION_DEFINITIONS` |  |
| `isLocaleCode`, `extractInterpolationKeys`, and every type |  |

The root re-exports all of it, so `import { createAnalyzer } from 'chki18n'` works too — reach for the subpath when the bundle must not carry the scanner.

## In a browser

Read the files with whatever that environment already uses, then hand the parsed objects over:

```javascript
import { analyzeTranslations } from 'chki18n/core';

const en = await fetch('/locales/en.json').then((res) => res.json());
const ko = await fetch('/locales/ko.json').then((res) => res.json());

const result = analyzeTranslations({ locales: { en, ko } }, { target: 'en' });
```

## In an editor

The pairing this was built for — a full pass when a project opens, and one key on every edit:

```javascript
import { createAnalyzer } from 'chki18n/core';

const analyzer = createAnalyzer({ target: 'en' });

analyzer.analyze({ groups: everything }); // on open
analyzer.checkEntry({ key, values, locales }); // on each keystroke
```

See [`createAnalyzer`](./create-analyzer) for the whole pattern, and for why passing values in beats letting chki18n hold a second copy of them.

## Dependencies

Two, both of them small and neither of them Node-specific: `flat` for flattening nested keys, and `qsu` for extracting interpolation placeholders. `chalk` and `minimist` belong to the CLI and are not reachable from here.
