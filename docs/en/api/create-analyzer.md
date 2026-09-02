---
title: createAnalyzer
---

# `createAnalyzer`

Returns a reusable analyzer bound to one set of options. Its `checkEntry` compares a single key across locales in about two microseconds, which is what an editor needs to validate on every keystroke without holding a second copy of the values.

## Signature

```typescript
function createAnalyzer(options?: Chki18nOptions): Chki18nAnalyzer;

interface Chki18nAnalyzer {
	readonly options: Chki18nResolvedOptions;
	readonly optionIssues: Chki18nIssue[];
	analyze: (input: Chki18nInput) => Chki18nResult;
	checkEntry: (entry: Chki18nEntry) => Chki18nIssue[];
}
```

## Why not just call `analyzeTranslations`

Options, the enabled check set and the interpolation delimiters are resolved once, when the analyzer is built. Calling [`analyzeTranslations`](./analyze-translations) in a loop re-resolves all of it on every call. For one check it makes no difference; for a check that runs on every keystroke it is the whole cost.

## `checkEntry`

```javascript
import { createAnalyzer } from 'chki18n';

const analyzer = createAnalyzer({ target: 'en' });

analyzer.checkEntry({
	key: 'desc.hello',
	values: { en: 'Hello {name}', ko: '안녕하세요' }
});
// [
//   {
//     code: 'NO_INTERPOLATION_KEY',
//     level: 'error',
//     locale: 'ko',
//     key: 'desc.hello',
//     interpolation: 'name',
//     message: 'The interpolation key `{name}` of the target language is missing from this value.'
//   }
// ]

analyzer.checkEntry({
	key: 'desc.hello',
	values: { en: 'Hello {name}', ko: '{name}님 안녕하세요' }
});
// []
```

`values` is `locale -> value`. The target language's value is read from the same object, so it has to be in there for a comparison to happen.

### Entry

```typescript
interface Chki18nEntry {
	key: string;
	values: { [locale: string]: any };
	group?: string;
	locales?: string[];
}
```

`group` is carried onto every issue, so a project with several translation files can tell them apart.

### Reporting a locale that has no value at all

By default the locales are the keys of `values`, so a language that is simply absent is not compared. Pass `locales` when a missing value has to be reported as missing:

```javascript
analyzer.checkEntry({ key: 'a', values: { en: 'Hello' }, locales: ['en', 'ko'] });
// [{ code: 'NO_KEY', locale: 'ko', … }]
```

An editor's grid usually has a cell for every language, empty ones included, which is why the default is the other way round: an empty cell is an `EMPTY_VALUE`, not a `NO_KEY`.

### What it will not report

Only checks that can be decided from one key. `DUPLICATE_VALUE` needs to see a whole locale at once and is never reported here; the codes with that property are in `CROSS_KEY_CHECK_CODES`.

Everything else agrees exactly with a full analysis of the same data — same codes, same order.

## Linting an editor grid

The shape this exists for. Your application owns the values; chki18n only judges them:

```javascript
import { createAnalyzer } from 'chki18n/core';

// Once, when the project opens.
const analyzer = createAnalyzer({
	target: project.primaryLocale,
	interpolationPrefix: project.interpolationPrefix,
	interpolationSuffix: project.interpolationSuffix
});

// On every edit, for the one row that changed.
function lintRow(row) {
	return analyzer.checkEntry({
		key: row.key,
		values: Object.fromEntries(row.cells.map((cell) => [cell.locale, cell.value])),
		locales: project.locales,
		group: row.group
	});
}
```

No copy of the data lives inside chki18n, so there is nothing to keep in step — which is the reason to prefer this over a [session](./load-translations) when your application is already the owner.

## `analyze`

The same comparison [`analyzeTranslations`](./analyze-translations) performs, on this analyzer's options:

```javascript
const analyzer = createAnalyzer({ target: 'en', flattened: true });

analyzer.analyze({ groups: everything }); // full pass, when the whole set changed
analyzer.checkEntry({ key, values }); // one key, on every keystroke
```

Running a full analysis on open and `checkEntry` on each edit is the usual pairing.

## `options` and `optionIssues`

```javascript
analyzer.options; // the resolved options — target, enabledChecks, delimiters, …
analyzer.optionIssues; // anything unusable in what you passed, as INVALID_OPTIONS
```

`optionIssues` is replayed into every result `analyze` produces, so a typo in an option is reported once per result rather than swallowed.

## Performance

Measured on 5,000 keys across 5 locales:

| Call                        | Cost   |
| --------------------------- | ------ |
| `analyze` (flattened input) | ~17ms  |
| `checkEntry`                | ~2.2µs |
| `session.checkKey`          | ~0.9µs |

`checkKey` is faster because the [session](./load-translations) builds the value set itself rather than being handed one. Either is far below a frame budget.
