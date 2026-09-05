---
layout: home

title: chki18n
titleTemplate: i18n 번역 파일 검사 도구
description: i18n 번역 파일에서 누락된 키, 비어 있는 값, 어긋난 보간 키를 찾아냅니다. 커맨드라인과 CI, 직접 호출하는 코드가 같은 검사 엔진을 씁니다. JavaScript, Dart, Python 중에서 고르면 됩니다.

hero:
  name: chki18n
  text: 번역 파일, 제대로 검사하기
  tagline: 누락된 키, 비어 있는 값, 번역되지 않은 문자열, 더 이상 맞지 않는 보간 키. 모든 i18n JSON 구조에 대해 25가지를 검사하며, 커맨드라인에서도 코드에서도 동작합니다. JavaScript, Dart, Python으로 씁니다.
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
    src: /640x640.png
    alt: chki18n

features:
  - title: 25가지 검사, 하나의 리포트
    details: 누락된 키, 아무도 만들지 않은 언어 파일, 비어 있는 값, 번역되지 않은 문자열, 이름도 횟수도 어긋난 보간 키, 번역이 빠뜨린 마크업, 바뀐 숫자, 보이지 않는 문자, 화면마다 흔들린 용어까지. 각 검사의 심각도는 프로젝트에 맞게 조정할 수 있습니다.
    link: /ko/guide/checks
    linkText: 검사 항목
  - title: 이미 쓰고 있는 파일 구조 그대로
    details: 로케일당 파일 하나, 로케일당 폴더 하나, 또는 모든 로케일을 담은 파일 하나. 같은 키를 공유하는 파일끼리 그룹으로 묶어 비교하므로 errors.json과 common.json이 뒤섞이지 않습니다.
    link: /ko/guide/file-layouts
    linkText: 파일 구조
  - title: 세 언어, 하나의 라이브러리
    details: JavaScript, Dart, Python 패키지가 같은 검사를 같은 순서로 수행하고 같은 리포트를 바이트 단위로 똑같이 출력합니다. 프로젝트가 이미 쓰는 언어를 고르면 됩니다.
    link: /ko/guide/getting-started
    linkText: 시작하기
  - title: CLI와 API는 같은 것
    details: 모든 커맨드라인 플래그가 곧 API 옵션이며, 하나의 정의에서 파생됩니다. CI에서 통과하는 것은 빌드 스크립트에서도 통과합니다.
    link: /ko/guide/options
    linkText: 옵션
  - title: 그대로 화면에 그릴 수 있는 결과
    details: 모든 이슈가 심각도, 키, 로케일, 그리고 설명 문장을 함께 담고 있어 대시보드나 번역 편집기가 문자열을 하드코딩하지 않고도 결과를 표시할 수 있습니다.
    link: /ko/reference/result
    linkText: 결과 객체
  - title: 앱이 도는 곳이라면 어디서나
    details: 비교 엔진은 파일 시스템을 전혀 건드리지 않으며 별도 진입점으로 배포되어, 브라우저나 Flutter 웹 빌드, 디스크가 없는 샌드박스에도 번들할 수 있습니다.
    link: /ko/api/core
    linkText: 코어 진입점
---

## 실제 모습

번역 파일이 있는 폴더와 기준 언어를 지정하면 됩니다.

::: lang js

```bash
npx chki18n ./locales --target en
```

:::

::: lang dart

```bash
dart pub global activate chki18n
chki18n ./locales --target en
```

:::

::: lang py

```bash
pip install chki18n
chki18n ./locales --target en
```

:::

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

오류 수준의 이슈가 있으면 종료 코드 `1`로 끝나므로, CI 작업이 여기서 실패합니다. 어느 패키지를 설치하든 이 리포트는 열 위치까지 똑같습니다.

같은 검사를 코드에서 실행하면 텍스트 대신 객체를 받습니다.

::: lang js

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
result.issues.first;
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
result.issues[0]
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

설치는 [시작하기](./guide/getting-started) 한 페이지면 충분합니다. 각 검사가 무엇을 잡아내는지는 [검사 항목](./guide/checks)에, 모든 옵션은 [옵션](./guide/options)에 정리되어 있습니다.
