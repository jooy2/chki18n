---
title: loadTranslations
---

# `loadTranslations`

Reads a directory once and hands back a session that holds the parsed translations. Every later call — a full analysis, a single key, an edit — works on what is already in memory, so checking the same folder repeatedly costs one scan rather than one per check.

## Signature

```typescript
function loadTranslations(path?: string, options?: Chki18nOptions): Promise<Chki18nFileSession>;
```

## Usage

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

## Reading

### `analyze()`

Checks everything the session holds and returns a [result](/reference/result), identical in shape to what [`checkTranslationFiles`](./check-translation-files) returns. Reads no files, so calling it after every edit is cheap.

### `keys(group?)`

Every key of a group, target language first so a report follows its order.

### `get(locale, key, group?)`

One value, or `undefined` when that locale does not define the key. Keys are flat: `'desc.hello'`, not `['desc', 'hello']`.

### `translations(group?)`

The flattened translations of a group, keyed by locale. These are the session's own objects — read them freely, but write through `set` and `remove` so the session's own bookkeeping stays right.

```javascript
session.translations(); // { en: { 'desc.hello': 'Hello {name}' }, ko: { … } }
```

### Properties

```javascript
session.options; // the resolved options every check runs with
session.locales; // every locale held
session.groups; // every group held, in scan order
session.files; // the files they were read from
session.fileFormat; // 'single' | 'folder' | 'nested'
session.path; // the absolute path that was scanned
session.skipped; // files read but not belonging to any locale
```

## Writing

### `set(locale, key, value, group?)`

Writes a value **and returns the issues that key now has**, so an edit and its verdict are one call:

```javascript
session.set('ko', 'desc.hello', '안녕하세요');
// [{ code: 'NO_INTERPOLATION_KEY', level: 'error', … }] — {name} is missing

session.set('ko', 'desc.hello', '{name}님 안녕하세요');
// [] — clean
```

A locale that was not there before is added, which is how a new language starts.

### `remove(key, { locale, group })`

Drops a key from one locale, or from every locale when no `locale` is given, and re-checks it:

```javascript
session.remove('attr.folder', { locale: 'ko' }); // → [{ code: 'NO_KEY', … }]
session.remove('attr.folder'); // gone everywhere → []
```

### `checkKey(key, group?)`

Checks one key across every locale. About **1µs**, so it is fine to call on every keystroke.

Cross-key checks are not reported here — `DUPLICATE_VALUE` needs to see a whole locale at once, and one key is not enough to answer it. The codes with that property are in `CROSS_KEY_CHECK_CODES`.

### `reset(input)`

Replaces the translations while keeping the options and the analyzer. `reload()` is this, with a fresh scan of the same directory.

### `reload()`

Reads the directory again, throwing away every edit made through `set` and `remove`.

## Groups

A project with several translation files has several groups. Name one when you mean it, or leave it out — with one group there is nothing to decide, and with several the session looks the key up where it actually lives:

```javascript
session.groups; // ['common.json', 'errors.json']

session.get('en', 'failed'); // found in errors.json
session.checkKey('failed')[0].group; // 'errors.json'

session.set('ko', 'failed', '실패', 'errors.json'); // named explicitly
```

You only have to name a group when adding a key that does not exist yet — there is nowhere to look it up.

## Translations you already hold

`createSession` is the same thing without the directory, and is exported from [`chki18n/core`](./core) as well:

```javascript
import { createSession } from 'chki18n/core';

const session = createSession({ groups: { 'common.json': { en, ko } } }, { target: 'en' });

session.reset({ groups: nextGroups }); // swap the data, keep the options
```

It has everything above except `path`, `skipped` and `reload`, which only mean something for a directory.

## A session owns its copy

Worth deciding deliberately. The session holds its own copy of every string. If your application is _also_ holding them — a translation editor bound to what a user is typing — then two copies exist and every edit has to reach both, which is a bug waiting to happen.

In that case use [`createAnalyzer().checkEntry`](./create-analyzer): you pass the values on each call, your application stays the single source of truth, and the check costs about the same.

## Errors

A missing path or an unreadable directory does not throw. The session comes back empty and carries the problem, which surfaces on the first `analyze()`:

```javascript
const session = await loadTranslations('./does-not-exist');

session.analyze().success; // false
session.analyze().issuesByCode.INVALID_FILE; // the reason
```
