---
title: 옵션
---

# 옵션

커맨드라인과 API는 같은 옵션을 받습니다. 모든 CLI 플래그는 같은 이름의 API 옵션이며, 하나의 정의에서 해석됩니다. 그래서 플래그와 옵션이 서로 어긋날 수 없고, CI에서 통과하는 것은 빌드 스크립트에서도 통과합니다.

옵션 이름은 JavaScript 표기로 적습니다. Dart도 같은 표기를 쓰고, Python은 전부 snake_case이므로 `ignoreChecks`는 `ignore_checks`, `maxKeyDepth`는 `max_key_depth`입니다. 이 대응은 [시작하기](./getting-started#언어별-이름-규칙)에 한 번 정리해 두었습니다.

## 전체 목록

| 옵션 | CLI 플래그 | 타입 | 기본값 |
| --- | --- | --- | --- |
| `path` | `--path` | `string` | — |
| `target` | `--target` | `string` | `'en'` |
| `format` | `--format` | `'auto' \| 'single' \| 'folder' \| 'nested'` | `'auto'` |
| `checks` | `--checks` | `string[]` 또는 쉼표로 구분된 문자열 | 전체 |
| `ignoreChecks` | `--ignore-checks` | `string[]` 또는 쉼표로 구분된 문자열 | 없음 |
| `levels` | `--levels` | `Record<code, level>` 또는 `CODE=level` 쌍 | 없음 |
| `interpolationPrefix` | `--interpolation-prefix` | `string` | `'{'` |
| `interpolationSuffix` | `--interpolation-suffix` | `string` | `'}'` |
| `exclude` | `--exclude` | `string[]` 또는 쉼표로 구분된 문자열 | 아래 참고 |
| `excludeFiles` | `--exclude-files` | `string[]` 또는 쉼표로 구분된 문자열 | 아래 참고 |
| `source` | `--source` | `string` | — |
| `translateFunctions` | `--translate-functions` | `string[]` 또는 쉼표로 구분된 문자열 | 아래 참고 |
| `keyCase` | `--key-case` | `'kebab' \| 'camel' \| 'snake'` | — |
| `maxKeyDepth` | `--max-key-depth` | `number` | — |
| `lengthRatio` | `--length-ratio` | `number` | — |
| `reporter` | `--reporter` | `'pretty' \| 'list' \| 'json' \| 'markdown' \| 'github'` | `'pretty'` |
| `groupBy` | `--group-by` | `'locale' \| 'code' \| 'group' \| 'file' \| 'none'` | `'locale'` |
| `output` | `--output` | `string` | — |
| `color` | `--no-color` | `boolean` | `true` |
| `width` | `--width` | `number` | 터미널 너비 |
| `info` | `--no-info` | `boolean` | `true` |
| `warn` | `--no-warn` | `boolean` | `true` |
| `debug` | `--debug` | `boolean` | `false` |
| `flattened` | — | `boolean` | `false` |
| `verbose` | — | `boolean` | `false` |

마지막 두 개는 API 전용입니다. CLI는 항상 출력하므로 `verbose`는 자동으로 켜지고, `flattened`는 디렉터리가 아니라 직접 전달하는 데이터를 설명하는 옵션입니다.

::: lang dart

Dart는 이 전부를 named parameter로 만드는 `Chki18nOptions` 객체 하나로 받으며, 값이 정해진 자리에는 열거형이 옵니다. `'folder'` 대신 `Chki18nFileFormat.folder`, `'NO_KEY'` 대신 `Chki18nCheckCode.noKey`입니다. 플래그가 쓰는 문자열 형태(`'NO_KEY,EMPTY_VALUE'`, `'EMPTY_VALUE=error'`)는 `Chki18nOptions.text`가 들고 있는 `Chki18nTextOptions`에 따로 있습니다. 덕분에 두 가지 타입을 함께 받는 필드가 하나도 없습니다.

:::

::: lang py

Python은 이 전부를 keyword-only `Options` 객체 하나로 받으며, 값이 정해진 자리도 다른 언어와 똑같은 문자열 그대로입니다. `format="folder"`, `checks=["NO_KEY"]`, `levels={"EMPTY_VALUE": "error"}`처럼 씁니다. 목록 옵션은 플래그가 주는 쉼표 구분 문자열도 받습니다.

:::

## 경로와 기준 언어

### `path`

번역 파일이 있는 디렉터리입니다. CLI에서는 위치 인자로도 받으므로 다음 둘은 같습니다.

```bash
chki18n ./locales
chki18n --path ./locales
```

상대 경로는 현재 작업 디렉터리를 기준으로 해석됩니다. 코드에서는 첫 번째 인자이며, `path` 옵션으로도 받습니다. 둘 다 주면 옵션이 우선하며, CLI가 위치 인자를 넘길 때 이 동작에 의존합니다.

### `target`

나머지 모든 언어가 비교될 언어, 즉 가장 먼저 작성하는 언어입니다. 기본값은 `en`이며, 기본값으로 대체된 실행은 실패하는 대신 `info` 수준으로 그 사실을 알립니다.

```bash
chki18n ./locales --target ko
```

검사한 파일 중에 기준 언어가 없으면 비교할 대상 자체가 없으므로, 조용히 통과하지 않고 오류가 됩니다.

## 파일 구조

### `format`

어떤 파일 구조로 읽을지 지정합니다. `auto`는 경로를 보고 판단하며 거의 항상 맞습니다. 감지가 잘못되거나, 구조가 어긋났을 때 분명하게 실패하도록 만들고 싶다면 직접 지정하세요.

```bash
chki18n ./locales --format folder
```

각 값의 의미는 [파일 구조](./file-layouts)를 참고하세요.

### `exclude`

검사 중 건너뛸 디렉터리입니다. 기본 목록에 추가하는 것이 아니라 **대체**합니다.

```text
node_modules  dist  build  out  coverage
.git  .next  .nuxt  .svelte-kit  .turbo  .cache
```

```bash
chki18n . --exclude node_modules,dist,fixtures
```

대체가 아니라 확장하고 싶다면 기본 목록이 `DEFAULT_EXCLUDE_DIRS`로 공개되어 있습니다.

::: lang js

```javascript
import { DEFAULT_EXCLUDE_DIRS } from 'chki18n';

await checkTranslationFiles('.', { exclude: [...DEFAULT_EXCLUDE_DIRS, 'fixtures'] });
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

await checkTranslationFiles(
  path: '.',
  options: const Chki18nOptions(exclude: [...defaultExcludeDirs, 'fixtures']),
);
```

:::

::: lang py

```python
from chki18n import DEFAULT_EXCLUDE_DIRS, Options, check_translation_files

check_translation_files(".", Options(exclude=[*DEFAULT_EXCLUDE_DIRS, "fixtures"]))
```

:::

한 조각짜리 항목은 어느 깊이에 있든 그 이름의 디렉터리를 가리킵니다. `node_modules`가 트리 안의 모든 `node_modules`를 뜻하는 이유입니다. 구분자가 들어간 항목은 검사 루트에서 시작하는 경로를 가리키며, 그 디렉터리와 그 아래 전부가 대상입니다. 다른 곳의 `legacy`는 남겨둔 채 프로젝트 자신의 `src/legacy`만 뺄 수 있습니다.

```bash
chki18n . --exclude node_modules,src/legacy
```

이름이 `.`으로 시작하는 항목은 이 설정과 무관하게 항상 건너뜁니다.

### `excludeFiles`

번역 파일로 읽지 않을 파일 이름입니다. `*`는 임의의 문자열을 뜻하고 대소문자는 구분하지 않습니다. 기본 목록에 추가하는 것이 아니라 **대체**합니다.

```text
package.json  tsconfig.json  tsconfig.*.json  eslintrc.json
*-lock.json   *-config.json  *.config.json
```

애플리케이션 루트에 흔한 설정 파일과 잠금 파일입니다. 로케일 폴더 대신 이 루트를 넘겨도 되는 이유가 여기에 있습니다. 이런 파일을 전부 읽고 파싱하면 비교 자체보다 비용이 더 큽니다.

```bash
chki18n . --exclude-files '*-lock.json,*.config.json,messages.json'
```

대체가 아니라 확장하고 싶다면 기본 목록이 <Lang js="DEFAULT_EXCLUDE_FILES" dart="defaultExcludeFiles" py="DEFAULT_EXCLUDE_FILES" code />로 공개되어 있습니다.

::: lang js

```javascript
import { DEFAULT_EXCLUDE_FILES } from 'chki18n';

await checkTranslationFiles('.', { excludeFiles: [...DEFAULT_EXCLUDE_FILES, 'messages.json'] });
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

await checkTranslationFiles(
  path: '.',
  options: const Chki18nOptions(excludeFiles: [...defaultExcludeFiles, 'messages.json']),
);
```

:::

::: lang py

```python
from chki18n import DEFAULT_EXCLUDE_FILES, Options, check_translation_files

check_translation_files(".", Options(exclude_files=[*DEFAULT_EXCLUDE_FILES, "messages.json"]))
```

:::

### `source`

키가 사용되는지 검색할 소스 파일 디렉터리입니다. [`UNUSED_KEY`](./checks#unused-key) 검사에 필요하며, 지정하지 않으면 그 검사는 아무것도 보고하지 않습니다.

```bash
chki18n ./locales --target en --source ./src
```

텍스트 파일만 읽고 5MB를 넘는 파일은 건너뛰며, `exclude`와 `excludeFiles`도 함께 적용됩니다. 프로젝트 자신의 번역 파일은 검색하지 않습니다.

[`UNDEFINED_KEY`](./checks#undefined-key)도 같은 디렉터리를 씁니다. 이쪽은 반대로, 소스가 부르는데 어느 언어 파일에도 없는 키를 찾습니다.

### `translateFunctions`

번역 호출의 이름 목록이며, `UNDEFINED_KEY`가 이 이름으로 소스가 부르는 키를 찾습니다. 기본 목록에 더하는 것이 아니라 **대체**합니다.

```text
t  $t  translate
```

이 셋으로 i18next, react-i18next, vue-i18n을 모두 처리할 수 있습니다. 이름이 끝나는 자리에서 호출을 찾으므로 `i18n.t`와 `useTranslation`이 넘겨준 `t`도 포함됩니다. `<Trans>` 컴포넌트의 `i18nKey` 속성은 항상 읽습니다.

```bash
chki18n ./locales --source ./src --translate-functions t,trans,__
```

대체가 아니라 확장하고 싶다면 기본 목록이 `TRANSLATION_FUNCTIONS`로 공개되어 있습니다.

## 키와 값의 기준

아래 세 옵션은 검사에 비교 기준을 주는 역할만 합니다. 값을 주기 전까지 해당 검사는 꺼져 있습니다. 셋 다 정답이 따로 없고 프로젝트가 정한 기준만 있기 때문입니다.

### `keyCase`

키의 각 단계를 어떤 표기법으로 적을지 정하며, [`KEY_NAMING`](./checks#key-naming)이 이 값과 비교합니다. `kebab`, `camel`, `snake` 중 하나입니다.

```bash
chki18n ./locales --key-case kebab
```

i18n 라이브러리가 붙이는 복수형과 문맥 접미사는 어떤 표기법에서도 통과합니다. `item-count_one`이나 `greeting_male`이 그렇습니다.

### `maxKeyDepth`

키를 몇 단계까지 중첩할 수 있는지 정하며 [`KEY_DEPTH`](./checks#key-depth)가 씁니다. `2`를 주면 `attr.folder`는 통과하고 `attr.folder.name`은 보고합니다.

```bash
chki18n ./locales --max-key-depth 2
```

### `lengthRatio`

값이 원문보다 몇 배까지 길거나 짧아도 되는지 정하며 [`SUSPICIOUS_LENGTH`](./checks#suspicious-length)가 씁니다. `4`를 주면 4분의 1에서 4배까지 허용합니다.

```bash
chki18n ./locales --length-ratio 4
```

길이는 글자 수가 아니라 칸 수로 세므로 한국어나 일본어 값이 무조건 짧게 나오지는 않습니다. 원문이 여덟 칸 미만이면 건너뜁니다.

## 검사 선택

### `checks`

지정한 검사만 실행합니다. 배열이나 쉼표로 구분된 문자열을 받으며, 대소문자를 가리지 않습니다.

```bash
chki18n ./locales --checks NO_KEY,NO_INTERPOLATION_KEY
```

::: lang js

```javascript
await checkTranslationFiles('./locales', { checks: ['NO_KEY', 'NO_INTERPOLATION_KEY'] });
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(
    checks: [Chki18nCheckCode.noKey, Chki18nCheckCode.noInterpolationKey],
  ),
);
```

:::

::: lang py

```python
check_translation_files("./locales", Options(checks=["NO_KEY", "NO_INTERPOLATION_KEY"]))
```

:::

### `ignoreChecks`

지정한 검사만 빼고 실행합니다.

```bash
chki18n ./locales --ignore-checks DUPLICATE_VALUE
```

둘을 함께 쓸 수는 없습니다. `checks`가 우선하며, `ignoreChecks`가 무시되었다는 `INVALID_OPTIONS` 이슈가 남습니다. 알 수 없는 코드도 같은 방식으로 보고되고 건너뜁니다. 플래그 하나의 오타가 나머지 검사까지 멈춰서는 안 되기 때문입니다.

### `levels`

검사를 다른 심각도로 보고합니다. 객체나 `CODE=level` 쌍을 받습니다.

```bash
chki18n ./locales --levels EMPTY_VALUE=error,DUPLICATE_VALUE=info
```

::: lang js

```javascript
await checkTranslationFiles('./locales', { levels: { EMPTY_VALUE: 'error' } });
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(
    levels: {Chki18nCheckCode.emptyValue: Chki18nLevel.error},
  ),
);
```

:::

::: lang py

```python
check_translation_files("./locales", Options(levels={"EMPTY_VALUE": "error"}))
```

:::

비교 검사만 변경할 수 있습니다. `INVALID_FILE`과 `INVALID_OPTIONS`는 실행 자체가 어떻게 됐는지를 알리는 항목이라 심각도를 유지합니다.

## 보간

### `interpolationPrefix` / `interpolationSuffix`

자리 표시자를 감싸는 구분자입니다. 기본값은 `{`와 `}`이며, 실제 프로젝트에서는 `{{ }}`, `[[ ]]`, `%{ }`도 흔합니다.

```bash
chki18n ./locales --interpolation-prefix "{{" --interpolation-suffix "}}"
```

이 값을 잘못 지정하면 자리 표시자가 인식되지 않습니다. 그러면 두 보간 검사가 아무것도 찾지 못한 채 조용히 통과합니다.

## 출력

### `reporter`

리포트의 모양입니다. 터미널용 `pretty`, 이슈 한 건에 한 줄인 `list`, 다른 프로그램에 넘기는 `json`, 표로 만드는 `markdown`, 그리고 GitHub Actions가 파일에 주석으로 다는 워크플로 명령을 내보내는 `github` 중 하나입니다. 어떤 리포터든 같은 이슈를 같은 순서로 담습니다.

```bash
chki18n ./locales --reporter json > report.json
```

::: lang js

```javascript
import { formatResult, resolveOptions } from 'chki18n';

const { options } = resolveOptions({ target: 'en', reporter: 'markdown' });

formatResult(result, options); // 리포트 문자열
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

final resolved = resolveOptions(
  const Chki18nOptions(target: 'en', reporter: Chki18nReporter.markdown),
);

formatResult(result, resolved.options); // 리포트 문자열
```

:::

::: lang py

```python
from chki18n import Options, format_result, resolve_options

options, _ = resolve_options(Options(target="en", reporter="markdown"))

format_result(result, options)  # 리포트 문자열
```

:::

`pretty`가 아닌 형식은 배너도 진행 상황 줄도 없이 리포트만 출력하므로 다른 프로그램으로 그대로 넘길 수 있습니다. 모르는 이름을 주면 `INVALID_OPTIONS` 이슈로 알리고 `pretty`로 돌아갑니다.

### `groupBy`

리포트의 구획을 무엇으로 나눌지 정합니다. `locale`(기본값), `code`, `group`, `file`, `none` 중 하나입니다. 언어로 나누면 번역가의 작업 단위와 맞고, 검사로 나누면 관리자가 한 번에 고치는 단위와 맞습니다.

```bash
chki18n ./locales --group-by code
```

오류가 있는 구획이 먼저 오고 그다음이 경고만 있는 구획입니다. 파일이 같으면 순서도 같으므로, 같은 번역을 두 번 검사한 리포트를 줄 단위로 비교할 수 있습니다.

직접 묶고 싶다면 <Lang js="groupIssues" dart="groupIssues" py="group_issues" code />가 공개되어 있습니다.

::: lang js

```javascript
import { groupIssues } from 'chki18n';

groupIssues(result.issues, 'locale'); // [{ id, label, issues, counts }, ...]
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

groupIssues(result.issues, Chki18nGroupBy.locale); // [Chki18nIssueGroup, ...]
```

:::

::: lang py

```python
from chki18n import group_issues

group_issues(result.issues, "locale")  # [IssueGroup(id=…, label=…, issues=…, counts=…), …]
```

:::

### `output`

터미널에 더해 리포트를 쓸 파일입니다. 형식은 확장자가 정하며, `.json`과 `.md`는 각자의 형식이 있고 나머지는 평문입니다. 둘 다 주면 `reporter`가 이깁니다.

```bash
chki18n ./locales --output report.md
```

없는 디렉터리는 만들어 주고, 색상 코드는 쓰지 않으며, 터미널 너비 대신 고정 너비로 배치합니다. 어디서 실행하든 같은 파일이 나옵니다. 쓰기에 실패하면 오류로 보고하고 실행도 실패합니다.

### `color`

터미널 리포트에 색을 입힐지 여부입니다. 터미널이 지원하면 기본으로 켜지고 `--no-color`로 끕니다. `output`으로 쓰는 파일은 이 값과 상관없이 색이 들어가지 않습니다.

### `width`

리포트를 배치할 칸 수입니다. 지정하지 않으면 터미널 너비, 그다음 `COLUMNS`, 그다음 96을 씁니다. 잰 너비는 120칸에서 자릅니다. 그보다 벌어지면 라벨과 집계가 한 줄로 읽히지 않기 때문입니다. `width`로 직접 준 값에는 상한이 없습니다.

```bash
chki18n ./locales --width 72
```

설명은 잘리지 않고 다음 줄로 넘어가므로 좁은 리포트에서도 문장이 사라지지 않습니다. `output`으로 쓰는 파일은 터미널을 보지 않고 고정 기본값을 쓰며, `width`를 주면 그 값을 씁니다. 어디서 실행하든 같은 파일이 나옵니다.

### `info`, `warn`, `debug`

CLI가 무엇을 출력할지 결정합니다. `--no-info`는 머리말 블록과 요약을, `--no-warn`은 경고 수준 이슈를 없애고, `--debug`는 해석된 옵션과 감지된 구조, 건너뛴 파일을 추가로 보여줍니다.

```bash
chki18n ./locales --no-info
```

출력에만 영향을 줍니다. 숨겨진 경고도 `result.issues`에 그대로 있고 `result.summary`에도 집계되며, 결과를 그대로 담는 `json` 리포트에도 남습니다. 무언가를 감췄다면 리포트가 몇 건인지 알려줍니다.

`--debug`는 표준 오류로 나가므로, 표준 출력으로 넘긴 리포트에 섞이지 않습니다.

### `verbose`

API 전용입니다. 이 옵션을 켜지 않으면 라이브러리는 아무것도 출력하지 않으므로, import만으로 호스트 애플리케이션의 출력을 오염시키지 않습니다. CLI는 자동으로 켭니다.

::: lang js

```javascript
await checkTranslationFiles('./locales', { verbose: true });
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(verbose: true),
);
```

:::

::: lang py

```python
check_translation_files("./locales", Options(verbose=True))
```

:::

## 데이터

### `flattened`

API 전용입니다. 전달하는 번역 데이터가 이미 평탄한 키(`'desc.hello'`)를 쓰고 있어 평탄화 단계를 건너뛰어도 된다는 뜻입니다. 이미 가지고 있는 데이터를 추가 할당 없이 분석하게 해주는 옵션입니다.

::: lang js

```javascript
analyzeTranslations({ locales: { en, ko } }, { target: 'en', flattened: true });
```

:::

::: lang dart

```dart
analyzeTranslations(
  Chki18nInput(locales: {'en': en, 'ko': ko}),
  options: const Chki18nOptions(target: 'en', flattened: true),
);
```

:::

::: lang py

```python
analyze_translations(Input(locales={"en": en, "ko": ko}), Options(target="en", flattened=True))
```

:::

데이터가 실제로는 중첩되어 있는데 이 옵션을 켜도 오류는 나지 않습니다. 다만 최상위 키만 비교하게 되어 거의 아무것도 찾지 못합니다.

## 옵션 직접 해석하기

<Lang js="resolveOptions" dart="resolveOptions" py="resolve_options" code />는 기본값을 채우고 느슨한 형태를 정규화하며, 사용할 수 없는 값은 예외를 던지는 대신 보고합니다.

::: lang js

```javascript
import { argsToOptions, resolveOptions } from 'chki18n';

const { options, issues } = resolveOptions({ target: 'ko', ignoreChecks: 'NO_KEY' });

options.enabledChecks; // 실행될 코드의 Set
issues; // 사용할 수 없었던 값들, INVALID_OPTIONS 이슈로

// CLI 형태도 정확히 같은 결과로 해석됩니다
resolveOptions(argsToOptions({ _: [], target: 'ko', 'ignore-checks': 'NO_KEY' }));
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

final resolved = resolveOptions(
  const Chki18nOptions(target: 'ko', ignoreChecks: [Chki18nCheckCode.noKey]),
);

resolved.options.enabledChecks; // 실행될 코드의 Set
resolved.issues; // 사용할 수 없었던 값들, INVALID_OPTIONS 이슈로

// CLI 형태도 정확히 같은 결과로 해석됩니다
resolveOptions(optionsFromArgs({'_': <String>[], 'target': 'ko', 'ignore-checks': 'NO_KEY'}));
```

:::

::: lang py

```python
from chki18n import Options, options_from_args, resolve_options

options, issues = resolve_options(Options(target="ko", ignore_checks="NO_KEY"))

options.enabled_checks  # 실행될 코드의 frozenset
issues  # 사용할 수 없었던 값들, INVALID_OPTIONS 이슈로

# CLI 형태도 정확히 같은 결과로 해석됩니다
resolve_options(options_from_args({"_": [], "target": "ko", "ignore-checks": "NO_KEY"}))
```

:::

직접 UI나 도움말을 만든다면, 양쪽이 파생되는 원본 테이블이 <Lang js="OPTION_DEFINITIONS" dart="optionDefinitions" py="OPTION_DEFINITIONS" code />로 공개되어 있습니다.
