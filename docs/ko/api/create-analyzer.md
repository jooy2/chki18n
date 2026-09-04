---
title: createAnalyzer
---

# `createAnalyzer`

하나의 옵션 세트에 묶인 재사용 가능한 분석기를 반환합니다. `checkEntry`는 키 하나를 모든 로케일에 걸쳐 약 2마이크로초에 비교하는데, 값의 사본을 따로 들고 있지 않으면서 매 입력마다 검사해야 하는 편집기에 필요한 것이 정확히 이것입니다.

## 시그니처

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

## `analyzeTranslations`를 그냥 부르면 안 되나

옵션과 활성화된 검사 집합, 보간 구분자는 분석기를 만들 때 한 번만 해석됩니다. [`analyzeTranslations`](./analyze-translations)를 반복 호출하면 매번 전부 다시 해석합니다. 한 번 검사할 때는 차이가 없지만, 매 입력마다 도는 검사에서는 그것이 비용의 전부입니다.

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

`values`는 `로케일 -> 값` 형태입니다. 기준 언어의 값도 같은 객체에서 읽으므로, 비교가 이루어지려면 그 안에 있어야 합니다.

### 엔트리

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

`group`은 모든 이슈에 그대로 실리므로, 번역 파일이 여러 개인 프로젝트에서 구분할 수 있습니다.

### 값이 아예 없는 로케일 보고하기

기본적으로 로케일 목록은 `values`의 키이므로, 아예 없는 언어는 비교되지 않습니다. 값이 없다는 사실 자체를 보고해야 한다면 `locales`를 전달하세요.

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

편집기의 그리드에는 보통 빈 칸까지 포함해 모든 언어의 셀이 있기 때문에 기본값이 반대로 되어 있습니다. 빈 셀은 `NO_KEY`가 아니라 `EMPTY_VALUE`입니다.

### 보고하지 않는 것

키 하나로 판단할 수 있는 검사만 수행합니다. `DUPLICATE_VALUE`는 로케일 전체를 한 번에 봐야 하므로 여기서는 절대 보고되지 않습니다. 그런 코드는 `CROSS_KEY_CHECK_CODES`에 있습니다.

그 외에는 같은 데이터에 대한 전체 분석과 정확히 일치합니다. 같은 코드, 같은 순서입니다.

## 편집기 그리드 검사하기

이 함수가 존재하는 이유인 형태입니다. 값은 애플리케이션이 소유하고, chki18n은 판정만 합니다.

::: lang js

```javascript
import { createAnalyzer } from 'chki18n/core';

// 프로젝트를 열 때 한 번.
const analyzer = createAnalyzer({
	target: project.primaryLocale,
	interpolationPrefix: project.interpolationPrefix,
	interpolationSuffix: project.interpolationSuffix
});

// 수정할 때마다, 바뀐 행 하나에 대해서만.
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

// 프로젝트를 열 때 한 번.
final analyzer = createAnalyzer(
  options: Chki18nOptions(
    target: project.primaryLocale,
    interpolationPrefix: project.interpolationPrefix,
    interpolationSuffix: project.interpolationSuffix,
  ),
);

// 수정할 때마다, 바뀐 행 하나에 대해서만.
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

# 프로젝트를 열 때 한 번.
analyzer = create_analyzer(
    Options(
        target=project.primary_locale,
        interpolation_prefix=project.interpolation_prefix,
        interpolation_suffix=project.interpolation_suffix,
    )
)


# 수정할 때마다, 바뀐 행 하나에 대해서만.
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

chki18n 안에 데이터 사본이 남지 않으므로 맞춰줄 것도 없습니다. 애플리케이션이 이미 소유자일 때 [세션](./load-translations)보다 이쪽을 택하는 이유입니다.

## `analyze`

[`analyzeTranslations`](./analyze-translations)가 수행하는 것과 같은 비교를, 이 분석기의 옵션으로 수행합니다.

::: lang js

```javascript
const analyzer = createAnalyzer({ target: 'en', flattened: true });

analyzer.analyze({ groups: everything }); // 전체가 바뀌었을 때 전체 검사
analyzer.checkEntry({ key, values }); // 매 입력마다 키 하나
```

:::

::: lang dart

```dart
final analyzer = createAnalyzer(
  options: const Chki18nOptions(target: 'en', flattened: true),
);

analyzer.analyze(Chki18nInput(groups: everything)); // 전체가 바뀌었을 때 전체 검사
analyzer.checkEntry(Chki18nEntry(key: key, values: values)); // 매 입력마다 키 하나
```

:::

::: lang py

```python
analyzer = create_analyzer(Options(target="en", flattened=True))

analyzer.analyze(Input(groups=everything))  # 전체가 바뀌었을 때 전체 검사
analyzer.check_entry(Entry(key=key, values=values))  # 매 입력마다 키 하나
```

:::

열 때 전체 분석하고 수정할 때마다 `checkEntry`를 부르는 것이 일반적인 조합입니다.

## `options`와 `optionIssues`

::: lang js

```javascript
analyzer.options; // 해석된 옵션 — target, enabledChecks, 구분자 등
analyzer.optionIssues; // 전달한 값 중 사용할 수 없었던 것, INVALID_OPTIONS로
```

:::

::: lang dart

```dart
analyzer.options; // 해석된 옵션 — target, enabledChecks, 구분자 등
analyzer.optionIssues; // 전달한 값 중 사용할 수 없었던 것, INVALID_OPTIONS로
```

:::

::: lang py

```python
analyzer.options  # 해석된 옵션 — target, enabled_checks, 구분자 등
analyzer.option_issues  # 전달한 값 중 사용할 수 없었던 것, INVALID_OPTIONS로
```

:::

<Lang js="optionIssues" dart="optionIssues" py="option_issues" code />는 `analyze`가 만드는 모든 결과에 다시 실리므로, 옵션의 오타가 조용히 사라지지 않고 결과마다 한 번씩 보고됩니다.

## 성능

::: lang js

로케일 5개에 걸친 키 5,000개 기준입니다.

| 호출                      | 비용     |
| ------------------------- | -------- |
| `analyze` (평탄화된 입력) | 약 17ms  |
| `checkEntry`              | 약 2.2µs |
| `session.checkKey`        | 약 0.9µs |

`checkKey`가 더 빠른 이유는 [세션](./load-translations)이 값 집합을 전달받는 대신 직접 만들기 때문입니다. 어느 쪽이든 한 프레임 예산에 한참 못 미칩니다.

:::

::: lang dart py

키 하나를 비교하는 데 마이크로초 단위가 들며, 한 프레임 예산에 한참 못 미칩니다. 매 입력마다 검사하라고 있는 호출입니다. 전체 `analyze`는 키 수와 로케일 수의 곱에 비례하며, 파일 감시자에서 돌려도 될 만큼 빠릅니다.

:::
