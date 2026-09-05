---
title: analyzeTranslations
---

# `analyzeTranslations`

이미 메모리에 가지고 있는 번역 데이터를 비교합니다. 파일 시스템을 전혀 사용하지 않으므로 그 언어가 실행되는 곳이라면 어디서든 동작합니다. 브라우저, Flutter 웹 빌드, 워커, 디스크가 없는 샌드박스가 모두 해당합니다. 다른 무언가가 이미 파일을 읽어 둔 상황에서 쓰는 진입점입니다.

## 시그니처

::: lang js

```typescript
function analyzeTranslations(input: Chki18nInput, options?: Chki18nOptions): Chki18nResult;
```

동기 함수입니다. `await`할 것이 없습니다.

:::

::: lang dart

```dart
Chki18nResult analyzeTranslations(Chki18nInput input, {Chki18nOptions? options});
```

동기 함수입니다. `await`할 것이 없습니다.

:::

::: lang py

```python
def analyze_translations(data: Input, options: Options | None = None) -> Result: ...
```

:::

## 사용법

로케일 하나의 묶음을 전달합니다.

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

중첩 객체는 비교 전에 평탄화되므로, 모든 이슈는 `desc.hello` 형태로 키를 보고합니다.

## 번역 파일이 여러 개일 때

프로젝트에 파일 묶음이 둘 이상이면 `groups`를 쓰세요. 각각 따로 비교되므로 한쪽에 없는 키가 다른 쪽 문제로 보고되지 않습니다.

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
// 하나뿐인 NO_KEY 이슈가 group: 'errors.json'을 갖습니다
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
// 하나뿐인 NO_KEY 이슈가 group: 'errors.json'을 갖습니다
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
# 하나뿐인 NO_KEY 이슈가 group="errors.json"을 갖습니다
```

:::

`locales`는 이름이 `''`인 그룹 하나에 대한 축약형입니다. 디렉터리 검사가 어떻게 같은 형태에 도달하는지는 [파일 구조](/ko/guide/file-layouts#그룹)를 참고하세요.

## 평탄화 건너뛰기

키가 이미 평탄한 형태라면 그렇게 알려주세요. 전달한 객체를 그대로 사용하므로 복사하거나 다시 만들지 않습니다.

::: lang js

```javascript
const en = { 'desc.hello': 'Hello {name}' };
const ko = { 'desc.hello': '안녕하세요' };

analyzeTranslations({ locales: { en, ko } }, { target: 'en', flattened: true });
```

이것이 빠른 경로입니다. 로케일 5개에 걸친 키 5,000개 비교가 평탄화된 입력에서는 약 **17ms**, 평탄화 단계를 거치면 약 22ms입니다.

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

이것이 빠른 경로입니다. 전달한 맵을 비교가 그대로 읽습니다.

:::

::: lang py

```python
en = {"desc.hello": "Hello {name}"}
ko = {"desc.hello": "안녕하세요"}

analyze_translations(Input(locales={"en": en, "ko": ko}), Options(target="en", flattened=True))
```

이것이 빠른 경로입니다. 전달한 딕셔너리를 비교가 그대로 읽습니다.

:::

## 입력

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

`files`는 그룹과 로케일을 원본 파일에 연결해, 이슈가 `file` 경로를 담을 수 있게 합니다. `issues`에는 입력을 만든 쪽이 이미 발견한 문제를 함께 넣을 수 있습니다. 디렉터리 스캔에서 읽지 못한 파일 오류가 비교 결과와 한 목록에 담기는 것도 이 방식입니다. <Lang js="fileFormat" dart="fileFormat" py="file_format" code />은 결과로 그대로 전달되며, 마지막 두 필드는 [`UNUSED_KEY`](/ko/guide/checks#unused-key)와 [`UNDEFINED_KEY`](/ko/guide/checks#undefined-key)의 답을 이미 알고 있는 애플리케이션을 위한 것입니다.

## 결과가 말해주는 것

::: lang js

```javascript
result.files; // [] — 디스크에서 읽은 것이 없습니다
result.fileFormat; // null — 직접 전달하지 않았다면
result.locales; // 모든 그룹에서 발견된 모든 로케일
result.groups; // 모든 그룹 이름, 입력 순서대로
result.keyCount; // 비교한 고유 키 수
```

:::

::: lang dart

```dart
result.files; // [] — 디스크에서 읽은 것이 없습니다
result.fileFormat; // null — 직접 전달하지 않았다면
result.locales; // 모든 그룹에서 발견된 모든 로케일
result.groups; // 모든 그룹 이름, 입력 순서대로
result.keyCount; // 비교한 고유 키 수
```

:::

::: lang py

```python
result.files  # [] — 디스크에서 읽은 것이 없습니다
result.file_format  # None — 직접 전달하지 않았다면
result.locales  # 모든 그룹에서 발견된 모든 로케일
result.groups  # 모든 그룹 이름, 입력 순서대로
result.key_count  # 비교한 고유 키 수
```

:::

나머지는 [`checkTranslationFiles`](./check-translation-files)가 반환하는 것과 같은 형태입니다. [결과 객체](/ko/reference/result)를 참고하세요.

## 객체가 아닌 로케일

다른 입력 문제와 마찬가지로 예외를 던지지 않고 보고합니다.

::: lang js

```javascript
analyzeTranslations({ locales: { en: { a: 'A' }, ko: null } }, { target: 'en' });
// issuesByCode.INVALID_FILE — "The translations of `ko` are not an object."
```

:::

::: lang dart

Dart에서는 타입 시스템이 실행 전에 걸러냅니다. `Chki18nInput.locales`가 `Map<String, TranslationMap>`이므로 키의 맵이 아닌 값은 애초에 넣을 수 없습니다. 디스크의 파일이 다른 것을 담고 있다면 스캐너가 `INVALID_FILE`로 보고합니다.

:::

::: lang py

```python
analyze_translations(Input(locales={"en": {"a": "A"}, "ko": None}), Options(target="en"))
# result.of("INVALID_FILE") — "The translations of `ko` are not an object."
```

:::

## 함께 보기

- [`createAnalyzer`](./create-analyzer) — 분석기를 재사용하고 키 하나만 검사하기.
- [코어 진입점](./core) — 스캐너가 필요로 하는 파일 시스템 없이 이 함수만.
