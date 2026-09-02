---
title: API
---

# API

chki18n에는 네 개의 진입점이 있고, 어느 것을 쓸지는 번역 데이터를 누가 소유하며 얼마나 자주 검사하느냐에 달려 있습니다. 넷 모두 같은 비교 엔진, 같은 옵션 체계, 같은 결과 형태를 공유하므로 진입점을 바꿔도 데이터가 도착하는 방식만 달라집니다.

## 어떤 진입점을 쓸까

| 상황 | 사용할 함수 | 파일 읽기 |
| --- | --- | --- |
| 디렉토리를 한 번 검사 — CI, 스크립트, 커밋 훅 | [`checkTranslationFiles`](./check-translation-files) | 예 |
| 이미 가지고 있는 데이터를 한 번 검사 | [`analyzeTranslations`](./analyze-translations) | 아니오 |
| 디렉토리를 한 번 읽고 반복해서 검사 | [`loadTranslations`](./load-translations) | 한 번만 |
| 값은 앱이 소유하고 판정만 필요 | [`createAnalyzer`](./create-analyzer) | 아니오 |

파일 시스템을 쓰지 않는 두 개는 [`chki18n/core`](./core)로도 배포됩니다. Node 내장 모듈을 전혀 import하지 않아 브라우저나 편집기의 렌더러 프로세스에도 번들됩니다.

## 값을 누가 소유하는가

의식적으로 결정할 가치가 있는 유일한 지점입니다. [세션](./load-translations)은 모든 문자열의 사본을 직접 들고 있고, 그래서 `session.set`과 `session.checkKey`가 메모리만으로 동작합니다. 그런데 애플리케이션 _역시_ 그 문자열을 들고 있다면(번역 편집기, 사용자가 입력 중인 값에 바인딩된 폼) 사본이 두 개가 되고 모든 편집이 양쪽에 도달해야 합니다. 버그가 생기기 좋은 구조입니다.

그런 경우에는 [`createAnalyzer().checkEntry`](./create-analyzer)를 쓰세요. 호출할 때마다 값을 넘기므로 애플리케이션이 유일한 진실의 원천으로 남고, 검사 비용은 약 2마이크로초입니다.

반대로 chki18n이 소유자인 경우 — 스크립트, 감시자, 같은 폴더를 두 번 검사하는 CI 단계 — 라면 세션 쪽이 훨씬 간단합니다.

## 그 밖에 export되는 것들

네 진입점 외에:

- **검사 메타데이터** — `CHECK_CODE`, `CHECK_META`, `ANALYZE_CHECK_CODES`, `CROSS_KEY_CHECK_CODES`. [검사 항목](/ko/guide/checks) 참고.
- **결과 헬퍼** — `groupIssuesByCode`, `summarizeIssues`, `createIssue`, `buildResult`. [결과 객체](/ko/reference/result) 참고.
- **옵션** — `resolveOptions`, `argsToOptions`, `buildUsageText`, `OPTION_DEFINITIONS`. [옵션](/ko/guide/options) 참고.
- **기본값** — `DEFAULT_TARGET_LOCALE`, `DEFAULT_EXCLUDE_DIRS`, `DEFAULT_INTERPOLATION_PREFIX`, `DEFAULT_INTERPOLATION_SUFFIX`, `FILE_FORMAT`.
- **유틸리티** — `isLocaleCode`, `extractInterpolationKeys`, `scanTranslationDirectory`.
- **세션** — `createSession`. 디렉토리 대신 직접 전달하는 번역 데이터용입니다.

모든 타입도 함께 export됩니다. `Chki18nOptions`, `Chki18nResult`, `Chki18nIssue`, `Chki18nSummary`, `Chki18nEntry`, `Chki18nSession` 등입니다.
