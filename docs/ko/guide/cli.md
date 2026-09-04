---
title: 커맨드라인
---

# 커맨드라인

`chki18n` 명령은 번역 파일 폴더를 검사하고 잘못된 부분을 출력합니다. 오류 수준의 이슈를 찾으면 종료 코드 `1`로 끝나며, 이것이 CI 작업이나 pre-commit 훅에서 유용한 이유입니다.

세 패키지가 같은 명령을 제공합니다. 플래그도 출력도 같고, 명령을 경로에 올리는 방법만 다릅니다.

::: lang js

```bash
# 설치 없이 실행합니다. CI에서는 보통 이 방식입니다.
npx chki18n ./locales --target en

# 설치하면 명령 이름은 `chki18n`입니다.
npm install chki18n
```

:::

::: lang dart

```bash
# 한 번 설치하면 명령이 경로에 등록됩니다.
dart pub global activate chki18n

# 이미 의존성으로 추가한 프로젝트 안에서는 전역 설치 없이 실행합니다.
dart run chki18n ./locales --target en
```

:::

::: lang py

```bash
# 설치 없이 실행합니다. CI에서는 보통 이 방식입니다.
pipx run chki18n ./locales --target en

# 설치하면 명령 이름은 `chki18n`입니다.
pip install chki18n
```

:::

이 페이지의 나머지는 명령을 `chki18n`으로 씁니다.

## 사용법

```bash
chki18n [options] <targetDirectory>
```

디렉토리는 인자로 바로 넘기거나 `--path`로 지정할 수 있으며, 둘은 같은 의미입니다. 상대 경로는 현재 작업 디렉토리를 기준으로 해석됩니다.

```bash
chki18n ./locales
```

```bash
chki18n --path ./locales --target en
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
  --source <dir>                  Source files to read for key usages (enables `UNUSED_KEY` and `UNDEFINED_KEY`)
  --translate-functions <names>   Comma separated names a translation call goes by (default: `t`, `$t`, `translate`)
  --key-case <case>               Case every key segment has to use: `kebab`, `camel`, `snake`
  --max-key-depth <levels>        How many levels a key may be nested, e.g. `2` for `attr.folder`
  --length-ratio <times>          Report a value more than this many times longer or shorter than the target
  --reporter <name>               How to render the report: `pretty`, `list`, `json`, `markdown`, `github`
  --group-by <axis>               Group the reported issues by `locale`, `code`, `group`, `file`, `none`
  --output <file>                 Also write the report to this file, in the format its extension implies
  --width <columns>               Lay the report out to this many columns instead of measuring the terminal
  --no-color                      Do not colour the output
  --no-info                       Do not show info messages
  --no-warn                       Do not show warning messages
  --debug                         Show debug messages
  --help                          Show this message
  --version                       Show the installed version
```

모든 플래그는 같은 이름의 API 옵션이기도 합니다. `--ignore-checks`는 <Lang js="ignoreChecks" dart="ignoreChecks" py="ignore_checks" code />입니다. 양쪽이 하나의 정의에서 파생되기 때문이며, [옵션](./options)에서 두 방식을 한 번에 설명합니다.

## 출력 읽기

```text
  Path     ./locales
  Target   en
  Locales  en, ja, ko
  Layout   single, 1 group, 5 keys

 ko ─────────────────────────────────────────────────────────────────────── 2 errors · 1 warning

  ERROR  NO_KEY (1)
         The key exists in the target language but is missing here.
    attr.folder  en: "Folder"

  ERROR  NO_INTERPOLATION_KEY (1)
    greeting     en: "Hello {name}"
      The interpolation key `{name}` of the target language is missing from this value.

  WARN   DUPLICATE_VALUE (1)
    dup-b        en: "Beta"
      The key `dup-a` in the same locale already uses this value.

 Summary ───────────────────────────────────────────────────────────────────────────────────────

  Compared 5 keys across 3 locales in 1 group. (3ms)
  2 errors · 3 warnings

  By check
    NO_INTERPOLATION_KEY  1 error
    NO_KEY                1 error
    DUPLICATE_VALUE       3 warnings

  FAIL  2 errors must be fixed before this passes.
```

번역가가 한 번에 다루는 단위가 언어이므로, 구획은 언어별로 나뉩니다. 구획 안에서는 검사별로 묶이고 심각한 것이 위로 옵니다. 검사 코드 뒤의 숫자는 발생 횟수이고, 그 아래 한 줄은 검사의 의미입니다. 각 줄은 키와 함께 기준 언어의 표현을 보여줍니다. 번역이 비교되는 대상이 바로 그것입니다. 검사가 더 구체적인 설명을 만들어냈다면 다음 줄에 붙습니다. 비교 대상 파일 묶음이 둘 이상이면 키 뒤에 `@`로 그룹이 따라옵니다.

요약은 구획이 답하지 않은 쪽을 채웁니다. 언어별로 나눴으니 집계는 검사별이고, 검사별로 나누면 둘이 뒤바뀝니다.

## 출력 형식 고르기

`--reporter`가 보고서의 모양을 정합니다. 어떤 형식이든 같은 이슈를 같은 순서로 담고, 그 주변의 글만 달라집니다.

| 리포터     | 쓰임새                                                          |
| ---------- | --------------------------------------------------------------- |
| `pretty`   | 터미널에서 읽기. 구획과 색상, 요약이 있습니다. 기본값입니다.    |
| `list`     | 이슈 한 건에 한 줄. `grep`, 에디터, CI 로그에 알맞습니다.       |
| `json`     | 결과 객체 전체. 다른 도구가 읽을 용도입니다.                    |
| `markdown` | 표 형태. PR 코멘트나 저장소에 두는 리포트에 알맞습니다.         |
| `github`   | 워크플로 명령. GitHub Actions가 번역 파일에 직접 주석을 답니다. |

```bash
chki18n ./locales --target en --reporter list
```

```text
ko  error  NO_KEY                attr.folder  en: "Folder"
ko  error  NO_INTERPOLATION_KEY  greeting     en: "Hello {name}"  The interpolation key `{name}` of the target language is missing from this value.
ko  warn   DUPLICATE_VALUE       dup-b        en: "Beta"  The key `dup-a` in the same locale already uses this value.

Found 2 errors, 3 warnings. Compared 5 keys across 3 locales in 1 group. (3ms)
```

`pretty`가 아닌 형식은 배너도 진행 상황 줄도 없이 보고서만 출력합니다. 다른 프로그램으로 그대로 넘길 수 있습니다.

```bash
chki18n ./locales --target en --reporter json > report.json
```

`--debug`는 표준 출력이 아니라 표준 오류로 나가므로, 넘긴 보고서에 섞이지 않습니다.

## 터미널 너비에 맞추기

보고서는 터미널 너비에 맞춰 배치됩니다. 잴 터미널이 없으면 `COLUMNS` 값을 씁니다. CI 러너가 로그 너비를 알려줄 때 쓰는 값입니다. 잰 너비는 120칸에서 자릅니다. 그보다 벌어지면 라벨과 집계가 한 줄로 읽히지 않기 때문입니다.

`--width`는 이 모두를 무시하며, 상한도 없습니다.

```bash
chki18n ./locales --width 72
```

설명은 잘리지 않고 다음 줄로 넘어가므로, 좁은 터미널에서도 문장이 사라지지 않습니다. `--output`으로 쓰는 파일은 터미널을 아예 보지 않고 고정 너비를 쓰며, `--width`를 주면 그 값을 씁니다.

## 이슈 묶는 기준

`--group-by`가 구획의 단위를 정합니다. 기본값은 `locale`입니다.

| 기준     | 구획 하나가 뜻하는 것                                |
| -------- | ---------------------------------------------------- |
| `locale` | 언어. 번역가가 한자리에서 처리하는 단위입니다.       |
| `code`   | 검사. 관리자가 한 번에 처리하는 단위입니다.          |
| `group`  | 비교 대상이 되는 파일 묶음. 예를 들어 `common.json`. |
| `file`   | 디스크의 번역 파일 하나.                             |
| `none`   | 구획 없이 한 덩어리.                                 |

```bash
chki18n ./locales --target en --group-by code
```

구획은 심각한 것부터 놓입니다. 오류가 있는 구획, 경고만 있는 구획, 나머지 순입니다. 구획 안에서도 같은 순서를 따르고 그다음은 검사 순서, 그다음은 키 순서입니다. 파일이 바뀌지 않았다면 두 번 실행해도 같은 줄이 같은 자리에 찍히므로, 저장한 보고서를 비교하는 데 쓸 수 있습니다.

`list`, `json`, `markdown`도 이 기준을 따릅니다. `list`는 구획이 없으니 순서에만 반영됩니다.

## 보고서를 파일로 저장하기

`--output`은 터미널에 출력하면서 같은 보고서를 파일로도 씁니다. 형식은 확장자가 정합니다. `.json`과 `.md`는 각자의 형식이 있고, 나머지는 평문으로 씁니다.

```bash
chki18n ./locales --target en --output translation-report.md
```

없는 디렉토리는 만들어 줍니다. 파일에는 색상 코드가 들어가지 않고, 터미널 너비가 아니라 고정 너비로 배치되므로 어디서 실행하든 같은 파일이 나옵니다.

둘 다 주면 `--reporter`가 이깁니다. 화면과 파일의 형식을 다르게 하거나, 확장자가 뜻하지 않는 형식을 강제할 때 쓰면 됩니다.

```bash
chki18n ./locales --target en --output report.txt --reporter list
```

보고서를 쓰지 못하면 다른 오류와 마찬가지로 실행이 실패합니다. 없는 파일을 있다고 보고하는 일은 생기지 않습니다.

## 종료 코드

| 코드 | 의미                                                          |
| ---- | ------------------------------------------------------------- |
| `0`  | 오류 수준 이슈 없음. 경고는 출력됐을 수 있습니다.             |
| `1`  | 오류 수준 이슈가 하나 이상이거나, 디렉토리를 읽지 못했습니다. |

경고는 실행을 실패시키지 않습니다. 프로젝트에서 특정 경고를 차단 요소로 취급한다면 `--levels`로 승격하세요.

```bash
chki18n ./locales --target en --levels EMPTY_VALUE=error
```

## CI에서

GitHub Actions 스텝은 한 줄이면 됩니다.

::: lang js

```yaml
- name: Check translations
  run: npx chki18n ./locales --target en
```

:::

::: lang dart

```yaml
- uses: dart-lang/setup-dart@v1
- name: Check translations
  run: |
    dart pub global activate chki18n
    chki18n ./locales --target en
```

:::

::: lang py

```yaml
- uses: actions/setup-python@v5
- name: Check translations
  run: |
    pip install chki18n
    chki18n ./locales --target en
```

:::

경고를 정리하는 동안 작업을 통과 상태로 유지하려면, 이미 해결한 검사만 지정하세요.

```bash
chki18n ./locales --target en --checks NO_KEY,NO_INTERPOLATION_KEY
```

반대로, 시끄러운 검사 하나만 제외할 수도 있습니다.

```bash
chki18n ./locales --target en --ignore-checks DUPLICATE_VALUE
```

`--reporter github`는 각 이슈를 워크플로 명령으로 바꿉니다. GitHub이 이를 읽어 로그 한 줄이 아니라 번역 파일 위에 주석으로 표시합니다.

```bash
chki18n ./locales --target en --reporter github
```

```text
::error file=locales/ko.json,title=chki18n NO_KEY::ko attr.folder The key exists in the target language but is missing here. (en: "Folder")
::warning file=locales/ko.json,title=chki18n EMPTY_VALUE::ko attr.open The key is defined but its value is an empty string. (en: "Open")
```

`error`는 error 주석, `warn`은 warning, `info`는 notice가 됩니다. 줄 번호는 붙이지 않습니다. 검사는 파싱된 번역을 다루고, 가장 흔한 이슈가 애초에 파일에 없는 키이기 때문입니다. 주석은 파일을 가리킵니다.

작업 요약에는 마크다운 보고서가 어울립니다.

```bash
chki18n ./locales --target en --output "$GITHUB_STEP_SUMMARY" --reporter markdown
```

작업이 끝난 뒤에도 결과를 남기려면 파일로 쓰고 올리면 됩니다.

```yaml
- name: Check translations
  run: chki18n ./locales --target en --output translation-report.md
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: translation-report
    path: translation-report.md
```

## pre-commit 훅에서

```bash
#!/bin/sh
chki18n ./locales --target en --no-info || exit 1
```

`--no-info`는 머리말 블록과 요약을 없애고 이슈만 남깁니다. 문제가 없을 때는 조용해야 하는 훅에 알맞습니다. `--no-warn`은 한발 더 나아가 실행을 실패시키는 것만 남기며, 몇 건을 감췄는지는 보고서가 알려줍니다.

## 아무것도 찾지 못할 때

`--debug`는 해석된 옵션, 감지된 파일 구조, 그리고 읽었지만 로케일에 속하지 않아 건너뛴 파일을 출력합니다.

```bash
chki18n ./locales --debug
```

어떤 파일도 일치하지 않았다면 대개 파일 구조가 원인입니다. [파일 구조](./file-layouts)를 확인하고 `--format`으로 강제 지정해 보세요.
