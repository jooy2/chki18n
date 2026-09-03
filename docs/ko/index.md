---
layout: home

title: chki18n
titleTemplate: i18n 번역 파일 검사 도구
description: i18n 번역 파일에서 누락된 키, 비어 있는 값, 어긋난 보간 키를 찾아냅니다. 커맨드라인과 CI, 그리고 직접 호출하는 JavaScript API가 같은 검사 엔진을 사용하며, 편집 중 실시간 검사에 쓸 수 있을 만큼 빠릅니다.

hero:
  name: chki18n
  text: 번역 파일, 제대로 검사하기
  tagline: 누락된 키, 비어 있는 값, 번역되지 않은 문자열, 더 이상 맞지 않는 보간 키. 모든 i18n JSON 구조에 대해 13가지를 검사하며, 커맨드라인에서도 코드에서도 동작합니다.
  actions:
    - theme: brand
      text: 시작하기
      link: /ko/guide/getting-started
    - theme: alt
      text: 검사 항목
      link: /ko/guide/checks
    - theme: alt
      text: API
      link: /ko/api/
  image:
    src: /512x512.png
    alt: chki18n

features:
  - title: 13가지 검사, 하나의 리포트
    details: 누락된 키, 두 번 정의된 키, 비어 있는 값, 번역되지 않은 문자열, 어긋난 보간 키, 중복된 값, 앞뒤 공백, 아무도 참조하지 않는 키까지. 각 검사의 심각도는 프로젝트에 맞게 조정할 수 있습니다.
    link: /ko/guide/checks
    linkText: 검사 항목
  - title: 이미 쓰고 있는 파일 구조 그대로
    details: 로케일당 파일 하나, 로케일당 폴더 하나, 또는 모든 로케일을 담은 파일 하나. 같은 키를 공유하는 파일끼리 그룹으로 묶어 비교하므로 errors.json과 common.json이 뒤섞이지 않습니다.
    link: /ko/guide/file-layouts
    linkText: 파일 구조
  - title: CLI와 API는 같은 것
    details: 모든 커맨드라인 플래그가 곧 API 옵션이며, 하나의 정의에서 파생됩니다. CI에서 통과하는 것은 빌드 스크립트에서도 통과합니다.
    link: /ko/guide/options
    linkText: 옵션
  - title: 타이핑 중에도 검사할 만큼 빠르게
    details: 로케일 5개에 걸친 키 5,000개 비교가 약 17ms, 수정된 키 하나를 다시 검사하는 데 약 2µs. 편집기가 매 입력마다 검사해도 무리가 없습니다.
    link: /ko/api/create-analyzer
    linkText: createAnalyzer
  - title: 그대로 화면에 그릴 수 있는 결과
    details: 모든 이슈가 심각도, 키, 로케일, 그리고 설명 문장을 함께 담고 있어 대시보드나 번역 편집기가 문자열을 하드코딩하지 않고도 결과를 표시할 수 있습니다.
    link: /ko/reference/result
    linkText: 결과 객체
  - title: 앱이 도는 곳이라면 어디서나
    details: 비교 엔진은 Node 내장 모듈을 전혀 사용하지 않으며 chki18n/core로 따로 배포되어, 브라우저나 편집기의 렌더러 프로세스에도 번들할 수 있습니다.
    link: /ko/api/core
    linkText: chki18n/core
---

## 실제 모습

번역 파일이 있는 폴더와 기준 언어를 지정하면 됩니다.

```bash
npx chki18n ./locales --target en
```

```text
  Path     ./locales
  Target   en
  Locales  en, ko
  Layout   single, 1 group, 10 keys

 ko ──────────────────────────────────────────────────────────────────────── 1 error · 1 warning

  ERROR  NO_KEY (1)
         The key exists in the target language but is missing here.
    attr.folder  en: "Folder"

  WARN   NOT_TRANSLATED_VALUE (1)
         The value is identical to the target language, so the translation may be incomplete.
    desc.no-str  en: "12345"

 Summary ───────────────────────────────────────────────────────────────────────────────────────

  Compared 10 keys across 2 locales in 1 group. (3ms)
  1 error · 1 warning
  Clean: en

  FAIL  1 error must be fixed before this passes.
```

오류 수준의 이슈가 있으면 종료 코드 `1`로 끝나므로, CI 작업이 여기서 실패합니다.

같은 검사를 JavaScript에서 실행하면 텍스트 대신 객체를 받습니다.

```javascript
import { checkTranslationFiles } from 'chki18n';

const result = await checkTranslationFiles('./locales', { target: 'en' });

result.success; // false
result.summary; // { error: 1, warn: 1, info: 0, total: 2, byCode: {…}, byLocale: {…} }
result.issues[0];
// {
//   code: 'NO_KEY',
//   level: 'error',
//   locale: 'ko',
//   key: 'attr.folder',
//   group: '',
//   targetValue: 'Folder',
//   file: '/project/locales/ko.json',
//   message: 'The key exists in the target language but is missing here.'
// }
```

설치는 [시작하기](./guide/getting-started) 한 페이지면 충분합니다. 각 검사가 무엇을 잡아내는지는 [검사 항목](./guide/checks)에, 모든 옵션은 [옵션](./guide/options)에 정리되어 있습니다.
