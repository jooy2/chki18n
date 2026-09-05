---
title: CI에 붙이기
---

# CI에 붙이기

번역 파일이 어긋나도 빌드는 실패하지 않습니다. 예외가 발생하지 않고 테스트도 통과하므로, 빠진 키가 그대로 배포되고 누군가 그 언어로 앱을 열어 보기 전까지 드러나지 않습니다. 모든 풀 리퀘스트에서 chki18n을 실행하면 배포 전에 잡을 수 있습니다.

설정할 것은 없습니다. 경로와 기준 언어만 주면 나머지는 종료 코드로 판단합니다. 이 페이지에는 GitHub Actions와 Bitbucket Pipelines에 그대로 붙여 넣을 수 있는 작업을 언어별로 정리했습니다.

## CI가 판단하는 기준

| 종료 코드 | 의미                                                          |
| --------- | ------------------------------------------------------------- |
| `0`       | 오류 수준 이슈 없음. 경고는 출력됐을 수 있습니다.             |
| `1`       | 오류 수준 이슈가 하나 이상이거나, 디렉터리를 읽지 못했습니다. |

경고만으로는 빌드가 실패하지 않습니다. 의도한 동작입니다. 경고는 고칠 만한 문제이지 릴리스를 막을 문제는 아니며, 덕분에 이미 운영 중인 프로젝트에도 사전 정리 없이 바로 붙일 수 있습니다. 프로젝트에서 차단 요소로 보는 항목은 [`--levels`](./options#levels)로 심각도를 올리세요.

CI에서 쓸 만한 리포터는 넷입니다.

| 리포터     | 쓰이는 곳                                               |
| ---------- | ------------------------------------------------------- |
| `github`   | GitHub Actions. 각 이슈가 파일 위의 주석이 됩니다.      |
| `markdown` | 작업 요약, 또는 빌드와 함께 보관하는 리포트.            |
| `list`     | 이슈 한 건에 한 줄. 평범한 로그에 어울립니다.           |
| `json`     | 다른 도구가 읽을 때. 대시보드, 봇, 직접 만든 게이트 등. |

## GitHub Actions

### 작업

`.github/workflows/translations.yml`에 넣습니다. 모든 풀 리퀘스트와 main 브랜치 푸시에서 돕니다.

::: lang js

```yaml
name: translations

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    name: Check translations

    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v6
        with:
          node-version: '22'
      - name: Check translations
        run: npx chki18n ./locales --target en
```

:::

::: lang dart

```yaml
name: translations

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    name: Check translations

    steps:
      - uses: actions/checkout@v5
      - uses: dart-lang/setup-dart@v1
      - name: Check translations
        run: |
          dart pub global activate chki18n
          dart pub global run chki18n ./locales --target en
```

`chki18n`을 그냥 부르지 않고 `dart pub global run`을 쓰는 이유는, 러너의 PATH에 pub 캐시의 `bin`이 들어 있는지에 기대지 않기 위해서입니다. 들어 있는 환경이라면 명령 이름으로 바로 부르면 됩니다.

:::

::: lang py

```yaml
name: translations

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    name: Check translations

    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-python@v6
        with:
          python-version: '3.12'
      - name: Check translations
        run: |
          pip install chki18n
          chki18n ./locales --target en
```

:::

이게 전부입니다. 이제 키 하나가 빠지면 풀 리퀘스트가 실패합니다.

### 파일에 주석 달기

`--reporter github`는 각 이슈를 워크플로 명령으로 바꿉니다. GitHub이 이를 로그 한 줄이 아니라 번역 파일 위의 주석으로 표시합니다.

```bash
chki18n ./locales --target en --reporter github
```

```text
::error file=locales/ko.json,title=chki18n NO_KEY::ko attr.folder The key exists in the target language but is missing here. (en: "Folder")
::warning file=locales/ko.json,title=chki18n EMPTY_VALUE::ko attr.open The key is defined but its value is an empty string. (en: "Open")
```

`error`는 error 주석, `warn`은 warning, `info`는 notice가 됩니다. 줄 번호는 붙이지 않습니다. 검사는 파싱된 번역을 다루고, 가장 흔한 이슈가 애초에 파일에 없는 키이기 때문입니다. 주석은 파일을 가리킵니다.

토큰 권한을 좁혀둔 워크플로라면 주석을 달 권한이 필요합니다.

```yaml
permissions:
  contents: read
  checks: write
```

### 실행 요약에 남기기

`$GITHUB_STEP_SUMMARY`는 파일이고, 여기에 쓴 마크다운은 그 실행의 페이지에 그대로 나타납니다. `markdown` 리포터가 정확히 그 모양입니다.

```bash
chki18n ./locales --target en --output "$GITHUB_STEP_SUMMARY" --reporter markdown
```

리포트는 명령이 끝나기 전에 쓰이므로, 통과했든 실패했든 요약은 남습니다.

### 리포트 보관하기

```yaml
- name: Check translations
  run: chki18n ./locales --target en --output translation-report.md
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: translation-report
    path: translation-report.md
```

`if: always()`를 빠뜨리면 검사가 실패했을 때 업로드까지 건너뛰므로, 정작 리포트가 필요한 상황에서 남지 않습니다.

### 번역이 바뀔 때만 돌리기

폴더 하나 검사는 밀리초 단위라 매번 돌려도 부담이 없습니다. 그래도 줄이고 싶다면 경로 필터로 충분합니다.

```yaml
on:
  pull_request:
    paths:
      - 'locales/**'
      - '.github/workflows/translations.yml'
```

필수 체크로 지정한 작업을 조건부로 만들 때는 조심하세요. 작업을 건너뛴 풀 리퀘스트는 체크가 통과가 아니라 대기 상태로 남고, 브랜치 보호 설정에 따라 병합이 막힙니다.

## Bitbucket Pipelines

### 파이프라인

Bitbucket은 저장소 루트의 `bitbucket-pipelines.yml` 하나를 읽습니다. 맨 위의 이미지가 그 단계에서 무엇을 쓸 수 있는지 정합니다.

::: lang js

```yaml
image: node:22

pipelines:
  pull-requests:
    '**':
      - step:
          name: Check translations
          script:
            - npx chki18n ./locales --target en
  branches:
    main:
      - step:
          name: Check translations
          script:
            - npx chki18n ./locales --target en
```

:::

::: lang dart

```yaml
image: dart:stable

pipelines:
  pull-requests:
    '**':
      - step:
          name: Check translations
          script:
            - dart pub global activate chki18n
            - dart pub global run chki18n ./locales --target en
  branches:
    main:
      - step:
          name: Check translations
          script:
            - dart pub global activate chki18n
            - dart pub global run chki18n ./locales --target en
```

:::

::: lang py

```yaml
image: python:3.12-slim

pipelines:
  pull-requests:
    '**':
      - step:
          name: Check translations
          script:
            - pip install chki18n
            - chki18n ./locales --target en
  branches:
    main:
      - step:
          name: Check translations
          script:
            - pip install chki18n
            - chki18n ./locales --target en
```

:::

단계 안의 명령이 0이 아닌 코드로 끝나면 그 단계가 실패합니다. 종료 코드 하나로 연결이 끝납니다.

같은 블록을 두 번 쓰지 않으려면 단계를 정의해두고 양쪽에서 가리키면 됩니다.

```yaml
definitions:
  steps:
    - step: &check-translations
        name: Check translations
        script:
          - npx chki18n ./locales --target en

pipelines:
  pull-requests:
    '**':
      - step: *check-translations
  branches:
    main:
      - step: *check-translations
```

### 리포트 보관하기

```yaml
- step:
    name: Check translations
    script:
      - npx chki18n ./locales --target en --output translation-report.md
    artifacts:
      - translation-report.md
```

파일은 명령이 `1`로 끝나기 전에 쓰이므로, 검사가 통과했든 실패했든 남아 있습니다.

Bitbucket 로그에는 `--reporter list`가 가장 잘 읽힙니다. 여기서는 만들어낼 주석이 없으니 `github` 리포터를 쓸 이유가 없습니다.

```bash
chki18n ./locales --target en --reporter list
```

### 설치 캐시하기

필수는 아닙니다. 설치가 작아서 몇 초 아끼는 정도입니다.

::: lang js

```yaml
- step:
    name: Check translations
    caches:
      - node
    script:
      - npx chki18n ./locales --target en
```

`node`는 Bitbucket이 기본으로 제공하는 캐시라 따로 정의할 것이 없습니다.

:::

::: lang dart

```yaml
definitions:
  caches:
    pub: ~/.pub-cache

pipelines:
  pull-requests:
    '**':
      - step:
          name: Check translations
          caches:
            - pub
          script:
            - dart pub global activate chki18n
            - dart pub global run chki18n ./locales --target en
```

:::

::: lang py

```yaml
- step:
    name: Check translations
    caches:
      - pip
    script:
      - pip install chki18n
      - chki18n ./locales --target en
```

`pip`은 Bitbucket이 기본으로 제공하는 캐시라 따로 정의할 것이 없습니다.

:::

### 번역이 바뀔 때만 돌리기

단계마다 어떤 경로에 관심이 있는지 지정할 수 있습니다.

```yaml
- step:
    name: Check translations
    condition:
      changesets:
        includePaths:
          - 'locales/**'
    script:
      - npx chki18n ./locales --target en
```

## 이미 번역이 쌓인 프로젝트에 붙이기

운영 중인 프로젝트에서 처음 실행하면 한 번에 고치기 어려울 만큼 많이 나오는 것이 보통입니다. 그렇다고 빌드를 막을 필요는 없습니다.

이미 동의하는 검사부터 시작해서, 정리되는 대로 목록을 늘려 가면 됩니다.

```bash
chki18n ./locales --target en --checks NO_KEY,NO_INTERPOLATION_KEY
```

반대로 전부 켜 놓고 시끄러운 검사만 빼도 됩니다.

```bash
chki18n ./locales --target en --ignore-checks DUPLICATE_VALUE
```

검사는 전부 두고 무엇을 오류로 볼지만 정하는 방법도 있습니다.

```bash
chki18n ./locales --target en --levels EMPTY_VALUE=error,NOT_TRANSLATED_VALUE=info
```

각 검사가 무엇을 잡는지는 [검사 항목](./checks)에, 세 플래그는 [옵션](./options)에 정리되어 있습니다.

## 명령만으로 부족할 때

"하나라도 실패했는가"보다 세밀한 기준이 필요하다면, 예를 들어 개수 기준선이나 언어별 규칙, 코멘트 자동 등록이 필요하다면 종료 코드 대신 결과를 읽으세요.

::: lang js

```javascript
import { checkTranslationFiles } from 'chki18n';

const result = await checkTranslationFiles('./locales', { target: 'en' });
const untranslated = result.summary.byCode.NOT_TRANSLATED_VALUE ?? 0;

if (untranslated > 50) {
	console.error(`${untranslated} strings are still untranslated.`);
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
final untranslated = result.summary.byCode[Chki18nCheckCode.notTranslatedValue] ?? 0;

if (untranslated > 50) {
  stderr.writeln('$untranslated strings are still untranslated.');
  exitCode = 1;
}
```

:::

::: lang py

```python
import sys

from chki18n import Options, check_translation_files

result = check_translation_files("./locales", Options(target="en"))
untranslated = result.summary.by_code.get("NOT_TRANSLATED_VALUE", 0)

if untranslated > 50:
    print(f"{untranslated} strings are still untranslated.", file=sys.stderr)
    sys.exit(1)
```

:::

라이브러리는 프로세스를 종료하지 않고, 요청하지 않으면 출력도 하지 않습니다. 둘 다 스크립트가 직접 결정합니다. [`checkTranslationFiles`](/ko/api/check-translation-files)와 [결과 객체](/ko/reference/result)를 참고하세요.

## 함께 보기

- [커맨드라인](./cli) — 모든 플래그와, 작업이 출력하는 리포트.
- [옵션](./options) — 같은 옵션을 양쪽에서.
- [검사 항목](./checks) — 각 검사가 잡는 것과 심각도.
