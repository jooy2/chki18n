---
title: checkTranslationFiles
---

# `checkTranslationFiles`

번역 파일 디렉터리를 읽어 모든 언어를 기준 언어와 비교하는 일을 한 번의 호출로 수행합니다. CLI가 하는 일을 그대로, 코드에서 다룰 수 있는 값으로 돌려주며, 디렉터리를 한 번만 검사할 때 쓰는 진입점입니다.

## 시그니처

::: lang js

```typescript
function checkTranslationFiles(path?: string, options?: Chki18nOptions): Promise<Chki18nResult>;
```

:::

::: lang dart

```dart
Future<Chki18nResult> checkTranslationFiles({String? path, Chki18nOptions? options});
```

:::

::: lang py

```python
def check_translation_files(
    path: str | None = None,
    options: Options | None = None,
) -> Result: ...
```

JavaScript 패키지와 달리 동기 함수입니다. Python의 파일 시스템이 동기이므로, `async` 표면은 이 패키지가 지킬 수 없는 약속이 됩니다.

:::

## 사용법

::: lang js

```javascript
import { checkTranslationFiles } from 'chki18n';

const result = await checkTranslationFiles('./locales', { target: 'en' });

result.success; // false
result.summary.error; // 1
result.issues;
// [
//   {
//     code: 'NO_KEY',
//     level: 'error',
//     locale: 'ko',
//     key: 'attr.folder',
//     group: '',
//     targetValue: 'Folder',
//     file: '/project/locales/ko.json',
//     message: 'The key exists in the target language but is missing here.'
//   }
// ]
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

final result = await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(target: 'en'),
);

result.success; // false
result.summary.error; // 1
result.of(Chki18nCheckCode.noKey).first;
// Chki18nIssue(
//   code: Chki18nCheckCode.noKey,
//   level: Chki18nLevel.error,
//   locale: 'ko',
//   key: 'attr.folder',
//   group: '',
//   targetValue: 'Folder',
//   file: '/project/locales/ko.json',
//   message: 'The key exists in the target language but is missing here.',
// )
```

:::

::: lang py

```python
from chki18n import Options, check_translation_files

result = check_translation_files("./locales", Options(target="en"))

result.success  # False
result.summary.error  # 1
result.of("NO_KEY")[0]
# Issue(
#     code="NO_KEY",
#     level="error",
#     locale="ko",
#     key="attr.folder",
#     group="",
#     target_value="Folder",
#     file="/project/locales/ko.json",
#     message="The key exists in the target language but is missing here.",
# )
```

:::

경로는 옵션으로도 전달할 수 있으며, CLI가 위치 인자를 처리하는 방식이기도 합니다.

::: lang js

```javascript
await checkTranslationFiles(undefined, { path: './locales', target: 'en' });
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  options: const Chki18nOptions(path: './locales', target: 'en'),
);
```

:::

::: lang py

```python
check_translation_files(options=Options(path="./locales", target="en"))
```

:::

모든 옵션은 [옵션](/ko/guide/options)에, 결과는 [결과 객체](/ko/reference/result)에 정리되어 있습니다.

## 출력하지도, 종료하지도 않습니다

이 함수가 의도적으로 하지 않는 두 가지입니다.

- **`verbose`를 켜지 않으면 아무것도 출력하지 않습니다.** 모듈을 가져오는 것만으로 호스트 애플리케이션의 출력이 오염되지 않습니다.
- **프로세스를 종료하지 않습니다.** 검사 실패는 <Lang js="result.success === false" dart="result.success == false" py="result.success is False" code />이지 종료 호출이 아닙니다. 종료는 CLI의 몫이며, 이 함수가 반환된 뒤에 이루어집니다.

직접 만든 스크립트에서 CLI와 같은 리포트를 보고 싶다면 출력을 켜세요.

::: lang js

```javascript
await checkTranslationFiles('./locales', { target: 'en', verbose: true });
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(target: 'en', verbose: true),
);
```

:::

::: lang py

```python
check_translation_files("./locales", Options(target="en", verbose=True))
```

:::

`reporter`와 `groupBy`는 CLI에서와 똑같이 리포트의 모양을 정합니다. `output`은 리포트를 파일로 쓰며, `verbose` 여부와 무관하게 동작합니다. 파일은 요청해서 받는 것이지 일방적으로 출력되는 것이 아니기 때문입니다.

::: lang js

```javascript
await checkTranslationFiles('./locales', { target: 'en', output: 'report.md' });
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(target: 'en', output: 'report.md'),
);
```

:::

::: lang py

```python
check_translation_files("./locales", Options(target="en", output="report.md"))
```

:::

출력도 저장도 하지 않고 문자열만 얻고 싶다면 <Lang js="formatResult" dart="formatResult" py="format_result" code />를 직접 부르세요.

::: lang js

```javascript
import { formatResult, resolveOptions } from 'chki18n';

formatResult(result, resolveOptions({ target: 'en', reporter: 'markdown' }).options);
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

formatResult(
  result,
  resolveOptions(
    const Chki18nOptions(target: 'en', reporter: Chki18nReporter.markdown),
  ).options,
);
```

:::

::: lang py

```python
from chki18n import Options, format_result, resolve_options

format_result(result, resolve_options(Options(target="en", reporter="markdown"))[0])
```

:::

## 빌드 실패시키기

::: lang js

```javascript
import { checkTranslationFiles } from 'chki18n';

const result = await checkTranslationFiles('./locales', { target: 'en' });

if (!result.success) {
	for (const issue of result.issues.filter((one) => one.level === 'error')) {
		console.error(`${issue.locale} ${issue.key}: ${issue.message}`);
	}

	process.exit(1);
}
```

:::

::: lang dart

```dart
import 'dart:io';

import 'package:chki18n/chki18n.dart';

final result = await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(target: 'en'),
);

if (!result.success) {
  for (final issue in result.issues.where((one) => one.level == Chki18nLevel.error)) {
    stderr.writeln('${issue.locale} ${issue.key}: ${issue.message}');
  }

  exitCode = 1;
}
```

:::

::: lang py

```python
import sys

from chki18n import Options, check_translation_files

result = check_translation_files("./locales", Options(target="en"))

if not result.success:
    for issue in (one for one in result.issues if one.level == "error"):
        print(f"{issue.locale} {issue.key}: {issue.message}", file=sys.stderr)

    sys.exit(1)
```

:::

`success`는 `error` 수준 이슈가 하나라도 있을 때 거짓이 됩니다. 경고는 절대 실패로 만들지 않습니다. 프로젝트에서 차단 요소로 취급한다면 [`levels`](/ko/guide/options#levels)로 승격하세요.

## 오류는 던지지 않고 보고합니다

없는 디렉터리, 읽을 수 없는 파일, 파싱되지 않는 JSON, 파일 어디에도 없는 기준 언어 — 어느 것도 예외를 던지지 않습니다. 모두 이슈로 돌아오므로, 잘못된 파일 하나가 나머지 발견을 가리지 않습니다.

::: lang js

```javascript
const result = await checkTranslationFiles('./does-not-exist');

result.success; // false
result.issuesByCode.INVALID_FILE;
// [{ code: 'INVALID_FILE', level: 'error', message: "Failed to read the directory …" }]
```

:::

::: lang dart

```dart
final result = await checkTranslationFiles(path: './does-not-exist');

result.success; // false
result.of(Chki18nCheckCode.invalidFile);
// [Chki18nIssue(code: INVALID_FILE, level: error, message: "Failed to read the directory …")]
```

:::

::: lang py

```python
result = check_translation_files("./does-not-exist")

result.success  # False
result.of("INVALID_FILE")
# [Issue(code="INVALID_FILE", level="error", message="Failed to read the directory …")]
```

:::

경로를 아예 전달하지 않은 경우도 같은 방식으로, `INVALID_OPTIONS` 오류로 보고됩니다.

## 소요 시간

<Lang js="result.elapsedMs" dart="result.elapsedMs" py="result.elapsed_ms" code />는 검사, 파싱, 비교를 모두 포함한 전체 호출 시간입니다. 같은 디렉터리를 여러 번 검사하면 그만큼 여러 번 읽게 되므로, 그런 형태의 작업이라면 [`loadTranslations`](./load-translations)를 쓰세요.

## 함께 보기

- [`analyzeTranslations`](./analyze-translations) — 이미 가진 데이터에 대한 같은 비교.
- [`loadTranslations`](./load-translations) — 한 번 읽고 원하는 만큼 검사.
- [커맨드라인](/ko/guide/cli) — 같은 일을 명령으로.
