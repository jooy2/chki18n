---
title: 커맨드라인
---

# 커맨드라인

`chki18n` 명령은 번역 파일 폴더를 검사하고 잘못된 부분을 출력합니다. 오류 수준의 이슈를 찾으면 종료 코드 `1`로 끝나며, 이것이 CI 작업이나 pre-commit 훅에서 유용한 이유입니다.

## 사용법

```bash
npx chki18n [options] <targetDirectory>
```

디렉토리는 인자로 바로 넘기거나 `--path`로 지정할 수 있으며, 둘은 같은 의미입니다. 상대 경로는 현재 작업 디렉토리를 기준으로 해석됩니다.

```bash
npx chki18n ./locales
```

```bash
npx chki18n --path ./locales --target en
```

## 플래그

```text
  --path <dir>                    The directory where the files to be scanned are located (required)
  --target <locale>               The language every other language is compared against (default: `en`)
  --format <format>               Layout of the translation files: `auto`, `single`, `folder` or `nested`
  --checks <codes>                Run only these comma separated check codes
  --ignore-checks <codes>         Run every check except these comma separated check codes
  --levels <code=level>           Report a check at another severity, e.g. `EMPTY_VALUE=error`
  --interpolation-prefix <str>    Opening delimiter of an interpolation key (default: `{`)
  --interpolation-suffix <str>    Closing delimiter of an interpolation key (default: `}`)
  --exclude <dirs>                Comma separated directory names to skip while scanning
  --no-info                       Do not show info messages
  --no-warn                       Do not show warning messages
  --debug                         Show debug messages
  --help                          Show this message
  --version                       Show the installed version
```

모든 플래그는 camelCase로 된 같은 이름의 API 옵션이기도 합니다. `--ignore-checks`는 `ignoreChecks`입니다. 양쪽이 하나의 정의에서 파생되기 때문이며, [옵션](./options)에서 두 방식을 한 번에 설명합니다.

## 출력 읽기

```text
 Chki18n  INFO  Process to check specified translation files... (Current path: /project/locales)
 Chki18n  INFO  This comparison is based on the following language: en

 Chki18n  ERROR  [NO_KEY] Some translation files did not include the following keys (2):
 - ko -> 'attr.folder' (en: "Folder")
 - ja @common.json -> 'attr.open' (en: "Open")

 Chki18n  WARN  [DUPLICATE_VALUE] Some keys have duplicate values (1):
 - ko -> 'dup-b' (en: "Beta") The key `dup-a` in the same locale already uses this value.

 Chki18n  INFO  Compared 11 keys across 3 locales in 2 groups. (4ms)
 Chki18n  INFO  Found 2 errors and 1 warning.
```

이슈는 검사 코드별로 묶이며, 제목에 발생 횟수가 표시됩니다. 각 줄은 로케일과 키를 표시하고, 프로젝트에 그룹이 둘 이상이면 `@` 뒤에 소속 그룹을 덧붙입니다. 괄호 안은 기준 언어의 표현으로, 번역이 비교되는 대상입니다. 검사가 더 구체적인 설명을 만들어냈다면 줄 끝에 함께 표시됩니다.

## 종료 코드

| 코드 | 의미                                                          |
| ---- | ------------------------------------------------------------- |
| `0`  | 오류 수준 이슈 없음. 경고는 출력됐을 수 있습니다.             |
| `1`  | 오류 수준 이슈가 하나 이상이거나, 디렉토리를 읽지 못했습니다. |

경고는 실행을 실패시키지 않습니다. 프로젝트에서 특정 경고를 차단 요소로 취급한다면 `--levels`로 승격하세요.

```bash
npx chki18n ./locales --target en --levels EMPTY_VALUE=error
```

## CI에서

GitHub Actions 스텝은 한 줄이면 됩니다.

```yaml
- name: Check translations
  run: npx chki18n ./locales --target en
```

경고를 정리하는 동안 작업을 통과 상태로 유지하려면, 이미 해결한 검사만 지정하세요.

```yaml
- name: Check translations
  run: npx chki18n ./locales --target en --checks NO_KEY,NO_INTERPOLATION_KEY
```

반대로, 시끄러운 검사 하나만 제외할 수도 있습니다.

```yaml
- name: Check translations
  run: npx chki18n ./locales --target en --ignore-checks DUPLICATE_VALUE
```

## pre-commit 훅에서

```bash
#!/bin/sh
npx chki18n ./locales --target en --no-info || exit 1
```

`--no-info`는 진행 상황 줄을 없애고 이슈만 남깁니다. 문제가 없을 때는 조용해야 하는 훅에 알맞습니다.

## 아무것도 찾지 못할 때

`--debug`는 해석된 옵션, 감지된 파일 구조, 그리고 읽었지만 로케일에 속하지 않아 건너뛴 파일을 모두 출력합니다.

```bash
npx chki18n ./locales --debug
```

어떤 파일도 일치하지 않았다면 대개 파일 구조가 원인입니다. [파일 구조](./file-layouts)를 확인하고 `--format`으로 강제 지정해 보세요.
