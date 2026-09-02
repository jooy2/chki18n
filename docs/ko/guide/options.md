---
title: 옵션
---

# 옵션

커맨드라인과 JavaScript API는 같은 옵션을 받습니다. 모든 CLI 플래그는 camelCase로 된 같은 이름의 API 옵션이며, 하나의 정의에서 해석됩니다. 그래서 플래그와 옵션이 서로 어긋날 수 없고, CI에서 통과하는 것은 빌드 스크립트에서도 통과합니다.

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
| `info` | `--no-info` | `boolean` | `true` |
| `warn` | `--no-warn` | `boolean` | `true` |
| `debug` | `--debug` | `boolean` | `false` |
| `flattened` | — | `boolean` | `false` |
| `verbose` | — | `boolean` | `false` |

마지막 두 개는 API 전용입니다. CLI는 항상 출력하므로 `verbose`는 자동으로 켜지고, `flattened`는 디렉토리가 아니라 직접 전달하는 데이터를 설명하는 옵션입니다.

## 경로와 기준 언어

### `path`

번역 파일이 있는 디렉토리입니다. CLI에서는 위치 인자로도 받으므로 다음 둘은 같습니다.

```bash
npx chki18n ./locales
npx chki18n --path ./locales
```

상대 경로는 현재 작업 디렉토리를 기준으로 해석됩니다. JavaScript에서는 첫 번째 인자이며, `{ path }`로도 받습니다.

### `target`

나머지 모든 언어가 비교될 언어, 즉 가장 먼저 작성하는 언어입니다. 기본값은 `en`이며, 기본값으로 대체된 실행은 실패하는 대신 `info` 수준으로 그 사실을 알립니다.

```bash
npx chki18n ./locales --target ko
```

검사한 파일 중에 기준 언어가 없으면 비교할 대상 자체가 없으므로, 조용히 통과하지 않고 오류가 됩니다.

## 파일 구조

### `format`

어떤 디스크 구조로 읽을지 지정합니다. `auto`는 경로에서 판단하며 거의 항상 맞습니다. 감지가 잘못되거나 구조 불일치를 명시적으로 실패시키고 싶을 때 지정하세요.

```bash
npx chki18n ./locales --format folder
```

각 값의 의미는 [파일 구조](./file-layouts)를 참고하세요.

### `exclude`

검사 중 건너뛸 디렉토리 이름입니다. 기본 목록에 추가하는 것이 아니라 **대체**합니다.

```text
node_modules  dist  build  out  coverage
.git  .next  .nuxt  .svelte-kit  .turbo  .cache
```

```bash
npx chki18n . --exclude node_modules,dist,fixtures
```

대체가 아니라 확장하고 싶다면 기본 목록이 `DEFAULT_EXCLUDE_DIRS`로 export되어 있습니다.

```javascript
import { DEFAULT_EXCLUDE_DIRS } from 'chki18n';

await checkTranslationFiles('.', { exclude: [...DEFAULT_EXCLUDE_DIRS, 'fixtures'] });
```

이름이 `.`으로 시작하는 항목은 이 설정과 무관하게 항상 건너뜁니다.

## 검사 선택

### `checks`

지정한 검사만 실행합니다. 배열이나 쉼표로 구분된 문자열을 받으며, 대소문자를 가리지 않습니다.

```bash
npx chki18n ./locales --checks NO_KEY,NO_INTERPOLATION_KEY
```

```javascript
await checkTranslationFiles('./locales', { checks: ['NO_KEY', 'NO_INTERPOLATION_KEY'] });
```

### `ignoreChecks`

지정한 검사만 빼고 실행합니다.

```bash
npx chki18n ./locales --ignore-checks DUPLICATE_VALUE
```

둘을 함께 쓸 수는 없습니다. `checks`가 우선하며, `ignoreChecks`가 무시되었다는 `INVALID_OPTIONS` 이슈가 남습니다. 알 수 없는 코드도 같은 방식으로 보고되고 건너뜁니다. 플래그 하나의 오타가 나머지 검사까지 멈춰서는 안 되기 때문입니다.

### `levels`

검사를 다른 심각도로 보고합니다. 객체나 `CODE=level` 쌍을 받습니다.

```bash
npx chki18n ./locales --levels EMPTY_VALUE=error,DUPLICATE_VALUE=info
```

```javascript
await checkTranslationFiles('./locales', { levels: { EMPTY_VALUE: 'error' } });
```

비교 검사만 변경할 수 있습니다. `INVALID_FILE`과 `INVALID_OPTIONS`는 실행 자체가 어떻게 됐는지를 알리는 항목이라 심각도를 유지합니다.

## 보간

### `interpolationPrefix` / `interpolationSuffix`

자리표시자를 감싸는 구분자입니다. 기본값은 `{`와 `}`이며, 실제 프로젝트에서는 `{{ }}`, `[[ ]]`, `%{ }`도 흔합니다.

```bash
npx chki18n ./locales --interpolation-prefix "{{" --interpolation-suffix "}}"
```

이 값을 잘못 지정하면 틀린 답이 나오는 것이 아니라 아무 답도 나오지 않습니다. 자리표시자가 인식되지 않아 두 보간 검사가 아무것도 찾지 못하고 조용히 통과합니다.

## 출력

### `info`, `warn`, `debug`

CLI가 무엇을 출력할지 결정합니다. `--no-info`는 진행 상황 줄을, `--no-warn`은 경고 수준 출력을 없애고, `--debug`는 해석된 옵션과 감지된 구조, 건너뛴 파일을 추가로 보여줍니다.

```bash
npx chki18n ./locales --no-info
```

출력에만 영향을 줍니다. 숨겨진 경고도 `result.issues`에 그대로 있고 `result.summary`에도 집계됩니다.

### `verbose`

API 전용입니다. 이 옵션을 켜지 않으면 라이브러리는 아무것도 출력하지 않으므로, import만으로 호스트 애플리케이션의 출력을 오염시키지 않습니다. CLI는 자동으로 켭니다.

```javascript
await checkTranslationFiles('./locales', { verbose: true });
```

## 데이터

### `flattened`

API 전용입니다. 전달하는 번역 데이터가 이미 평탄한 키(`'desc.hello'`)를 쓰고 있어 평탄화 단계를 건너뛰어도 된다는 뜻입니다. 이미 가지고 있는 데이터를 추가 할당 없이 분석하게 해주는 옵션입니다.

```javascript
analyzeTranslations({ locales: { en, ko } }, { target: 'en', flattened: true });
```

데이터가 실제로는 중첩되어 있는데 이 옵션을 켜도 오류는 나지 않습니다. 다만 최상위 키만 비교하게 되어 거의 아무것도 찾지 못합니다.

## 옵션 직접 해석하기

`resolveOptions`는 기본값을 채우고 느슨한 형태를 정규화하며, 사용할 수 없는 값은 예외를 던지는 대신 보고합니다.

```javascript
import { argsToOptions, resolveOptions } from 'chki18n';

const { options, issues } = resolveOptions({ target: 'ko', ignoreChecks: 'NO_KEY' });

options.enabledChecks; // 실행될 코드의 Set
issues; // 사용할 수 없었던 값들, INVALID_OPTIONS 이슈로

// CLI 형태도 정확히 같은 결과로 해석됩니다
resolveOptions(argsToOptions({ _: [], target: 'ko', 'ignore-checks': 'NO_KEY' }));
```

직접 UI나 도움말을 만든다면, 양쪽이 파생되는 원본 테이블이 `OPTION_DEFINITIONS`로 export되어 있습니다.
