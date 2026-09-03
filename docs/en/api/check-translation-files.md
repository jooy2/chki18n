---
title: checkTranslationFiles
---

# `checkTranslationFiles`

Reads a directory of translation files and compares every language against the target language, in one call. This is what the CLI does, as a value you can act on — and the entry point to reach for when a directory is checked once.

## Signature

```typescript
function checkTranslationFiles(path?: string, options?: Chki18nOptions): Promise<Chki18nResult>;
```

## Usage

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

The path can also be given as an option, which is what the CLI does with its positional argument:

```javascript
await checkTranslationFiles(undefined, { path: './locales', target: 'en' });
```

Every option is on [Options](/guide/options), and the result on [The result object](/reference/result).

## It never prints and never exits

Two things this function deliberately does not do:

- **It prints nothing** unless `verbose` is set. Importing the module cannot pollute a host application's output.
- **It never exits the process.** A failing check is `result.success === false`, not a `process.exit(1)`. Exiting is the CLI's job, and it does it after this function returns.

Turn the output on when you want the CLI's report from your own script:

```javascript
await checkTranslationFiles('./locales', { target: 'en', verbose: true });
```

`reporter` and `groupBy` shape that report exactly as they shape the CLI's. `output` writes it to a file, and that happens whether or not `verbose` is set: a file is something you asked for rather than something printed at you.

```javascript
await checkTranslationFiles('./locales', { target: 'en', output: 'report.md' });
```

To render a result without printing or saving it, call `formatResult` yourself:

```javascript
import { formatResult, resolveOptions } from 'chki18n';

formatResult(result, resolveOptions({ target: 'en', reporter: 'markdown' }).options);
```

## Failing a build

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

`success` is `false` when at least one issue is at `error` level. Warnings never make it `false` — promote one with [`levels`](/guide/options#levels) if your project treats it as a blocker.

## Errors are reported, not thrown

A missing directory, an unreadable file, JSON that does not parse, a target language that is nowhere in the files — none of these throw. They come back as issues, so one bad file does not hide everything else that was found:

```javascript
const result = await checkTranslationFiles('./does-not-exist');

result.success; // false
result.issuesByCode.INVALID_FILE;
// [{ code: 'INVALID_FILE', level: 'error', message: "Failed to read the directory …" }]
```

Calling it with no path at all is reported the same way, as an `INVALID_OPTIONS` error.

## Timing

`result.elapsedMs` covers the whole call — the scan, the parse and the comparison. Checking the same directory more than once means scanning it more than once; use [`loadTranslations`](./load-translations) when that is the shape of the work.

## See also

- [`analyzeTranslations`](./analyze-translations) — the same comparison, on data you already hold.
- [`loadTranslations`](./load-translations) — scan once, then check as often as you like.
- [Command line](/guide/cli) — the same thing, as a command.
