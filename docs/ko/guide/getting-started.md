---
title: 시작하기
---

# 시작하기

chki18n을 설치하고, 번역 파일이 있는 폴더를 지정한 다음, 나머지 언어가 비교될 기준 언어를 알려주면 됩니다. 설정 파일은 없습니다. 경로와 기준 언어가 전부입니다.

## 요구 사항

Node.js **18 이상**. ESM 패키지이며 타입 선언을 포함하고, 런타임 의존성은 작은 것 네 개뿐입니다.

## 설치

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

실행하면:

```bash
npx chki18n ./locales --target en
```

```text
 Chki18n  INFO  Process to check specified translation files... (Current path: /project/locales)
 Chki18n  INFO  This comparison is based on the following language: en

 Chki18n  ERROR  [NO_INTERPOLATION_KEY] The interpolation key does not match the target language (1):
 - ko -> 'desc.hello' (en: "Hello {name}") The interpolation key `{name}` of the target language is missing from this value.

 Chki18n  ERROR  [NO_KEY] Some translation files did not include the following keys (1):
 - ko -> 'attr.folder' (en: "Folder")

 Chki18n  INFO  Compared 3 keys across 2 locales in 1 group. (2ms)
 Chki18n  INFO  Found 2 errors and 0 warnings.
```

실제 문제 두 가지입니다. 한국어 번역이 `{name}` 자리표시자를 빠뜨렸고, 키 하나가 통째로 없습니다. 종료 코드가 `1`이므로 CI 작업은 여기서 실패합니다.

모든 플래그와 종료 코드, CI 연결 방법은 [커맨드라인](./cli)에 정리되어 있습니다.

## JavaScript에서

같은 검사를, 코드에서 다룰 수 있는 값으로 받습니다.

```javascript
import { checkTranslationFiles } from 'chki18n';

const result = await checkTranslationFiles('./locales', { target: 'en' });

if (!result.success) {
	for (const issue of result.issues) {
		console.log(`${issue.level} ${issue.locale} ${issue.key}: ${issue.message}`);
	}
}
```

요청하지 않으면 아무것도 출력하지 않고, 프로세스를 임의로 종료하지도 않습니다. 반환된 결과가 판단의 유일한 근거입니다. 결과에 담긴 모든 정보는 [결과 객체](/ko/reference/result)를 참고하세요.

## 어떤 진입점을 쓸까

번역 데이터를 누가 소유하고 얼마나 자주 검사하느냐에 따라 네 가지 함수가 있습니다.

| 상황 | 사용할 함수 |
| --- | --- |
| 디렉토리를 한 번 검사 — CI, 스크립트, pre-commit 훅 | [`checkTranslationFiles`](/ko/api/check-translation-files) |
| 이미 메모리에 있는 데이터를 한 번 검사 | [`analyzeTranslations`](/ko/api/analyze-translations) |
| 디렉토리를 한 번 읽고 반복해서 검사 | [`loadTranslations`](/ko/api/load-translations) |
| 값은 앱이 소유하고 판정만 필요 | [`createAnalyzer().checkEntry`](/ko/api/create-analyzer) |

앞의 두 개는 파일을 읽으므로 Node가 필요합니다. 뒤의 두 개는 파일 시스템을 전혀 건드리지 않으며, 브라우저에도 번들되는 [`chki18n/core`](/ko/api/core)로도 배포됩니다.

## 다음으로

- [검사 항목](./checks) — 13가지 검사와 특정 검사를 끄는 방법.
- [파일 구조](./file-layouts) — 파일이 로케일당 하나 형태가 아닌 경우.
- [옵션](./options) — 양쪽에서 전달할 수 있는 모든 옵션.
