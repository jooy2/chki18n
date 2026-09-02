---
title: analyzeTranslations
---

# `analyzeTranslations`

Compares translations you already hold in memory. It does no file system work at all, so it runs anywhere JavaScript does — in a browser, in an editor, in a worker — and it is the entry point to reach for when something else has already read the files.

## Signature

```typescript
function analyzeTranslations(input: Chki18nInput, options?: Chki18nOptions): Chki18nResult;
```

Synchronous: there is nothing to await.

## Usage

Pass one set of locales:

```javascript
import { analyzeTranslations } from 'chki18n';

const result = analyzeTranslations(
	{
		locales: {
			en: { desc: { hello: 'Hello {name}', bye: 'Goodbye' } },
			ko: { desc: { hello: '안녕하세요' } }
		}
	},
	{ target: 'en' }
);

result.keyCount; // 2
result.issuesByCode.NO_KEY[0].key; // 'desc.bye'
result.issuesByCode.NO_INTERPOLATION_KEY[0].interpolation; // 'name'
```

Nested objects are flattened before comparison, so `desc.hello` is what every issue reports.

## Several translation files

Use `groups` when your project has more than one set of files, so each is compared on its own and a key missing from one is never reported against the other:

```javascript
analyzeTranslations(
	{
		groups: {
			'common.json': { en: { ok: 'OK' }, ko: { ok: '확인' } },
			'errors.json': { en: { failed: 'Failed' }, ko: {} }
		}
	},
	{ target: 'en' }
);
// the one NO_KEY issue carries group: 'errors.json'
```

`{ locales }` is shorthand for a single group named `''`. See [File layouts](/guide/file-layouts#groups) for how a directory scan arrives at the same shape.

## Skipping the flatten pass

If your keys are already flat, say so and the objects you pass are used exactly as they are — nothing is copied and nothing is rebuilt:

```javascript
const en = { 'desc.hello': 'Hello {name}' };
const ko = { 'desc.hello': '안녕하세요' };

analyzeTranslations({ locales: { en, ko } }, { target: 'en', flattened: true });
```

This is the fast path. Comparing 5,000 keys across 5 locales takes about **17ms** flattened, against about 22ms when the flatten pass runs.

## Input

```typescript
interface Chki18nInput {
	groups?: { [group: string]: { [locale: string]: TranslationMap } };
	locales?: { [locale: string]: TranslationMap };
	files?: Chki18nSourceFile[];
	issues?: Chki18nIssue[];
	fileFormat?: Chki18nFileFormat;
}
```

`files` maps a group and locale onto the file it came from, so issues can carry a `file` path. `issues` lets whatever produced the input report its own problems into the same result — that is how a directory scan's unreadable-file errors end up in the same list as the comparison's findings. `fileFormat` is carried through to the result untouched.

## What the result says

```javascript
result.files; // [] — nothing was read from disk
result.fileFormat; // null — unless you passed one in
result.locales; // every locale seen, across all groups
result.groups; // every group name, in input order
result.keyCount; // distinct keys compared
```

Everything else is the same shape [`checkTranslationFiles`](./check-translation-files) returns. See [The result object](/reference/result).

## A locale that is not an object

Reported rather than thrown, like every other input problem:

```javascript
analyzeTranslations({ locales: { en: { a: 'A' }, ko: null } }, { target: 'en' });
// issuesByCode.INVALID_FILE — "The translations of `ko` are not an object."
```

## See also

- [`createAnalyzer`](./create-analyzer) — reuse one analyzer, and check a single key.
- [`chki18n/core`](./core) — this function without the Node built-ins the scanner needs.
