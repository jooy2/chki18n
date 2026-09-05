---
title: 시작하기
---

# 시작하기

chki18n을 설치하고, 번역 파일이 있는 폴더를 지정한 다음, 나머지 언어가 비교될 기준 언어를 알려주면 됩니다. 설정 파일은 없습니다. 경로와 기준 언어가 전부입니다.

## 패키지 고르기

chki18n은 세 언어로 배포되지만 셋은 하나의 라이브러리입니다. 같은 25가지 검사를 같은 순서로 수행하고, 옵션 이름과 종료 코드도 같으며, 리포트는 열 위치까지 같습니다. 프로젝트가 이미 쓰는 언어를 고르면 됩니다. 사이드바 위쪽의 전환 버튼을 누르면 이 사이트의 모든 예제 코드가 그 언어로 바뀝니다.

| 언어 | 레지스트리 | 설치 | 요구 사항 |
| --- | --- | --- | --- |
| JavaScript | [npm](https://www.npmjs.com/package/chki18n) | `npm install chki18n` | Node.js 18 이상 |
| Dart | [pub.dev](https://pub.dev/packages/chki18n) | `dart pub add chki18n` | Dart 3.7 이상 |
| Python | [PyPI](https://pypi.org/project/chki18n/) | `pip install chki18n` | Python 3.10 이상 |

### 언어별 이름 규칙

모든 함수와 옵션은 **JavaScript 이름**으로 설명합니다. 제목과 앵커는 어느 독자에게나 같아야 하기 때문입니다. 나머지 둘은 각각 규칙 하나만 따르며, 그 규칙을 적는 곳은 여기뿐입니다.

- **Dart**는 JavaScript 이름을 그대로 씁니다. `checkTranslationFiles`, `interpolationPrefix`, `maxKeyDepth`. 달라지는 것은 형태입니다. 옵션은 named parameter로 만드는 `Chki18nOptions` 객체 하나로 받고, 값이 정해진 자리에는 열거형이 옵니다. `'NO_KEY'` 대신 `Chki18nCheckCode.noKey`를 쓰지만, `Chki18nCheckCode.noKey.code`는 여전히 `NO_KEY`입니다.
- **Python**은 전부 snake_case입니다. `check_translation_files`, `interpolation_prefix`, `max_key_depth`. 검사 코드와 심각도, 옵션 선택지는 다른 언어와 똑같은 문자열 그대로입니다. `"NO_KEY"`, `"error"`, `"kebab"`.

## 설치

::: lang js

설치 없이 바로 실행할 수 있습니다. CI 작업에서는 보통 이 방식을 씁니다.

```bash
npx chki18n ./locales --target en
```

코드에서 호출할 예정이라면 프로젝트에 추가합니다.

```bash
npm install chki18n
```

```bash
pnpm add chki18n
```

```bash
yarn add chki18n
```

ESM 패키지이며 타입 선언을 포함하고, 런타임 의존성은 작은 것 네 개뿐입니다.

:::

::: lang dart

한 번 설치하면 명령이 경로에 등록됩니다.

```bash
dart pub global activate chki18n
```

코드에서 호출할 예정이라면 프로젝트에 추가합니다.

```bash
dart pub add chki18n
```

Flutter 프로젝트에서는 `flutter pub add chki18n`입니다. 이미 의존성으로 추가한 프로젝트 안에서는 전역 설치 없이 `dart run chki18n`으로 실행할 수 있습니다. 이 패키지는 의존성이 없습니다.

:::

::: lang py

설치 없이 바로 실행할 수 있습니다. CI 작업에서는 보통 이 방식을 씁니다.

```bash
pipx run chki18n ./locales --target en
```

코드에서 호출할 예정이라면 프로젝트에 추가합니다.

```bash
pip install chki18n
```

```bash
uv add chki18n
```

타입이 모두 붙어 있고 `py.typed`를 함께 배포하며, 의존성은 없습니다.

:::

## 첫 번째 검사

프로젝트에 번역 파일이 두 개 있다고 가정하겠습니다.

```text
locales/
  en.json
  ko.json
```

```json
// locales/en.json
{
	"desc": { "hello": "Hello {name}", "bye": "Goodbye" },
	"attr": { "folder": "Folder" }
}
```

```json
// locales/ko.json
{
	"desc": { "hello": "안녕하세요", "bye": "안녕히 계세요" }
}
```

이제 실행합니다.

::: lang js

```bash
npx chki18n ./locales --target en
```

:::

::: lang dart py

```bash
chki18n ./locales --target en
```

:::

```text
  Path     ./locales
  Target   en
  Locales  en, ko
  Layout   single, 1 group, 3 keys

 ko ─────────────────────────────────────────────────────────────────────────────────── 2 errors

  ERROR  NO_KEY (1)
         The key exists in the target language but is missing here.
    attr.folder  en: "Folder"

  ERROR  NO_INTERPOLATION_KEY (1)
    desc.hello   en: "Hello {name}"
      The interpolation key `{name}` of the target language is missing from this value.

 Summary ───────────────────────────────────────────────────────────────────────────────────────

  Compared 3 keys across 2 locales in 1 group. (2ms)
  2 errors
  Clean: en

  By check
    NO_INTERPOLATION_KEY  1 error
    NO_KEY                1 error

  FAIL  2 errors must be fixed before this passes.
```

실제 문제가 두 가지 있습니다. 한국어 번역이 `{name}` 자리 표시자를 빠뜨렸고, 키 하나가 통째로 없습니다. 종료 코드가 `1`이므로 CI 작업은 여기서 실패합니다.

모든 플래그와 종료 코드, CI 연결 방법은 [커맨드라인](./cli)에 정리되어 있습니다.

## 코드에서

같은 검사를, 코드에서 다룰 수 있는 값으로 받습니다.

::: lang js

```javascript
import { checkTranslationFiles } from 'chki18n';

const result = await checkTranslationFiles('./locales', { target: 'en' });

if (!result.success) {
	for (const issue of result.issues) {
		console.log(`${issue.level} ${issue.locale} ${issue.key}: ${issue.message}`);
	}
}
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

final result = await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(target: 'en'),
);

if (!result.success) {
  for (final issue in result.issues) {
    print('${issue.level.name} ${issue.locale} ${issue.key}: ${issue.message}');
  }
}
```

:::

::: lang py

```python
from chki18n import Options, check_translation_files

result = check_translation_files("./locales", Options(target="en"))

if not result.success:
    for issue in result.issues:
        print(f"{issue.level} {issue.locale} {issue.key}: {issue.message}")
```

:::

요청하지 않으면 아무것도 출력하지 않고, 프로세스를 임의로 종료하지도 않습니다. 판단의 근거는 반환된 결과뿐입니다. 결과에 담긴 모든 정보는 [결과 객체](/ko/reference/result)를 참고하세요.

## 어떤 진입점을 쓸까

번역 데이터를 누가 소유하고 얼마나 자주 검사하느냐에 따라 네 가지 함수가 있습니다.

| 상황 | 사용할 함수 |
| --- | --- |
| 디렉터리를 한 번 검사 — CI, 스크립트, pre-commit 훅 | [`checkTranslationFiles`](/ko/api/check-translation-files) |
| 이미 메모리에 있는 데이터를 한 번 검사 | [`analyzeTranslations`](/ko/api/analyze-translations) |
| 디렉터리를 한 번 읽고 반복해서 검사 | [`loadTranslations`](/ko/api/load-translations) |
| 값은 앱이 소유하고 판정만 필요 | [`createAnalyzer().checkEntry`](/ko/api/create-analyzer) |

`checkTranslationFiles`와 `loadTranslations`는 디렉터리를 읽습니다. `analyzeTranslations`와 `createAnalyzer`는 파일 시스템을 전혀 사용하지 않으며, <Lang js="chki18n/core" dart="package:chki18n/core.dart" py="chki18n.core" code />로도 따로 배포되어 읽을 디스크가 없는 곳에서도 실행됩니다. [코어 진입점](/ko/api/core)을 참고하세요.

## 다음으로

- [검사 항목](./checks) — 25가지 검사와 특정 검사를 끄는 방법.
- [파일 구조](./file-layouts) — 파일이 로케일당 하나 형태가 아닌 경우.
- [옵션](./options) — 양쪽에서 전달할 수 있는 모든 옵션.
