---
title: The result object
---

# The result object

Every entry point returns the same result, whether the translations came from a directory, from memory or from a session. It carries every issue found, the same issues grouped by check code, and counts by level, code, locale and group — so a dashboard or a build script never has to derive any of it.

## `Chki18nResult`

```typescript
interface Chki18nResult {
	success: boolean;
	issues: Chki18nIssue[];
	issuesByCode: Partial<Record<Chki18nCheckCode, Chki18nIssue[]>>;
	summary: Chki18nSummary;
	target: string;
	locales: string[];
	groups: string[];
	keyCount: number;
	files: Chki18nSourceFile[];
	fileFormat: Chki18nFileFormat | null;
	elapsedMs: number;
}
```

| Field          | Meaning                                                                        |
| -------------- | ------------------------------------------------------------------------------ |
| `success`      | `false` when at least one issue is at `error` level. Warnings never affect it. |
| `issues`       | Every issue, in scan order: target language key order, locale by locale.       |
| `issuesByCode` | The same issues grouped by check code, in the order the codes were first seen. |
| `summary`      | Counts by level, code, locale and group.                                       |
| `target`       | The language everything was compared against.                                  |
| `locales`      | Every locale that took part.                                                   |
| `groups`       | Every group name. `['']` for a single unnamed group.                           |
| `keyCount`     | Distinct keys compared, across every group.                                    |
| `files`        | The files that were read. Empty for in-memory input.                           |
| `fileFormat`   | `'single'`, `'folder'`, `'nested'`, or `null` for in-memory input.             |
| `elapsedMs`    | How long the call took, scan included where there was one.                     |

`issues` and `issuesByCode` hold the same objects, not copies — grouping is a view, not a duplicate.

## `Chki18nIssue`

```typescript
interface Chki18nIssue {
	code: Chki18nCheckCode;
	level: 'error' | 'warn' | 'info';
	locale: string;
	key: string;
	group: string;
	value?: string;
	targetValue?: string;
	interpolation?: string;
	relatedKey?: string;
	file?: string;
	message: string;
}
```

| Field | Meaning |
| --- | --- |
| `code` | Which check reported it. See [Checks](/guide/checks). |
| `level` | Its severity, after any [`levels`](/guide/options#levels) override. |
| `locale` | The locale the issue belongs to. Empty for issues that are not locale-bound. |
| `key` | The flattened key. Empty for file and option level issues. |
| `group` | The group the key belongs to. `''` when there is only one. |
| `value` | The value as found, where the check is about a value. |
| `targetValue` | The target language's value, which is what it was compared against. |
| `interpolation` | The placeholder that triggered an interpolation issue. |
| `relatedKey` | The other key involved — for `DUPLICATE_VALUE`, the first key using that value. |
| `file` | Absolute path of the file the key came from, when it came from one. |
| `message` | A sentence describing this occurrence. |

Optional fields are **absent** rather than `undefined`, so `JSON.stringify` and a deep comparison both behave.

## `Chki18nSummary`

```typescript
interface Chki18nSummary {
	error: number;
	warn: number;
	info: number;
	total: number;
	byCode: Partial<Record<Chki18nCheckCode, number>>;
	byLocale: Record<string, { error: number; warn: number; info: number }>;
	byGroup: Record<string, { error: number; warn: number; info: number }>;
}
```

Computed in one pass over the issues:

```javascript
result.summary;
// {
//   error: 2, warn: 7, info: 1, total: 10,
//   byCode: { NO_KEY: 1, EMPTY_VALUE: 1, NOT_TRANSLATED_VALUE: 1, … },
//   byLocale: { ko: { error: 2, warn: 7, info: 0 } },
//   byGroup: { '': { error: 2, warn: 7, info: 1 } }
// }
```

`byLocale` only counts issues that belong to a locale; an option or file level issue lands in `byGroup` but not in `byLocale`.

## Rendering a result

Every issue carries its own `message`, and `CHECK_META` describes each check, so a user interface never has to hard-code a string:

```javascript
import { CHECK_META } from 'chki18n';

CHECK_META.NO_KEY;
// {
//   level: 'error',
//   summary: 'Some translation files did not include the following keys',
//   description: 'The key exists in the target language but is missing here.'
// }
```

`summary` heads a list of occurrences; `description` describes one. An issue's own `message` is the description unless the check produced something more specific — which is what `NO_INTERPOLATION_KEY` does when it names the placeholder.

A minimal report:

```javascript
for (const [code, issues] of Object.entries(result.issuesByCode)) {
	console.log(`${CHECK_META[code].summary} (${issues.length})`);

	for (const issue of issues) {
		console.log(`  ${issue.locale} ${issue.key} — ${issue.message}`);
	}
}
```

## Regrouping a filtered subset

`issuesByCode` and `summary` describe the whole result. Filter the issues and the two helpers rebuild both:

```javascript
import { groupIssuesByCode, summarizeIssues } from 'chki18n';

const visible = result.issues.filter((issue) => issue.locale !== 'ja');

groupIssuesByCode(visible);
summarizeIssues(visible);
```

Useful behind a locale filter or a severity toggle, where the counts on screen have to match what is on screen.

## Grouping some other way

The issue carries enough to group by anything you like:

```javascript
// By locale
const byLocale = Object.groupBy(result.issues, (issue) => issue.locale);

// By key, to show every problem with one string at once
const byKey = Object.groupBy(result.issues, (issue) => `${issue.group}/${issue.key}`);

// By file, to annotate an editor
const byFile = Object.groupBy(result.issues, (issue) => issue.file ?? '');
```

## Building a result of your own

`buildResult` assembles one from a list of issues, deriving `success`, `issuesByCode` and `summary` so they cannot disagree with the issues they describe:

```javascript
import { buildResult, createIssue, resolveOptions } from 'chki18n';

const { options } = resolveOptions({ target: 'en' });

const result = buildResult([createIssue('NO_KEY', { locale: 'ko', key: 'a' })], options, {
	locales: ['en', 'ko'],
	groups: ['']
});
```

Worth reaching for when you are merging chki18n's findings with checks of your own and want one result to render.
