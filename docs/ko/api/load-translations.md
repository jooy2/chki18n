---
title: loadTranslations
---

# `loadTranslations`

디렉터리를 한 번 읽고, 파싱된 번역 데이터를 들고 있는 세션을 돌려줍니다. 전체 분석이든 키 하나 검사든 값 수정이든, 이후의 모든 호출은 이미 메모리에 있는 데이터로 처리됩니다. 그래서 같은 폴더를 반복해서 검사해도 읽기는 한 번뿐입니다.

## 시그니처

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

## 사용법

::: lang js

```javascript
import { loadTranslations } from 'chki18n';

const session = await loadTranslations('./locales', { target: 'en' });

session.locales; // ['en', 'ko']
session.groups; // ['']
session.fileFormat; // 'single'
session.keys(); // ['desc.hello', 'desc.bye', …] — 기준 언어 순서

session.analyze(); // 파일을 다시 읽지 않고 전체 결과

session.get('ko', 'desc.hello'); // '안녕하세요'
session.checkKey('desc.hello'); // [{ code: 'NO_INTERPOLATION_KEY', … }]

session.set('ko', 'desc.hello', '{name}님 안녕하세요'); // → [] — 이제 문제없음
session.analyze(); // 오류 하나 감소

await session.reload(); // 수정 사항을 버리고 디렉터리를 다시 읽기
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
session.keys(); // ['desc.hello', 'desc.bye', …] — 기준 언어 순서

session.analyze(); // 파일을 다시 읽지 않고 전체 결과

session.get('ko', 'desc.hello'); // '안녕하세요'
session.checkKey('desc.hello'); // [Chki18nIssue(code: NO_INTERPOLATION_KEY, …)]

session.set('ko', 'desc.hello', '{name}님 안녕하세요'); // [] — 이제 문제없음
session.analyze(); // 오류 하나 감소

await session.reload(); // 수정 사항을 버리고 디렉터리를 다시 읽기
```

:::

::: lang py

```python
from chki18n import Options, load_translations

session = load_translations("./locales", Options(target="en"))

session.locales  # ['en', 'ko']
session.groups  # ['']
session.file_format  # 'single'
session.keys()  # ['desc.hello', 'desc.bye', …] — 기준 언어 순서

session.analyze()  # 파일을 다시 읽지 않고 전체 결과

session.get("ko", "desc.hello")  # '안녕하세요'
session.check_key("desc.hello")  # [Issue(code='NO_INTERPOLATION_KEY', …)]

session.set("ko", "desc.hello", "{name}님 안녕하세요")  # [] — 이제 문제없음
session.analyze()  # 오류 하나 감소

session.reload()  # 수정 사항을 버리고 디렉터리를 다시 읽기
```

:::

## 읽기

### `analyze()`

세션이 들고 있는 전부를 검사하고 [결과](/ko/reference/result)를 반환합니다. [`checkTranslationFiles`](./check-translation-files)가 반환하는 것과 형태가 같습니다. 파일을 읽지 않으므로 수정할 때마다 호출해도 부담이 없습니다.

### `keys(group?)`

그룹의 모든 키를 기준 언어 순서대로 반환합니다.

### `get(locale, key, group?)`

값 하나를 반환하며, 해당 로케일이 그 키를 정의하지 않았다면 <Lang js="undefined" dart="null" py="None" code />입니다. 키는 평탄한 형태입니다. `['desc', 'hello']`가 아니라 `'desc.hello'`입니다.

### `translations(group?)`

그룹의 평탄화된 번역 데이터를 로케일별로 반환합니다. 세션이 실제로 들고 있는 객체이므로 읽는 것은 자유지만, 쓰기는 `set`과 `remove`를 통해야 세션의 내부 상태가 어긋나지 않습니다.

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

### 속성

::: lang js

```javascript
session.options; // 모든 검사가 사용하는 해석된 옵션
session.locales; // 들고 있는 모든 로케일
session.groups; // 들고 있는 모든 그룹, 검사 순서대로
session.files; // 읽어들인 파일들
session.fileFormat; // 'single' | 'folder' | 'nested'
session.path; // 검사한 절대 경로
session.skipped; // 읽었지만 로케일에 속하지 않은 파일들
session.detectedInterpolation; // { prefix: '{{', suffix: '}}' } — 파일이 쓰는 것으로 보이는 구분자
```

:::

::: lang dart

```dart
session.options; // 모든 검사가 사용하는 해석된 옵션
session.locales; // 들고 있는 모든 로케일
session.groups; // 들고 있는 모든 그룹, 검사 순서대로
session.files; // 읽어들인 파일들
session.fileFormat; // Chki18nFileFormat.single, .folder, .nested
session.path; // 검사한 절대 경로
session.skipped; // 읽었지만 로케일에 속하지 않은 파일들
session.detectedInterpolation; // Chki18nDelimiters('{{', '}}') — 파일이 쓰는 것으로 보이는 구분자
```

:::

::: lang py

```python
session.options  # 모든 검사가 사용하는 해석된 옵션
session.locales  # 들고 있는 모든 로케일
session.groups  # 들고 있는 모든 그룹, 검사 순서대로
session.files  # 읽어들인 파일들
session.file_format  # 'single' | 'folder' | 'nested'
session.path  # 검사한 절대 경로
session.skipped  # 읽었지만 로케일에 속하지 않은 파일들
session.detected_interpolation  # Delimiters('{{', '}}') — 파일이 쓰는 것으로 보이는 구분자
```

:::

<Lang js="detectedInterpolation" dart="detectedInterpolation" py="detected_interpolation" code />는 프로젝트를 처음 설정하는 사람을 위한 추측값으로, 스캔이 받아들인 파일의 원문에서 읽어냅니다. 어느 파일에도 자리 표시자로 보이는 것이 없으면 <Lang js="null" dart="null" py="None" code />입니다. 실제 비교에 쓰인 구분자는 바꾸지 않습니다. 검사는 파일이 어떻게 생겼든 `interpolationPrefix`를 그대로 씁니다.

## 쓰기

### `set(locale, key, value, group?)`

값을 쓰고 **그 키의 현재 이슈를 반환합니다.** 수정과 판정이 한 번의 호출로 끝납니다.

::: lang js

```javascript
session.set('ko', 'desc.hello', '안녕하세요');
// [{ code: 'NO_INTERPOLATION_KEY', level: 'error', … }] — {name}이 없습니다

session.set('ko', 'desc.hello', '{name}님 안녕하세요');
// [] — 문제없음
```

:::

::: lang dart

```dart
session.set('ko', 'desc.hello', '안녕하세요');
// [Chki18nIssue(code: NO_INTERPOLATION_KEY, level: error, …)] — {name}이 없습니다

session.set('ko', 'desc.hello', '{name}님 안녕하세요');
// [] — 문제없음
```

:::

::: lang py

```python
session.set("ko", "desc.hello", "안녕하세요")
# [Issue(code='NO_INTERPOLATION_KEY', level='error', …)] — {name}이 없습니다

session.set("ko", "desc.hello", "{name}님 안녕하세요")
# [] — 문제없음
```

:::

없던 로케일은 새로 추가됩니다. 새 언어를 시작하는 방법이기도 합니다.

### `remove(key, { locale, group })`

키를 한 로케일에서, `locale`을 주지 않으면 모든 로케일에서 지우고 다시 검사합니다.

::: lang js

```javascript
session.remove('attr.folder', { locale: 'ko' }); // → [{ code: 'NO_KEY', … }]
session.remove('attr.folder'); // 전부 삭제 → []
```

:::

::: lang dart

```dart
session.remove('attr.folder', locale: 'ko'); // [Chki18nIssue(code: NO_KEY, …)]
session.remove('attr.folder'); // 전부 삭제 -> []
```

:::

::: lang py

```python
session.remove("attr.folder", locale="ko")  # [Issue(code='NO_KEY', …)]
session.remove("attr.folder")  # 전부 삭제 -> []
```

:::

### `checkKey(key, group?)`

키 하나를 모든 로케일에 걸쳐 검사합니다. 약 **1µs**이므로 매 입력마다 호출해도 됩니다.

여러 키를 함께 봐야 하는 검사는 여기서 보고되지 않습니다. `DUPLICATE_VALUE`는 로케일 전체를 한 번에 봐야 하며, 키 하나로는 답할 수 없습니다. 그런 코드는 `CROSS_KEY_CHECK_CODES`에 정리되어 있습니다.

### `reset(input)`

옵션과 분석기는 유지한 채 번역 데이터만 교체합니다. `reload()`는 같은 디렉터리를 다시 읽어 이 작업을 수행합니다.

### `reload()`

디렉터리를 다시 읽으며, `set`과 `remove`로 가한 수정은 모두 버립니다.

## 그룹

번역 파일이 여러 개인 프로젝트에는 그룹이 여럿 있습니다. 필요하면 지정하고, 아니면 생략해도 됩니다. 그룹이 하나면 지정할 것이 없고, 여럿이면 세션이 그 키가 실제로 있는 그룹을 찾습니다.

::: lang js

```javascript
session.groups; // ['common.json', 'errors.json']

session.get('en', 'failed'); // errors.json에서 찾음
session.checkKey('failed')[0].group; // 'errors.json'

session.set('ko', 'failed', '실패', 'errors.json'); // 명시적으로 지정
```

:::

::: lang dart

```dart
session.groups; // ['common.json', 'errors.json']

session.get('en', 'failed'); // errors.json에서 찾음
session.checkKey('failed').first.group; // 'errors.json'

session.set('ko', 'failed', '실패', 'errors.json'); // 명시적으로 지정
```

:::

::: lang py

```python
session.groups  # ['common.json', 'errors.json']

session.get("en", "failed")  # errors.json에서 찾음
session.check_key("failed")[0].group  # 'errors.json'

session.set("ko", "failed", "실패", "errors.json")  # 명시적으로 지정
```

:::

그룹을 반드시 지정해야 하는 경우는 아직 존재하지 않는 키를 추가할 때뿐입니다. 찾아볼 곳이 없기 때문입니다.

## 이미 가지고 있는 번역 데이터

<Lang js="createSession" dart="createSession" py="create_session" code />은 디렉터리 없이 같은 일을 하며, [코어 진입점](./core)에서도 가져올 수 있습니다.

::: lang js

```javascript
import { createSession } from 'chki18n/core';

const session = createSession({ groups: { 'common.json': { en, ko } } }, { target: 'en' });

session.reset({ groups: nextGroups }); // 데이터만 교체, 옵션은 유지
```

:::

::: lang dart

```dart
import 'package:chki18n/core.dart';

final session = createSession(
  Chki18nInput(groups: {'common.json': {'en': en, 'ko': ko}}),
  options: const Chki18nOptions(target: 'en'),
);

session.reset(Chki18nInput(groups: nextGroups)); // 데이터만 교체, 옵션은 유지
```

:::

::: lang py

```python
from chki18n.core import Input, Options, create_session

session = create_session(
    Input(groups={"common.json": {"en": en, "ko": ko}}), Options(target="en")
)

session.reset(Input(groups=next_groups))  # 데이터만 교체, 옵션은 유지
```

:::

디렉터리에만 의미가 있는 `path`, `skipped`, `reload`를 제외하면 위의 모든 기능이 동일합니다.

## 세션이 들고 있는 사본

세션은 모든 문자열의 사본을 직접 들고 있습니다. 애플리케이션 _역시_ 그 문자열을 들고 있다면, 예를 들어 사용자가 입력 중인 값에 바인딩된 번역 편집기라면, 사본이 두 개가 되고 모든 수정이 양쪽에 반영되어야 합니다. 어긋나기 쉬운 구조입니다.

그런 경우에는 [`createAnalyzer().checkEntry`](./create-analyzer)를 쓰세요. 호출할 때마다 값을 넘기므로 애플리케이션이 유일한 원본으로 남고, 검사 비용도 여전히 마이크로초 단위입니다.

## 오류

경로가 없거나 디렉터리를 읽지 못해도 예외를 던지지 않습니다. 세션은 빈 상태로 돌아오면서 그 문제를 함께 들고 있고, 첫 `analyze()`에서 이슈로 드러납니다.

::: lang js

```javascript
const session = await loadTranslations('./does-not-exist');

session.analyze().success; // false
session.analyze().issuesByCode.INVALID_FILE; // 이유
```

:::

::: lang dart

```dart
final session = await loadTranslations(path: './does-not-exist');

session.analyze().success; // false
session.analyze().of(Chki18nCheckCode.invalidFile); // 이유
```

:::

::: lang py

```python
session = load_translations("./does-not-exist")

session.analyze().success  # False
session.analyze().of("INVALID_FILE")  # 이유
```

:::
