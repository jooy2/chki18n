---
title: API
---

# API

chki18n에는 네 개의 진입점이 있습니다. 어느 것을 쓸지는 번역 데이터를 누가 소유하고 얼마나 자주 검사하느냐에 따라 갈립니다. 넷 모두 같은 비교 엔진과 옵션 체계, 같은 결과 형태를 쓰므로 진입점을 바꿔도 데이터를 넘기는 방식만 달라집니다. 세 패키지 모두 넷을 전부 제공합니다.

## 어떤 진입점을 쓸까

| 상황 | 사용할 함수 | 파일 읽기 |
| --- | --- | --- |
| 디렉터리를 한 번 검사 — CI, 스크립트, 커밋 훅 | [`checkTranslationFiles`](./check-translation-files) | 예 |
| 이미 가지고 있는 데이터를 한 번 검사 | [`analyzeTranslations`](./analyze-translations) | 아니오 |
| 디렉터리를 한 번 읽고 반복해서 검사 | [`loadTranslations`](./load-translations) | 한 번만 |
| 값은 앱이 소유하고 판정만 필요 | [`createAnalyzer`](./create-analyzer) | 아니오 |

파일 시스템을 쓰지 않는 두 개는 <Lang js="chki18n/core" dart="package:chki18n/core.dart" py="chki18n.core" code />로도 따로 배포됩니다. 파일 시스템에 전혀 닿지 않는 진입점이며, [코어 진입점](./core)에 정리해 두었습니다.

아래의 모든 이름은 JavaScript 표기로 적습니다. Dart도 같은 표기를 쓰고, Python은 snake_case이므로 `analyzeTranslations`는 `analyze_translations`입니다. 이 대응은 [시작하기](/ko/guide/getting-started#언어별-이름-규칙)에 한 번 정리해 두었습니다.

## 값의 소유권

네 진입점 중 무엇을 쓸지는 대개 여기서 갈립니다. [세션](./load-translations)은 모든 문자열의 사본을 직접 들고 있고, 그래서 `session.set`과 `session.checkKey`가 메모리만으로 동작합니다. 애플리케이션 _역시_ 그 문자열을 들고 있다면, 예를 들어 번역 편집기나 사용자가 입력 중인 값에 바인딩된 폼이라면, 사본이 두 개가 되고 모든 수정이 양쪽에 반영되어야 합니다. 어긋나기 쉬운 구조입니다.

그런 경우에는 [`createAnalyzer().checkEntry`](./create-analyzer)를 쓰세요. 호출할 때마다 값을 넘기므로 애플리케이션이 유일한 원본으로 남고, 검사 비용은 약 2마이크로초입니다.

반대로 chki18n이 값의 소유자라면, 이를테면 스크립트나 파일 감시자, 같은 폴더를 두 번 검사하는 CI 단계라면 세션 쪽이 훨씬 간단합니다.

## 그 밖에 공개된 것들

네 진입점 외에:

- **검사 메타데이터** — <Lang js="CHECK_CODE" dart="Chki18nCheckCode" py="CHECK_CODES" code />, `CHECK_META`, `ANALYZE_CHECK_CODES`, `CROSS_KEY_CHECK_CODES`. [검사 항목](/ko/guide/checks) 참고.
- **결과 헬퍼** — `groupIssuesByCode`, `summarizeIssues`, `createIssue`, `buildResult`. [결과 객체](/ko/reference/result) 참고.
- **옵션** — `resolveOptions`, <Lang js="argsToOptions" dart="optionsFromArgs" py="options_from_args" code />, `buildUsageText`, `OPTION_DEFINITIONS`. [옵션](/ko/guide/options) 참고.
- **기본값** — `DEFAULT_TARGET_LOCALE`, `DEFAULT_EXCLUDE_DIRS`, `DEFAULT_INTERPOLATION_PREFIX`, `DEFAULT_INTERPOLATION_SUFFIX`, <Lang js="FILE_FORMAT" dart="Chki18nFileFormat" py="FILE_FORMATS" code />.
- **리포팅** — `formatResult`, `groupIssues`, `displayWidth`, `padTo`, `truncate`. [옵션](/ko/guide/options#reporter) 참고.
- **유틸리티** — `isLocaleCode`, `extractInterpolationKeys`, `scanTranslationDirectory`.
- **세션** — `createSession`. 디렉터리 대신 직접 전달하는 번역 데이터용입니다.

모든 타입도 함께 공개됩니다.

::: lang js

`Chki18nOptions`, `Chki18nResult`, `Chki18nIssue`, `Chki18nSummary`, `Chki18nEntry`, `Chki18nSession` 등입니다.

:::

::: lang dart

`Chki18nOptions`, `Chki18nResult`, `Chki18nIssue`, `Chki18nSummary`, `Chki18nEntry`, `Chki18nSession` 등입니다. Dart는 공개 타입에 모두 접두사를 붙이므로, 가져다 쓰는 라이브러리의 이름과 부딪히지 않습니다.

:::

::: lang py

`Options`, `Result`, `Issue`, `Summary`, `Entry`, `Session` 등입니다. Python은 접두사를 붙이지 않습니다. `chki18n.Result`만으로 어느 라이브러리의 것인지 이미 드러나기 때문입니다.

:::
