---
title: loadTranslations
---

# `loadTranslations`

Reads a directory once and hands back a session that holds the parsed translations. Every later call — a full analysis, a single key, an edit — works on what is already in memory, so checking the same folder repeatedly costs one scan rather than one per check.

## Signature

::: lang js

```typescript
function loadTranslations(path?: string, options?: Chki18nOptions): Promise<Chki18nFileSession>;
```

:::

::: lang dart

```dart
Future<Chki18nFileSession> loadTranslations({String? path, Chki18nOptions? options});
```

:::

::: lang py

```python
def load_translations(
    path: str | None = None,
    options: Options | None = None,
) -> FileSession: ...
```

:::

## Usage

::: lang js

```javascript
import { loadTranslations } from 'chki18n';

const session = await loadTranslations('./locales', { target: 'en' });

session.locales; // ['en', 'ko']
session.groups; // ['']
session.fileFormat; // 'single'
session.keys(); // ['desc.hello', 'desc.bye', …] — target language order

session.analyze(); // the full result, without reading a file

session.get('ko', 'desc.hello'); // '안녕하세요'
session.checkKey('desc.hello'); // [{ code: 'NO_INTERPOLATION_KEY', … }]

session.set('ko', 'desc.hello', '{name}님 안녕하세요'); // → [] — that key is now clean
session.analyze(); // one fewer error

await session.reload(); // throw the edits away and read the directory again
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

final session = await loadTranslations(
  path: './locales',
  options: const Chki18nOptions(target: 'en'),
);

session.locales; // ['en', 'ko']
session.groups; // ['']
session.fileFormat; // Chki18nFileFormat.single
session.keys(); // ['desc.hello', 'desc.bye', …] — target language order

session.analyze(); // the full result, without reading a file

session.get('ko', 'desc.hello'); // '안녕하세요'
session.checkKey('desc.hello'); // [Chki18nIssue(code: NO_INTERPOLATION_KEY, …)]

session.set('ko', 'desc.hello', '{name}님 안녕하세요'); // [] — that key is now clean
session.analyze(); // one fewer error

await session.reload(); // throw the edits away and read the directory again
```

:::

::: lang py

```python
from chki18n import Options, load_translations

session = load_translations("./locales", Options(target="en"))

session.locales  # ['en', 'ko']
session.groups  # ['']
session.file_format  # 'single'
session.keys()  # ['desc.hello', 'desc.bye', …] — target language order

session.analyze()  # the full result, without reading a file

session.get("ko", "desc.hello")  # '안녕하세요'
session.check_key("desc.hello")  # [Issue(code='NO_INTERPOLATION_KEY', …)]

session.set("ko", "desc.hello", "{name}님 안녕하세요")  # [] — that key is now clean
session.analyze()  # one fewer error

session.reload()  # throw the edits away and read the directory again
```

:::

## Reading

### `analyze()`

Checks everything the session holds and returns a [result](/reference/result), identical in shape to what [`checkTranslationFiles`](./check-translation-files) returns. Reads no files, so calling it after every edit is cheap.

### `keys(group?)`

Every key of a group, target language first so a report follows its order.

### `get(locale, key, group?)`

One value, or <Lang js="undefined" dart="null" py="None" code /> when that locale does not define the key. Keys are flat: `'desc.hello'`, not `['desc', 'hello']`.

### `translations(group?)`

The flattened translations of a group, keyed by locale. These are the session's own objects — read them freely, but write through `set` and `remove` so the session's own bookkeeping stays right.

::: lang js

```javascript
session.translations(); // { en: { 'desc.hello': 'Hello {name}' }, ko: { … } }
```

:::

::: lang dart

```dart
session.translations(); // {'en': {'desc.hello': 'Hello {name}'}, 'ko': {…}}
```

:::

::: lang py

```python
session.translations()  # {'en': {'desc.hello': 'Hello {name}'}, 'ko': {…}}
```

:::

### Properties

::: lang js

```javascript
session.options; // the resolved options every check runs with
session.locales; // every locale held
session.groups; // every group held, in scan order
session.files; // the files they were read from
session.fileFormat; // 'single' | 'folder' | 'nested'
session.path; // the absolute path that was scanned
session.skipped; // files read but not belonging to any locale
session.detectedInterpolation; // { prefix: '{{', suffix: '}}' } — what the files look like
```

:::

::: lang dart

```dart
session.options; // the resolved options every check runs with
session.locales; // every locale held
session.groups; // every group held, in scan order
session.files; // the files they were read from
session.fileFormat; // Chki18nFileFormat.single, .folder or .nested
session.path; // the absolute path that was scanned
session.skipped; // files read but not belonging to any locale
session.detectedInterpolation; // Chki18nDelimiters('{{', '}}') — what the files look like
```

:::

::: lang py

```python
session.options  # the resolved options every check runs with
session.locales  # every locale held
session.groups  # every group held, in scan order
session.files  # the files they were read from
session.file_format  # 'single' | 'folder' | 'nested'
session.path  # the absolute path that was scanned
session.skipped  # files read but not belonging to any locale
session.detected_interpolation  # Delimiters('{{', '}}') — what the files look like
```

:::

<Lang js="detectedInterpolation" dart="detectedInterpolation" py="detected_interpolation" code /> is a guess offered to whoever is setting a project up, read off the raw text of the files the scan accepted. It is <Lang js="null" dart="null" py="None" code /> when none of them holds anything that looks like a placeholder, and it never changes what the run itself compared — that is `interpolationPrefix`, which the checks used whatever the files turned out to look like.

## Writing

### `set(locale, key, value, group?)`

Writes a value **and returns the issues that key now has**, so an edit and its verdict are one call:

::: lang js

```javascript
session.set('ko', 'desc.hello', '안녕하세요');
// [{ code: 'NO_INTERPOLATION_KEY', level: 'error', … }] — {name} is missing

session.set('ko', 'desc.hello', '{name}님 안녕하세요');
// [] — clean
```

:::

::: lang dart

```dart
session.set('ko', 'desc.hello', '안녕하세요');
// [Chki18nIssue(code: NO_INTERPOLATION_KEY, level: error, …)] — {name} is missing

session.set('ko', 'desc.hello', '{name}님 안녕하세요');
// [] — clean
```

:::

::: lang py

```python
session.set("ko", "desc.hello", "안녕하세요")
# [Issue(code='NO_INTERPOLATION_KEY', level='error', …)] — {name} is missing

session.set("ko", "desc.hello", "{name}님 안녕하세요")
# [] — clean
```

:::

A locale that was not there before is added, which is how a new language starts.

### `remove(key, { locale, group })`

Drops a key from one locale, or from every locale when no `locale` is given, and re-checks it:

::: lang js

```javascript
session.remove('attr.folder', { locale: 'ko' }); // → [{ code: 'NO_KEY', … }]
session.remove('attr.folder'); // gone everywhere → []
```

:::

::: lang dart

```dart
session.remove('attr.folder', locale: 'ko'); // [Chki18nIssue(code: NO_KEY, …)]
session.remove('attr.folder'); // gone everywhere -> []
```

:::

::: lang py

```python
session.remove("attr.folder", locale="ko")  # [Issue(code='NO_KEY', …)]
session.remove("attr.folder")  # gone everywhere -> []
```

:::

### `checkKey(key, group?)`

Checks one key across every locale. About **1µs**, so it is fine to call on every keystroke.

Cross-key checks are not reported here — `DUPLICATE_VALUE` needs to see a whole locale at once, and one key is not enough to answer it. The codes with that property are in `CROSS_KEY_CHECK_CODES`.

### `reset(input)`

Replaces the translations while keeping the options and the analyzer. `reload()` is this, with a fresh scan of the same directory.

### `reload()`

Reads the directory again, throwing away every edit made through `set` and `remove`.

## Groups

A project with several translation files has several groups. Name one when you mean it, or leave it out — with one group there is nothing to decide, and with several the session looks the key up where it actually lives:

::: lang js

```javascript
session.groups; // ['common.json', 'errors.json']

session.get('en', 'failed'); // found in errors.json
session.checkKey('failed')[0].group; // 'errors.json'

session.set('ko', 'failed', '실패', 'errors.json'); // named explicitly
```

:::

::: lang dart

```dart
session.groups; // ['common.json', 'errors.json']

session.get('en', 'failed'); // found in errors.json
session.checkKey('failed').first.group; // 'errors.json'

session.set('ko', 'failed', '실패', 'errors.json'); // named explicitly
```

:::

::: lang py

```python
session.groups  # ['common.json', 'errors.json']

session.get("en", "failed")  # found in errors.json
session.check_key("failed")[0].group  # 'errors.json'

session.set("ko", "failed", "실패", "errors.json")  # named explicitly
```

:::

You only have to name a group when adding a key that does not exist yet — there is nowhere to look it up.

## Translations you already hold

<Lang js="createSession" dart="createSession" py="create_session" code /> is the same thing without the directory, and is exported from [the core entry point](./core) as well:

::: lang js

```javascript
import { createSession } from 'chki18n/core';

const session = createSession({ groups: { 'common.json': { en, ko } } }, { target: 'en' });

session.reset({ groups: nextGroups }); // swap the data, keep the options
```

:::

::: lang dart

```dart
import 'package:chki18n/core.dart';

final session = createSession(
  Chki18nInput(groups: {'common.json': {'en': en, 'ko': ko}}),
  options: const Chki18nOptions(target: 'en'),
);

session.reset(Chki18nInput(groups: nextGroups)); // swap the data, keep the options
```

:::

::: lang py

```python
from chki18n.core import Input, Options, create_session

session = create_session(
    Input(groups={"common.json": {"en": en, "ko": ko}}), Options(target="en")
)

session.reset(Input(groups=next_groups))  # swap the data, keep the options
```

:::

It has everything above except `path`, `skipped` and `reload`, which only mean something for a directory.

## A session owns its copy

Worth deciding deliberately. The session holds its own copy of every string. If your application is _also_ holding them — a translation editor bound to what a user is typing — then two copies exist and every edit has to reach both, which is a bug waiting to happen.

In that case use [`createAnalyzer().checkEntry`](./create-analyzer): you pass the values on each call, your application stays the single source of truth, and the check still costs a couple of microseconds.

## Errors

A missing path or an unreadable directory does not raise. The session comes back empty and carries the problem, which surfaces on the first `analyze()`:

::: lang js

```javascript
const session = await loadTranslations('./does-not-exist');

session.analyze().success; // false
session.analyze().issuesByCode.INVALID_FILE; // the reason
```

:::

::: lang dart

```dart
final session = await loadTranslations(path: './does-not-exist');

session.analyze().success; // false
session.analyze().of(Chki18nCheckCode.invalidFile); // the reason
```

:::

::: lang py

```python
session = load_translations("./does-not-exist")

session.analyze().success  # False
session.analyze().of("INVALID_FILE")  # the reason
```

:::
