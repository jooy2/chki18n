---
title: 파일 구조
---

# 파일 구조

번역 파일은 세 가지 방식 중 하나로 배치되며, chki18n은 별도로 알려주지 않아도 셋 모두를 인식합니다. 서로 다른 언어로 같은 키를 담고 있는 파일들은 하나의 그룹으로 묶여 비교되므로, 여러 번역 파일로 나뉜 프로젝트도 키가 한 덩어리로 뭉개지지 않고 파일 단위로 검사됩니다.

## 세 가지 구조

### `single` — 로케일당 파일 하나

가장 흔한 형태이며, 대부분의 i18n 설정이 여기서 시작합니다.

```text
locales/
  en.json
  ko.json
  ja.json
```

파일 이름이 곧 로케일입니다. 하위 폴더도 허용되며, 각각 별도의 그룹이 됩니다.

```text
locales/
  en.json
  ko.json
  admin/
    en.json
    ko.json
```

### `folder` — 로케일당 폴더 하나

`next-i18next`를 비롯한 네임스페이스 기반 설정이 사용하는 방식입니다.

```text
locales/
  en/
    common.json
    errors.json
  ko/
    common.json
    errors.json
```

폴더가 로케일이고 파일이 네임스페이스입니다. `common.json`과 `errors.json`은 서로 다른 그룹이므로, 한쪽에 없는 키가 다른 쪽 문제로 보고되지 않습니다.

### `nested` — 모든 로케일을 담은 파일 하나

```text
locales/
  translation.json
```

```json
{
	"en": { "desc": { "hello": "Hello" } },
	"ko": { "desc": { "hello": "안녕하세요" } }
}
```

최상위 키가 로케일입니다. 이런 파일이 여러 개 있어도 되며, 각각 별도의 그룹이 됩니다.

## 구조를 감지하는 방법

경로 모양만으로는 판단할 수 없습니다. `a/ko.json`과 `ko/common.json`은 둘 다 두 조각이기 때문입니다. 그래서 **어느 조각이 실제 로케일 코드인지**로 결정합니다.

1. 파일 이름이 로케일이면(`ko.json`) `single`.
2. 폴더 이름이 로케일이면(`ko/`) `folder`.
3. 둘 다 아니지만 파일의 최상위 키가 로케일이면 `nested`.

로케일 코드는 기본 언어 서브태그로 인식하므로 `en`, `en-US`, `pt_BR`, `zh-Hans` 모두 받아들입니다.

필요하면 직접 지정할 수 있습니다.

```bash
chki18n ./locales --format folder
```

::: lang js

```javascript
await checkTranslationFiles('./locales', { format: 'folder' });
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(format: Chki18nFileFormat.folder),
);
```

:::

::: lang py

```python
check_translation_files("./locales", Options(format="folder"))
```

:::

지정한 구조에 맞는 파일이 하나도 없으면, 아무것도 검사하지 않은 채 조용히 통과하는 대신 `INVALID_FILE` 오류로 보고됩니다.

## 그룹

**그룹**은 서로 다른 언어로 같은 키를 담고 있는 파일들의 묶음입니다. 모든 검사는 그룹 안에서만 이루어지며 그룹을 넘나들지 않습니다.

| 구조     | 경로                   | 그룹                | 로케일       |
| -------- | ---------------------- | ------------------- | ------------ |
| `single` | `en.json`              | `` (루트)           | `en`         |
| `single` | `admin/en.json`        | `admin`             | `en`         |
| `folder` | `en/common.json`       | `common.json`       | `en`         |
| `folder` | `admin/en/common.json` | `admin/common.json` | `en`         |
| `nested` | `translation.json`     | `translation.json`  | 각 최상위 키 |

덕분에 `common.json`에만 있는 키가 `errors.json`에서 누락된 것으로 보고되지 않습니다. 그룹이 하나뿐인 프로젝트(폴더 루트의 일반적인 `single` 구조)에서는 그룹 이름이 `''`이며, CLI는 빈 `@`를 출력하는 대신 아예 생략합니다.

그룹은 모든 이슈의 `issue.group`과 결과의 `result.groups`에 나타납니다.

## 검사 대상

`.json` 파일만 읽습니다. 이름이 `.`으로 시작하는 항목은 건너뛰며, 다음 디렉토리도 마찬가지입니다.

```text
node_modules  dist  build  out  coverage
.git  .next  .nuxt  .svelte-kit  .turbo  .cache
```

기본값이 맞지 않으면 직접 목록을 지정하세요.

```bash
chki18n ./locales --exclude tmp,vendor
```

::: lang js

```javascript
await checkTranslationFiles('./locales', { exclude: ['tmp', 'vendor'] });
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(exclude: ['tmp', 'vendor']),
);
```

:::

::: lang py

```python
check_translation_files("./locales", Options(exclude=["tmp", "vendor"]))
```

:::

`exclude`는 기본 목록에 **추가**하는 것이 아니라 **대체**합니다. 계속 제외하고 싶은 기본값이 있다면 함께 적어야 합니다.

읽었지만 로케일에 속하지 않는 파일은 조용히 건너뜁니다. `--debug`가 그 파일들을 모두 알려주며, 검사 결과가 비어 있는 이유를 찾는 가장 빠른 방법입니다.

## 중첩된 키

키는 비교 전에 평탄화되므로, 중첩 객체와 점으로 이어진 키는 같은 것입니다.

```json
{ "desc": { "hello": "Hello" } }
```

위 파일은 `desc.hello`로 비교됩니다. 모든 이슈가 이 형태로 키를 보고하며, [`session.get`](/ko/api/load-translations)과 [`checkEntry`](/ko/api/create-analyzer)도 이 형태를 기대합니다.
