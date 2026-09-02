---
title: chki18n/core
---

# `chki18n/core`

디렉토리 검사기를 뺀 비교 엔진 그 자체입니다. Node 내장 모듈을 전혀 import하지 않으므로 브라우저, 워커, 편집기의 렌더러 프로세스 등 `node:fs`를 쓸 수 없는 어디에서든 번들됩니다.

## 왜 따로 있나

패키지 루트는 디렉토리를 읽기 때문에 `node:fs`, `node:path`, `node:os`를 import합니다. 브라우저 빌드에서 번들러가 이것을 만나면 실패하거나, 실행될 일 없는 코드를 위해 폴리필 더미를 끌어옵니다.

비교 자체는 그런 것들이 필요했던 적이 없습니다. `chki18n/core`는 파일 시스템을 뺀 같은 엔진입니다.

```javascript
import { analyzeTranslations, createAnalyzer, CHECK_META } from 'chki18n/core';
```

빌드마다 이 서브패스의 import 그래프를 따라가며 Node 내장 모듈이 나타나는지 검사하는 테스트가 있으므로, 이는 의도가 아니라 보장입니다.

## export하는 것

파일을 읽는 부분을 **제외한** 루트의 모든 것입니다.

| export됨 | export되지 않음 |
| --- | --- |
| [`analyzeTranslations`](./analyze-translations), [`createAnalyzer`](./create-analyzer) | `checkTranslationFiles` |
| `createSession` (직접 전달하는 번역 데이터용) | `loadTranslations` |
| `CHECK_CODE`, `CHECK_META`, `ANALYZE_CHECK_CODES`, `CROSS_KEY_CHECK_CODES`, `FILE_FORMAT` | `scanTranslationDirectory` |
| `groupIssuesByCode`, `summarizeIssues`, `createIssue`, `buildResult` |  |
| `resolveOptions`, `argsToOptions`, `buildUsageText`, `OPTION_DEFINITIONS` |  |
| `isLocaleCode`, `extractInterpolationKeys`, 그리고 모든 타입 |  |

루트가 이 전부를 다시 export하므로 `import { createAnalyzer } from 'chki18n'`도 동작합니다. 번들에 검사기가 들어가면 안 될 때 서브패스를 쓰세요.

## 브라우저에서

그 환경이 이미 쓰고 있는 방식으로 파일을 읽은 뒤, 파싱된 객체를 넘기면 됩니다.

```javascript
import { analyzeTranslations } from 'chki18n/core';

const en = await fetch('/locales/en.json').then((res) => res.json());
const ko = await fetch('/locales/ko.json').then((res) => res.json());

const result = analyzeTranslations({ locales: { en, ko } }, { target: 'en' });
```

## 편집기에서

이 서브패스가 만들어진 이유인 조합입니다. 프로젝트를 열 때 전체 검사, 수정할 때마다 키 하나.

```javascript
import { createAnalyzer } from 'chki18n/core';

const analyzer = createAnalyzer({ target: 'en' });

analyzer.analyze({ groups: everything }); // 열 때
analyzer.checkEntry({ key, values, locales }); // 매 입력마다
```

전체 패턴과, chki18n이 값의 사본을 들고 있게 하는 것보다 값을 넘기는 편이 나은 이유는 [`createAnalyzer`](./create-analyzer)를 참고하세요.

## 의존성

두 개뿐이며 둘 다 작고 Node 전용이 아닙니다. 중첩 키 평탄화를 위한 `flat`과 보간 자리표시자 추출을 위한 `qsu`입니다. `chalk`와 `minimist`는 CLI의 것이며 여기서는 도달할 수 없습니다.
