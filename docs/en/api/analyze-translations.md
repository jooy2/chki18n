---
title: analyzeTranslations
---

# `analyzeTranslations`

Compares translations you already hold in memory. It does no file system work at all, so it runs anywhere the language does: in a browser, in a Flutter web build, in a worker, in a sandbox with no disk. Reach for it when something else has already read the files.

## Signature

::: lang js

```typescript
function analyzeTranslations(input: Chki18nInput, options?: Chki18nOptions): Chki18nResult;
```

Synchronous: there is nothing to await.

:::

::: lang dart

```dart
Chki18nResult analyzeTranslations(Chki18nInput input, {Chki18nOptions? options});
```

Synchronous: there is nothing to await.

:::

::: lang py

```python
def analyze_translations(data: Input, options: Options | None = None) -> Result: ...
```

:::

::: lang rs

```rust
pub fn analyze_translations(input: &Input, options: &Options) -> CheckResult
```

It only borrows the input and the options, so both stay yours to pass to another call.

:::

## Usage

Pass one set of locales:

::: lang js

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

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

final result = analyzeTranslations(
  const Chki18nInput(
    locales: {
      'en': {
        'desc': {'hello': 'Hello {name}', 'bye': 'Goodbye'},
      },
      'ko': {
        'desc': {'hello': '안녕하세요'},
      },
    },
  ),
  options: const Chki18nOptions(target: 'en'),
);

result.keyCount; // 2
result.of(Chki18nCheckCode.noKey).first.key; // 'desc.bye'
result.of(Chki18nCheckCode.noInterpolationKey).first.interpolation; // 'name'
```

:::

::: lang py

```python
from chki18n import Input, Options, analyze_translations

result = analyze_translations(
    Input(
        locales={
            "en": {"desc": {"hello": "Hello {name}", "bye": "Goodbye"}},
            "ko": {"desc": {"hello": "안녕하세요"}},
        }
    ),
    Options(target="en"),
)

result.key_count  # 2
result.of("NO_KEY")[0].key  # 'desc.bye'
result.of("NO_INTERPOLATION_KEY")[0].interpolation  # 'name'
```

:::

::: lang rs

```rust
use chki18n::{analyze_translations, CheckCode, Input, Options, TranslationMap};
use indexmap::IndexMap;
use serde_json::json;

let en = TranslationMap::from_iter([(
    "desc".into(),
    json!({ "hello": "Hello {name}", "bye": "Goodbye" }),
)]);
let ko = TranslationMap::from_iter([("desc".into(), json!({ "hello": "안녕하세요" }))]);

let result = analyze_translations(
    &Input {
        locales: Some(IndexMap::from([("en".into(), en), ("ko".into(), ko)])),
        ..Input::default()
    },
    &Options {
        target: Some("en".into()),
        ..Options::default()
    },
);
let by_code = result.issues_by_code();

result.key_count; // 2
by_code[&CheckCode::NoKey][0].key.as_str(); // "desc.bye"
by_code[&CheckCode::NoInterpolationKey][0]
    .interpolation
    .as_deref(); // Some("name")
```

`Input` is built from `indexmap` and `serde_json` types, and chki18n re-exports neither crate, so add both to your own project with `cargo add indexmap serde_json`. Keep to the major versions chki18n depends on, `indexmap` 2 and `serde_json` 1, so that the types are the same ones.

:::

Nested objects are flattened before comparison, so `desc.hello` is what every issue reports.

## Several translation files

Use `groups` when your project has more than one set of files, so each is compared on its own and a key missing from one is never reported against the other:

::: lang js

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

:::

::: lang dart

```dart
analyzeTranslations(
  const Chki18nInput(
    groups: {
      'common.json': {
        'en': {'ok': 'OK'},
        'ko': {'ok': '확인'},
      },
      'errors.json': {
        'en': {'failed': 'Failed'},
        'ko': <String, Object?>{},
      },
    },
  ),
  options: const Chki18nOptions(target: 'en'),
);
// the one NO_KEY issue carries group: 'errors.json'
```

:::

::: lang py

```python
analyze_translations(
    Input(
        groups={
            "common.json": {"en": {"ok": "OK"}, "ko": {"ok": "확인"}},
            "errors.json": {"en": {"failed": "Failed"}, "ko": {}},
        }
    ),
    Options(target="en"),
)
# the one NO_KEY issue carries group="errors.json"
```

:::

::: lang rs

```rust
use chki18n::{analyze_translations, Input, Options, TranslationMap};
use indexmap::IndexMap;

let strings = |key: &str, value: &str| TranslationMap::from_iter([(key.into(), value.into())]);

analyze_translations(
    &Input {
        groups: Some(IndexMap::from([
            (
                "common.json".into(),
                IndexMap::from([
                    ("en".into(), strings("ok", "OK")),
                    ("ko".into(), strings("ok", "확인")),
                ]),
            ),
            (
                "errors.json".into(),
                IndexMap::from([
                    ("en".into(), strings("failed", "Failed")),
                    ("ko".into(), TranslationMap::new()),
                ]),
            ),
        ])),
        ..Input::default()
    },
    &Options {
        target: Some("en".into()),
        ..Options::default()
    },
);
// the one NO_KEY issue carries group: "errors.json"
```

:::

`locales` is shorthand for a single group named `''`. See [File layouts](/guide/file-layouts#groups) for how a directory scan arrives at the same shape.

## Skipping the flatten pass

If your keys are already flat, say so and the objects you pass are used exactly as they are, with nothing copied and nothing rebuilt:

::: lang js

```javascript
const en = { 'desc.hello': 'Hello {name}' };
const ko = { 'desc.hello': '안녕하세요' };

analyzeTranslations({ locales: { en, ko } }, { target: 'en', flattened: true });
```

This is the fast path. Comparing 5,000 keys across 5 locales takes about **17ms** flattened, against about 22ms when the flatten pass runs.

:::

::: lang dart

```dart
const en = {'desc.hello': 'Hello {name}'};
const ko = {'desc.hello': '안녕하세요'};

analyzeTranslations(
  const Chki18nInput(locales: {'en': en, 'ko': ko}),
  options: const Chki18nOptions(target: 'en', flattened: true),
);
```

This is the fast path: the maps you pass are the ones the comparison reads.

:::

::: lang py

```python
en = {"desc.hello": "Hello {name}"}
ko = {"desc.hello": "안녕하세요"}

analyze_translations(Input(locales={"en": en, "ko": ko}), Options(target="en", flattened=True))
```

This is the fast path: the dictionaries you pass are the ones the comparison reads.

:::

::: lang rs

```rust
let en = TranslationMap::from_iter([("desc.hello".into(), "Hello {name}".into())]);
let ko = TranslationMap::from_iter([("desc.hello".into(), "안녕하세요".into())]);

analyze_translations(
    &Input {
        locales: Some(IndexMap::from([("en".into(), en), ("ko".into(), ko)])),
        ..Input::default()
    },
    &Options {
        target: Some("en".into()),
        flattened: Some(true),
        ..Options::default()
    },
);
```

This is the fast path: the comparison borrows the maps you pass and copies none of them.

:::

## Input

::: lang js

```typescript
interface Chki18nInput {
	groups?: { [group: string]: { [locale: string]: TranslationMap } };
	locales?: { [locale: string]: TranslationMap };
	files?: Chki18nSourceFile[];
	issues?: Chki18nIssue[];
	fileFormat?: Chki18nFileFormat;
	unusedKeys?: string[];
	undefinedKeys?: Chki18nKeyUsage[];
}
```

:::

::: lang dart

```dart
class Chki18nInput {
  const Chki18nInput({
    TranslationGroups? groups,
    Map<String, TranslationMap>? locales,
    List<Chki18nSourceFile>? files,
    List<Chki18nIssue>? issues,
    Chki18nFileFormat? fileFormat,
    List<String>? unusedKeys,
    List<Chki18nKeyUsage>? undefinedKeys,
  });
}
```

:::

::: lang py

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class Input:
    groups: TranslationGroups | None = None
    locales: dict[str, TranslationMap] | None = None
    files: list[SourceFile] = field(default_factory=list)
    issues: list[Issue] = field(default_factory=list)
    file_format: FileFormat | None = None
    unused_keys: list[str] = field(default_factory=list)
    undefined_keys: list[KeyUsage] = field(default_factory=list)
```

:::

::: lang rs

```rust
#[derive(Clone, Debug, Default)]
pub struct Input {
    pub groups: Option<TranslationGroups>,
    pub locales: Option<IndexMap<String, TranslationMap>>,
    pub files: Option<Vec<SourceFile>>,
    pub issues: Option<Vec<Issue>>,
    pub file_format: Option<FileFormat>,
    pub unused_keys: Option<Vec<String>>,
    pub undefined_keys: Option<Vec<KeyUsage>>,
}
```

Every field is an `Option`, so `..Input::default()` leaves out the ones you do not set. `TranslationMap` is `serde_json::Map<String, Value>`, and `TranslationGroups`, in `chki18n::types`, is `IndexMap<String, IndexMap<String, TranslationMap>>`. chki18n turns on the `preserve_order` feature of `serde_json`, so a `serde_json::Map` you build keeps its keys in the order they were inserted.

:::

`files` maps a group and locale onto the file it came from, so issues can carry a `file` path. `issues` lets whatever produced the input add its own problems to the same result, which is how a directory scan's unreadable-file errors end up in the same list as the comparison's findings. <Lang js="fileFormat" dart="fileFormat" py="file_format" rs="file_format" code /> is carried through to the result untouched, and the last two answer [`UNUSED_KEY`](/guide/checks#unused-key) and [`UNDEFINED_KEY`](/guide/checks#undefined-key) for an application that has already worked them out.

## What the result says

::: lang js

```javascript
result.files; // [] — nothing was read from disk
result.fileFormat; // null — unless you passed one in
result.locales; // every locale seen, across all groups
result.groups; // every group name, in input order
result.keyCount; // distinct keys compared
```

:::

::: lang dart

```dart
result.files; // [] — nothing was read from disk
result.fileFormat; // null — unless you passed one in
result.locales; // every locale seen, across all groups
result.groups; // every group name, in input order
result.keyCount; // distinct keys compared
```

:::

::: lang py

```python
result.files  # [] — nothing was read from disk
result.file_format  # None — unless you passed one in
result.locales  # every locale seen, across all groups
result.groups  # every group name, in input order
result.key_count  # distinct keys compared
```

:::

::: lang rs

```rust
result.files; // [] — nothing was read from disk
result.file_format; // None — unless you passed one in
result.locales; // every locale seen, across all groups
result.groups; // every group name, in input order
result.key_count; // distinct keys compared
```

:::

Everything else is the same shape [`checkTranslationFiles`](./check-translation-files) returns. See [The result object](/reference/result).

## A locale that is not an object

Reported as an issue rather than raised, like every other input problem:

::: lang js

```javascript
analyzeTranslations({ locales: { en: { a: 'A' }, ko: null } }, { target: 'en' });
// issuesByCode.INVALID_FILE — "The translations of `ko` are not an object."
```

:::

::: lang dart

Dart's type system settles this one before it runs. `Chki18nInput.locales` is a `Map<String, TranslationMap>`, so there is nothing to pass that is not a map of keys. A file on disk that holds something else is still reported as `INVALID_FILE` by the scanner.

:::

::: lang py

```python
analyze_translations(Input(locales={"en": {"a": "A"}, "ko": None}), Options(target="en"))
# result.of("INVALID_FILE") — "The translations of `ko` are not an object."
```

:::

::: lang rs

Rust's type system settles this one before it runs. The `locales` and `groups` of an `Input` hold `TranslationMap` values, which are `serde_json::Map`s, so there is nothing to pass that is not a map of keys. A file on disk that holds something else is still reported as `INVALID_FILE` by the scanner.

:::

## See also

- [`createAnalyzer`](./create-analyzer) — reuse one analyzer, and check a single key.
- [The core entry point](./core) — this function without the file system the scanner needs.
