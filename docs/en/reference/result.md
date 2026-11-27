---
title: The result object
---

# The result object

Every entry point returns the same result, whether the translations came from a directory, from memory or from a session. It carries every issue found, the same issues grouped by check code, and counts by level, code, locale and group, so a dashboard or a build script never has to derive any of it.

## The result

::: lang js

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

:::

::: lang dart

```dart
class Chki18nResult {
  final bool success;
  final List<Chki18nIssue> issues;
  final Map<Chki18nCheckCode, List<Chki18nIssue>> issuesByCode;
  final Chki18nSummary summary;
  final String target;
  final List<String> locales;
  final List<String> groups;
  final int keyCount;
  final List<Chki18nSourceFile> files;
  final Chki18nFileFormat? fileFormat;
  final int elapsedMs;

  List<Chki18nIssue> of(Chki18nCheckCode code);
  Map<String, Object?> toJson();
}
```

:::

::: lang py

```python
@dataclass(slots=True)
class Result:
    success: bool
    issues: list[Issue]
    issues_by_code: dict[CheckCode, list[Issue]]
    summary: Summary
    target: str
    locales: list[str]
    groups: list[str]
    key_count: int
    files: list[SourceFile]
    file_format: FileFormat | None
    elapsed_ms: int

    def of(self, code: CheckCode) -> list[Issue]: ...
    def to_json(self) -> dict[str, Any]: ...
```

:::

::: lang rs

```rust
#[derive(Clone, Debug, PartialEq)]
pub struct CheckResult {
    pub success: bool,
    pub issues: Vec<Issue>,
    pub summary: Summary,
    pub target: String,
    pub locales: Vec<String>,
    pub groups: Vec<String>,
    pub key_count: usize,
    pub files: Vec<SourceFile>,
    pub file_format: Option<FileFormat>,
    pub elapsed_ms: u128,
}

impl CheckResult {
    pub fn issues_by_code(&self) -> IndexMap<CheckCode, Vec<&Issue>>;
    pub fn to_json(&self) -> serde_json::Value;
}
```

The grouping by code is a method rather than a field, worked out from `issues` each time it is called. `to_json()` gives the whole result in the shape the `json` reporter writes, with the field names in their JavaScript spelling: `keyCount`, `issuesByCode`, `elapsedMs`.

:::

| Field | Meaning |
| --- | --- |
| `success` | <Lang js="`false`" dart="`false`" py="`False`" rs="`false`" /> when at least one issue is at `error` level. Warnings never affect it. |
| `issues` | Every issue, in scan order: target language key order, locale by locale. |
| <Lang js="issuesByCode" dart="issuesByCode" py="issues_by_code" rs="issues_by_code()" code /> | The same issues grouped by check code, in the order the codes were first seen. |
| `summary` | Counts by level, code, locale and group. |
| `target` | The language everything was compared against. |
| `locales` | Every locale that took part. |
| `groups` | Every group name. <Lang js="`['']`" dart="`['']`" py="`[&quot;&quot;]`" rs="`[&quot;&quot;]`" /> for a single unnamed group. |
| <Lang js="keyCount" dart="keyCount" py="key_count" rs="key_count" code /> | Distinct keys compared, across every group. |
| `files` | The files that were read. Empty for in-memory input. |
| <Lang js="fileFormat" dart="fileFormat" py="file_format" rs="file_format" code /> | `single`, `folder`, `nested`, or <Lang js="`null`" dart="`null`" py="`None`" rs="`None`" /> for in-memory input. |
| <Lang js="elapsedMs" dart="elapsedMs" py="elapsed_ms" rs="elapsed_ms" code /> | How long the call took, scan included where there was one. |

<Lang js="`issues` and `issuesByCode`" dart="`issues` and `issuesByCode`" py="`issues` and `issues_by_code`" rs="`issues` and `issues_by_code()`" /> hold the same objects. Grouping by code does not copy an issue.

::: lang dart py

Reading one check out of the grouping is common enough to have its own method, so the empty case does not have to be written out every time:

:::

::: lang dart

```dart
result.of(Chki18nCheckCode.noKey); // issuesByCode[noKey] ?? const []
```

:::

::: lang py

```python
result.of("NO_KEY")  # issues_by_code.get("NO_KEY", [])
```

:::

::: lang rs

Rust has no `of`. Since `issues_by_code()` walks `issues` to build its map anyway, reading one check is a filter over `issues`:

```rust
use chki18n::CheckCode;

let missing: Vec<_> = result
    .issues
    .iter()
    .filter(|issue| issue.code == CheckCode::NoKey)
    .collect();
```

:::

## An issue

::: lang js

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

:::

::: lang dart

```dart
class Chki18nIssue {
  final Chki18nCheckCode code;
  final Chki18nLevel level;
  final String locale;
  final String key;
  final String group;
  final String? value;
  final String? targetValue;
  final String? interpolation;
  final String? relatedKey;
  final String? file;
  final String message;

  Chki18nIssue withLevel(Chki18nLevel level);
  Map<String, Object?> toJson();
}
```

:::

::: lang py

```python
@dataclass(frozen=True, slots=True)
class Issue:
    code: CheckCode
    level: Level
    message: str
    locale: str = ""
    key: str = ""
    group: str = ""
    value: str | None = None
    target_value: str | None = None
    interpolation: str | None = None
    related_key: str | None = None
    file: str | None = None

    def with_level(self, level: Level) -> Issue: ...
    def to_json(self) -> dict[str, Any]: ...
```

:::

::: lang rs

```rust
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Issue {
    pub code: CheckCode,
    pub level: Level,
    pub locale: String,
    pub key: String,
    pub group: String,
    pub value: Option<String>,
    pub target_value: Option<String>,
    pub interpolation: Option<String>,
    pub related_key: Option<String>,
    pub file: Option<String>,
    pub message: String,
}

impl Issue {
    pub fn to_json(&self) -> serde_json::Value;
}
```

`code` and `level` are the `CheckCode` and `Level` enums. `as_str()` gives the spelling the other packages and the JSON report use, such as `NO_KEY` and `error`. The fields are public, so there is no `with_level`: an issue's level is set by assigning to it.

:::

| Field | Meaning |
| --- | --- |
| `code` | Which check reported it. See [Checks](/guide/checks). |
| `level` | Its severity, after any [`levels`](/guide/options#levels) override. |
| `locale` | The locale the issue belongs to. Empty for issues that are not locale-bound. |
| `key` | The flattened key. Empty for file and option level issues. |
| `group` | The group the key belongs to. Empty when there is only one. |
| `value` | The value as found, where the check is about a value. |
| <Lang js="targetValue" dart="targetValue" py="target_value" rs="target_value" code /> | The target language's value, which is what it was compared against. |
| `interpolation` | The placeholder that triggered an interpolation issue. |
| <Lang js="relatedKey" dart="relatedKey" py="related_key" rs="related_key" code /> | The other key involved — for `DUPLICATE_VALUE`, the first key using that value. |
| `file` | Absolute path of the file the key came from, when it came from one. |
| `message` | A sentence describing this occurrence. |

::: lang js

Optional fields are **absent** rather than `undefined`, so `JSON.stringify` and a deep comparison both behave.

:::

::: lang dart py rs

An optional field with nothing in it is <Lang dart="`null`" py="`None`" rs="`None`" />, and <Lang dart="`toJson`" py="`to_json`" rs="`to_json`" code /> leaves it out instead of writing it as `null`. That is what keeps the `json` reporter's output identical across the four packages.

:::

## The summary

::: lang js

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

:::

::: lang dart

```dart
class Chki18nSummary {
  final int error;
  final int warn;
  final int info;
  final int total;
  final Map<Chki18nCheckCode, int> byCode;
  final Map<String, Chki18nLevelCount> byLocale;
  final Map<String, Chki18nLevelCount> byGroup;

  Chki18nLevelCount get levelCount;
}
```

:::

::: lang py

```python
@dataclass(slots=True)
class Summary:
    error: int
    warn: int
    info: int
    total: int
    by_code: dict[CheckCode, int]
    by_locale: dict[str, LevelCount]
    by_group: dict[str, LevelCount]

    @property
    def level_count(self) -> LevelCount: ...
```

:::

::: lang rs

```rust
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Summary {
    pub error: usize,
    pub warn: usize,
    pub info: usize,
    pub total: usize,
    pub by_code: IndexMap<CheckCode, usize>,
    pub by_locale: IndexMap<String, LevelCount>,
    pub by_group: IndexMap<String, LevelCount>,
}
```

`Summary` and `LevelCount` are in `chki18n::types`, and `LevelCount::of(level)` reads the count of one level. The maps are `indexmap::IndexMap`, which keeps the order the codes, locales and groups were first met in. chki18n does not re-export the crate, so naming the type in your own code needs `indexmap` among your dependencies.

:::

Computed in one pass over the issues:

::: lang js

```javascript
result.summary;
// {
//   error: 2, warn: 7, info: 1, total: 10,
//   byCode: { NO_KEY: 1, EMPTY_VALUE: 1, NOT_TRANSLATED_VALUE: 1, … },
//   byLocale: { ko: { error: 2, warn: 7, info: 0 } },
//   byGroup: { '': { error: 2, warn: 7, info: 1 } }
// }
```

:::

::: lang dart

```dart
result.summary;
// error: 2, warn: 7, info: 1, total: 10
// byCode: {NO_KEY: 1, EMPTY_VALUE: 1, NOT_TRANSLATED_VALUE: 1, …}
// byLocale: {ko: Chki18nLevelCount(error: 2, warn: 7, info: 0)}
// byGroup: {: Chki18nLevelCount(error: 2, warn: 7, info: 1)}
```

:::

::: lang py

```python
result.summary
# error=2, warn=7, info=1, total=10
# by_code={"NO_KEY": 1, "EMPTY_VALUE": 1, "NOT_TRANSLATED_VALUE": 1, …}
# by_locale={"ko": LevelCount(error=2, warn=7, info=0)}
# by_group={"": LevelCount(error=2, warn=7, info=1)}
```

:::

::: lang rs

```rust
result.summary;
// Summary {
//     error: 2, warn: 7, info: 1, total: 10,
//     by_code: {NoKey: 1, EmptyValue: 1, NotTranslatedValue: 1, …},
//     by_locale: {"ko": LevelCount { error: 2, warn: 7, info: 0 }},
//     by_group: {"": LevelCount { error: 2, warn: 7, info: 1 }},
// }
```

:::

<Lang js="byLocale" dart="byLocale" py="by_locale" rs="by_locale" code /> only counts issues that belong to a locale; an option or file level issue lands in <Lang js="byGroup" dart="byGroup" py="by_group" rs="by_group" code /> but not in <Lang js="byLocale" dart="byLocale" py="by_locale" rs="by_locale" code />.

## Rendering a result

Every issue carries its own `message`, and the check metadata describes each check, so a user interface never has to hard-code a string:

::: lang js

```javascript
import { CHECK_META } from 'chki18n';

CHECK_META.NO_KEY;
// {
//   level: 'error',
//   summary: 'Some translation files did not include the following keys',
//   description: 'The key exists in the target language but is missing here.'
// }
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

checkMeta[Chki18nCheckCode.noKey];
// Chki18nCheckMeta(
//   level: Chki18nLevel.error,
//   summary: 'Some translation files did not include the following keys',
//   description: 'The key exists in the target language but is missing here.',
// )
```

:::

::: lang py

```python
from chki18n import CHECK_META

CHECK_META["NO_KEY"]
# CheckMeta(
#     level="error",
#     summary="Some translation files did not include the following keys",
#     description="The key exists in the target language but is missing here.",
# )
```

:::

::: lang rs

```rust
use chki18n::CheckCode;

CheckCode::NoKey.meta();
// CheckMeta {
//     level: Error,
//     summary: "Some translation files did not include the following keys",
//     description: "The key exists in the target language but is missing here.",
// }
```

:::

`summary` heads a list of occurrences and `description` describes one. An issue's own `message` is the description unless the check produced something more specific, as `NO_INTERPOLATION_KEY` does when it names the placeholder.

A minimal report:

::: lang js

```javascript
for (const [code, issues] of Object.entries(result.issuesByCode)) {
	console.log(`${CHECK_META[code].summary} (${issues.length})`);

	for (const issue of issues) {
		console.log(`  ${issue.locale} ${issue.key} — ${issue.message}`);
	}
}
```

:::

::: lang dart

```dart
for (final entry in result.issuesByCode.entries) {
  print('${checkMeta[entry.key]!.summary} (${entry.value.length})');

  for (final issue in entry.value) {
    print('  ${issue.locale} ${issue.key} — ${issue.message}');
  }
}
```

:::

::: lang py

```python
for code, issues in result.issues_by_code.items():
    print(f"{CHECK_META[code].summary} ({len(issues)})")

    for issue in issues:
        print(f"  {issue.locale} {issue.key} — {issue.message}")
```

:::

::: lang rs

```rust
for (code, issues) in result.issues_by_code() {
    println!("{} ({})", code.meta().summary, issues.len());

    for issue in issues {
        println!("  {} {} — {}", issue.locale, issue.key, issue.message);
    }
}
```

:::

## Regrouping a filtered subset

<Lang js="`issuesByCode` and `summary`" dart="`issuesByCode` and `summary`" py="`issues_by_code` and `summary`" rs="`issues_by_code()` and `summary`" /> describe the whole result. Filter the issues and rebuild both from what is left:

::: lang js

```javascript
import { groupIssuesByCode, summarizeIssues } from 'chki18n';

const visible = result.issues.filter((issue) => issue.locale !== 'ja');

groupIssuesByCode(visible);
summarizeIssues(visible);
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

final visible = result.issues.where((issue) => issue.locale != 'ja').toList();

groupIssuesByCode(visible);
summarizeIssues(visible);
```

:::

::: lang py

```python
from chki18n import group_issues_by_code, summarize_issues

visible = [issue for issue in result.issues if issue.locale != "ja"]

group_issues_by_code(visible)
summarize_issues(visible)
```

:::

::: lang rs

Rust has `summarize_issues` in `chki18n::core::issue` for the counts alone, and no function for the grouping, which is a method of a result. To rebuild both, make a result of the filtered issues with [`build_result`](#building-a-result-of-your-own) and the options the run was resolved with:

```rust
use chki18n::core::result::{build_result, ResultFacts};

let visible: Vec<_> = result
    .issues
    .iter()
    .filter(|issue| issue.locale != "ja")
    .cloned()
    .collect();
let filtered = build_result(visible, &options, ResultFacts::default());

filtered.issues_by_code();
filtered.summary;
```

:::

Useful behind a locale filter or a severity toggle, where the counts on screen have to match what is on screen.

## Grouping some other way

The issue carries enough to group by anything you like:

::: lang js

```javascript
// By locale
const byLocale = Object.groupBy(result.issues, (issue) => issue.locale);

// By key, to show every problem with one string at once
const byKey = Object.groupBy(result.issues, (issue) => `${issue.group}/${issue.key}`);

// By file, to annotate an editor
const byFile = Object.groupBy(result.issues, (issue) => issue.file ?? '');
```

:::

::: lang dart

```dart
Map<String, List<Chki18nIssue>> groupBy(
  List<Chki18nIssue> issues,
  String Function(Chki18nIssue issue) keyOf,
) {
  final grouped = <String, List<Chki18nIssue>>{};

  for (final issue in issues) {
    grouped.putIfAbsent(keyOf(issue), () => []).add(issue);
  }

  return grouped;
}

// By locale
final byLocale = groupBy(result.issues, (issue) => issue.locale);

// By key, to show every problem with one string at once
final byKey = groupBy(result.issues, (issue) => '${issue.group}/${issue.key}');

// By file, to annotate an editor
final byFile = groupBy(result.issues, (issue) => issue.file ?? '');
```

:::

::: lang py

```python
from collections import defaultdict


def group_by(issues, key_of):
    grouped = defaultdict(list)

    for issue in issues:
        grouped[key_of(issue)].append(issue)

    return grouped


# By locale
by_locale = group_by(result.issues, lambda issue: issue.locale)

# By key, to show every problem with one string at once
by_key = group_by(result.issues, lambda issue: f"{issue.group}/{issue.key}")

# By file, to annotate an editor
by_file = group_by(result.issues, lambda issue: issue.file or "")
```

:::

::: lang rs

```rust
use std::collections::BTreeMap;

use chki18n::Issue;

fn group_by<'a>(
    issues: &'a [Issue],
    key_of: impl Fn(&Issue) -> String,
) -> BTreeMap<String, Vec<&'a Issue>> {
    let mut grouped: BTreeMap<String, Vec<&Issue>> = BTreeMap::new();

    for issue in issues {
        grouped.entry(key_of(issue)).or_default().push(issue);
    }

    grouped
}

// By locale
let by_locale = group_by(&result.issues, |issue| issue.locale.clone());

// By key, to show every problem with one string at once
let by_key = group_by(&result.issues, |issue| {
    format!("{}/{}", issue.group, issue.key)
});

// By file, to annotate an editor
let by_file = group_by(&result.issues, |issue| {
    issue.file.clone().unwrap_or_default()
});
```

:::

## Building a result of your own

<Lang js="buildResult" dart="buildResult" py="build_result" rs="build_result" code /> assembles one from a list of issues, deriving `success`, the grouping and the summary so they cannot disagree with the issues they describe:

::: lang js

```javascript
import { buildResult, createIssue, resolveOptions } from 'chki18n';

const { options } = resolveOptions({ target: 'en' });

const result = buildResult([createIssue('NO_KEY', { locale: 'ko', key: 'a' })], options, {
	locales: ['en', 'ko'],
	groups: ['']
});
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

final options = resolveOptions(const Chki18nOptions(target: 'en')).options;

final result = buildResult(
  [createIssue(Chki18nCheckCode.noKey, locale: 'ko', key: 'a')],
  options,
  locales: ['en', 'ko'],
  groups: [''],
);
```

:::

::: lang py

```python
from chki18n import Options, build_result, create_issue, resolve_options

options, _ = resolve_options(Options(target="en"))

result = build_result(
    [create_issue("NO_KEY", locale="ko", key="a")],
    options,
    locales=["en", "ko"],
    groups=[""],
)
```

:::

::: lang rs

```rust
use chki18n::core::issue::{create_issue, IssueInit};
use chki18n::core::result::{build_result, ResultFacts};
use chki18n::{resolve_options, CheckCode, Options};

let (options, _) = resolve_options(&Options {
    target: Some("en".into()),
    ..Options::default()
});

let result = build_result(
    vec![create_issue(
        CheckCode::NoKey,
        IssueInit {
            locale: Some("ko".into()),
            key: Some("a".into()),
            ..IssueInit::default()
        },
    )],
    &options,
    ResultFacts {
        locales: vec!["en".into(), "ko".into()],
        groups: vec!["".into()],
        ..ResultFacts::default()
    },
);
```

:::

Worth reaching for when you are merging chki18n's findings with checks of your own and want one result to render.
