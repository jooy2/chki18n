---
title: createAnalyzer
---

# `createAnalyzer`

Returns a reusable analyzer bound to one set of options. Its `checkEntry` compares a single key across locales in about two microseconds, which is what an editor needs to validate on every keystroke without holding a second copy of the values.

## Signature

::: lang js

```typescript
function createAnalyzer(options?: Chki18nOptions): Chki18nAnalyzer;

interface Chki18nAnalyzer {
	readonly options: Chki18nResolvedOptions;
	readonly optionIssues: Chki18nIssue[];
	analyze: (input: Chki18nInput) => Chki18nResult;
	checkEntry: (entry: Chki18nEntry) => Chki18nIssue[];
}
```

:::

::: lang dart

```dart
Chki18nAnalyzer createAnalyzer({Chki18nOptions? options});

class Chki18nAnalyzer {
  final Chki18nResolvedOptions options;
  final List<Chki18nIssue> optionIssues;

  Chki18nResult analyze(Chki18nInput input);
  List<Chki18nIssue> checkEntry(Chki18nEntry entry);
}
```

:::

::: lang py

```python
def create_analyzer(options: Options | None = None) -> Analyzer: ...


class Analyzer:
    options: ResolvedOptions
    option_issues: list[Issue]

    def analyze(self, data: Input) -> Result: ...
    def check_entry(self, entry: Entry) -> list[Issue]: ...
```

:::

## Why not just call `analyzeTranslations`

Options, the enabled check set and the interpolation delimiters are resolved once, when the analyzer is built. Calling [`analyzeTranslations`](./analyze-translations) in a loop re-resolves all of it on every call. For one check it makes no difference; for a check that runs on every keystroke it is the whole cost.

## `checkEntry`

::: lang js

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

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

final analyzer = createAnalyzer(options: const Chki18nOptions(target: 'en'));

analyzer.checkEntry(
  const Chki18nEntry(
    key: 'desc.hello',
    values: {'en': 'Hello {name}', 'ko': '안녕하세요'},
  ),
);
// [
//   Chki18nIssue(
//     code: Chki18nCheckCode.noInterpolationKey,
//     level: Chki18nLevel.error,
//     locale: 'ko',
//     key: 'desc.hello',
//     interpolation: 'name',
//     message: 'The interpolation key `{name}` of the target language is missing from this value.',
//   ),
// ]

analyzer.checkEntry(
  const Chki18nEntry(
    key: 'desc.hello',
    values: {'en': 'Hello {name}', 'ko': '{name}님 안녕하세요'},
  ),
);
// []
```

:::

::: lang py

```python
from chki18n import Entry, Options, create_analyzer

analyzer = create_analyzer(Options(target="en"))

analyzer.check_entry(Entry(key="desc.hello", values={"en": "Hello {name}", "ko": "안녕하세요"}))
# [
#     Issue(
#         code="NO_INTERPOLATION_KEY",
#         level="error",
#         locale="ko",
#         key="desc.hello",
#         interpolation="name",
#         message="The interpolation key `{name}` of the target language is missing from this value.",
#     )
# ]

analyzer.check_entry(
    Entry(key="desc.hello", values={"en": "Hello {name}", "ko": "{name}님 안녕하세요"})
)
# []
```

:::

`values` is `locale -> value`. The target language's value is read from the same object, so it has to be in there for a comparison to happen.

### Entry

::: lang js

```typescript
interface Chki18nEntry {
	key: string;
	values: { [locale: string]: any };
	group?: string;
	locales?: string[];
}
```

:::

::: lang dart

```dart
class Chki18nEntry {
  const Chki18nEntry({
    required String key,
    required Map<String, Object?> values,
    String? group,
    List<String>? locales,
  });
}
```

:::

::: lang py

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class Entry:
    key: str
    values: dict[str, Any]
    group: str = ""
    locales: Sequence[str] | None = None
```

:::

`group` is carried onto every issue, so a project with several translation files can tell them apart.

### Reporting a locale that has no value at all

By default the locales are the keys of `values`, so a language that is simply absent is not compared. Pass `locales` when a missing value has to be reported as missing:

::: lang js

```javascript
analyzer.checkEntry({ key: 'a', values: { en: 'Hello' }, locales: ['en', 'ko'] });
// [{ code: 'NO_KEY', locale: 'ko', … }]
```

:::

::: lang dart

```dart
analyzer.checkEntry(
  const Chki18nEntry(key: 'a', values: {'en': 'Hello'}, locales: ['en', 'ko']),
);
// [Chki18nIssue(code: NO_KEY, locale: ko, …)]
```

:::

::: lang py

```python
analyzer.check_entry(Entry(key="a", values={"en": "Hello"}, locales=["en", "ko"]))
# [Issue(code='NO_KEY', locale='ko', …)]
```

:::

An editor's grid usually has a cell for every language, empty ones included, which is why the default is the other way round: an empty cell is an `EMPTY_VALUE`, not a `NO_KEY`.

### What it will not report

Only checks that can be decided from one key. `DUPLICATE_VALUE` needs to see a whole locale at once and is never reported here; the codes with that property are in `CROSS_KEY_CHECK_CODES`.

Everything else agrees exactly with a full analysis of the same data — same codes, same order.

## Linting an editor grid

The shape this exists for. Your application owns the values; chki18n only judges them:

::: lang js

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

:::

::: lang dart

```dart
import 'package:chki18n/core.dart';

// Once, when the project opens.
final analyzer = createAnalyzer(
  options: Chki18nOptions(
    target: project.primaryLocale,
    interpolationPrefix: project.interpolationPrefix,
    interpolationSuffix: project.interpolationSuffix,
  ),
);

// On every edit, for the one row that changed.
List<Chki18nIssue> lintRow(Row row) => analyzer.checkEntry(
  Chki18nEntry(
    key: row.key,
    values: {for (final cell in row.cells) cell.locale: cell.value},
    locales: project.locales,
    group: row.group,
  ),
);
```

:::

::: lang py

```python
from chki18n.core import Entry, Options, create_analyzer

# Once, when the project opens.
analyzer = create_analyzer(
    Options(
        target=project.primary_locale,
        interpolation_prefix=project.interpolation_prefix,
        interpolation_suffix=project.interpolation_suffix,
    )
)


# On every edit, for the one row that changed.
def lint_row(row):
    return analyzer.check_entry(
        Entry(
            key=row.key,
            values={cell.locale: cell.value for cell in row.cells},
            locales=project.locales,
            group=row.group,
        )
    )
```

:::

No copy of the data lives inside chki18n, so there is nothing to keep in step — which is the reason to prefer this over a [session](./load-translations) when your application is already the owner.

## `analyze`

The same comparison [`analyzeTranslations`](./analyze-translations) performs, on this analyzer's options:

::: lang js

```javascript
const analyzer = createAnalyzer({ target: 'en', flattened: true });

analyzer.analyze({ groups: everything }); // full pass, when the whole set changed
analyzer.checkEntry({ key, values }); // one key, on every keystroke
```

:::

::: lang dart

```dart
final analyzer = createAnalyzer(
  options: const Chki18nOptions(target: 'en', flattened: true),
);

analyzer.analyze(Chki18nInput(groups: everything)); // full pass, when the whole set changed
analyzer.checkEntry(Chki18nEntry(key: key, values: values)); // one key, on every keystroke
```

:::

::: lang py

```python
analyzer = create_analyzer(Options(target="en", flattened=True))

analyzer.analyze(Input(groups=everything))  # full pass, when the whole set changed
analyzer.check_entry(Entry(key=key, values=values))  # one key, on every keystroke
```

:::

Running a full analysis on open and `checkEntry` on each edit is the usual pairing.

## `options` and `optionIssues`

::: lang js

```javascript
analyzer.options; // the resolved options — target, enabledChecks, delimiters, …
analyzer.optionIssues; // anything unusable in what you passed, as INVALID_OPTIONS
```

:::

::: lang dart

```dart
analyzer.options; // the resolved options — target, enabledChecks, delimiters, …
analyzer.optionIssues; // anything unusable in what you passed, as INVALID_OPTIONS
```

:::

::: lang py

```python
analyzer.options  # the resolved options — target, enabled_checks, delimiters, …
analyzer.option_issues  # anything unusable in what you passed, as INVALID_OPTIONS
```

:::

<Lang js="optionIssues" dart="optionIssues" py="option_issues" code /> is replayed into every result `analyze` produces, so a typo in an option is reported once per result rather than swallowed.

## Performance

::: lang js

Measured on 5,000 keys across 5 locales:

| Call                        | Cost   |
| --------------------------- | ------ |
| `analyze` (flattened input) | ~17ms  |
| `checkEntry`                | ~2.2µs |
| `session.checkKey`          | ~0.9µs |

`checkKey` is faster because the [session](./load-translations) builds the value set itself rather than being handed one. Either is far below a frame budget.

:::

::: lang dart py

A single key is compared in microseconds, which is far below a frame budget — checking on every keystroke is what this call is for. A full `analyze` is proportional to the number of keys times the number of locales, and is fast enough to run on a file watcher.

:::
