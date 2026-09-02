---
title: 검사 항목
---

# 검사 항목

chki18n이 보고하는 모든 문제에는 검사 코드, 심각도, 그리고 설명 문장이 붙습니다. 오류는 실행을 실패시키고, 경고는 보고만 됩니다. 이 페이지는 모든 검사와 각각이 무엇을 잡아내는지, 그리고 어떤 경우에 꺼둘 만한지를 정리합니다.

## 한눈에 보기

| 심각도 | 코드                      | 잡아내는 것                                          |
| ------ | ------------------------- | ---------------------------------------------------- |
| 오류   | `INVALID_FILE`            | 읽거나 파싱하지 못했거나 로케일에 연결되지 않는 파일 |
| 오류   | `NO_KEY`                  | 기준 언어에는 있고 이 로케일에는 없는 키             |
| 오류   | `NO_INTERPOLATION_KEY`    | 기준 언어에는 있고 이 값에는 없는 자리표시자         |
| 오류   | `EXTRA_INTERPOLATION_KEY` | 이 값에는 있고 기준 언어에는 없는 자리표시자         |
| 경고   | `DUMMY_KEY`               | 이 로케일에는 있고 기준 언어에는 없는 키             |
| 경고   | `EMPTY_VALUE`             | 빈 문자열로 정의된 키                                |
| 경고   | `NOT_TRANSLATED_VALUE`    | 기준 언어와 값이 동일                                |
| 경고   | `DUPLICATE_VALUE`         | 한 로케일 안에서 값이 같은 두 키                     |
| 경고   | `SURROUNDING_WHITESPACE`  | 앞이나 뒤에 공백이 있는 값                           |
| 경고   | `MISSING_NUMBER`          | 기준 언어 값의 숫자가 번역에서 빠짐                  |
| 경고   | `INVALID_VALUE_TYPE`      | 문자열이 아닌 값                                     |

`INVALID_OPTIONS`도 결과에 나타나며, 상황에 맞는 수준을 갖습니다. 옵션이 단순히 기본값으로 대체되면 `info`, 기준 언어가 파일에 전혀 없어 비교 대상이 없으면 `error`입니다.

## 구조 검사

### `NO_KEY`

기준 언어에는 키가 정의되어 있는데 이 로케일에는 없는 경우입니다. 가장 흔한 발견이자 빌드를 실패시킬 가치가 가장 큰 항목입니다. 누락된 키는 사용자에게 번역되지 않은 문자열로 보이거나, i18n 런타임에 따라 오류로 이어집니다.

```json
// en.json
{ "attr": { "folder": "Folder" } }
// ko.json
{ "attr": {} }
```

```text
[NO_KEY] ko -> 'attr.folder' (en: "Folder")
```

### `DUMMY_KEY`

반대 경우입니다. 이 로케일에는 있는데 기준 언어에는 없는 키입니다. 보통 원본 언어에서 이름이 바뀌거나 삭제된 키가 번역 쪽에 남아 있는 것으로, 결함이라기보다 잔여물이기 때문에 경고입니다.

```json
// en.json
{ "attr": { "folder": "Folder" } }
// ko.json
{ "attr": { "folder": "폴더", "legacy": "예전 문구" } }
```

```text
[DUMMY_KEY] ko -> 'attr.legacy' (ko: "예전 문구")
```

### `INVALID_FILE`

읽지 못했거나, 비어 있거나, JSON으로 파싱되지 않거나, `format`으로 구조를 강제했을 때 일치하는 파일이 하나도 없는 경우입니다. 비교보다 먼저 보고되며 항상 오류입니다. 읽지 못한 파일은 통과한 파일이 아니기 때문입니다.

## 값 검사

### `EMPTY_VALUE`

키는 정의되어 있지만 값이 `""`인 경우입니다. 나중에 채우려고 자리만 만들어 둔 경우가 많고, 그런 것이 실수로 배포되곤 합니다. 기본은 경고이며, 빈 문자열을 누락된 번역으로 취급하는 프로젝트라면 승격하세요.

```bash
npx chki18n ./locales --levels EMPTY_VALUE=error
```

### `NOT_TRANSLATED_VALUE`

값이 기준 언어와 완전히 동일한 경우입니다. 번역이 아직 안 됐거나, `OK`나 `Wi-Fi`, 제품명처럼 두 언어에서 실제로 같은 단어이거나 둘 중 하나입니다. 둘 다 흔하기 때문에 오류가 아닌 경고입니다.

```json
// en.json
{ "desc": { "same": "Same" } }
// ko.json
{ "desc": { "same": "Same" } }
```

정당하게 동일한 문자열이 많은 프로젝트라면 꺼두는 것이 합리적입니다.

```bash
npx chki18n ./locales --ignore-checks NOT_TRANSLATED_VALUE
```

### `SURROUNDING_WHITESPACE`

값이 공백으로 시작하거나 끝나는 경우입니다. 거의 항상 실수이며, 복사·붙여넣기에서 살아남은 뒤쪽 공백이 대표적입니다. diff에서는 눈에 잘 띄지 않으면서 레이아웃 문제로 드러납니다.

```json
{ "attr": { "trim": " Folder " } }
```

### `MISSING_NUMBER`

기준 언어 값에는 숫자가 있는데 번역에는 없는 경우입니다. `You have 3 items`가 `여러 개 있습니다`가 되는 식으로 번역 중 숫자가 사라진 것을 잡아냅니다. 휴리스틱이므로 경고이며, 숫자를 일부러 풀어 쓴 번역도 걸립니다.

### `INVALID_VALUE_TYPE`

값이 문자열이 아닌 경우입니다. 숫자, 불리언, `null`, 또는 평탄화 후에도 남은 객체입니다. 대부분의 i18n 런타임은 문자열을 기대하며, `null`은 그 파일을 쓴 쪽의 버그입니다. 일부 설정에서는 배열과 숫자에도 정당한 쓰임이 있어 경고로 둡니다.

### `DUPLICATE_VALUE`

같은 로케일 안의 두 키가 같은 값을 갖는 경우입니다. 정리할 만한 중복일 때도 있고, 우연히 표현이 같아진 서로 다른 문자열일 때도 있습니다. 이슈의 `relatedKey`에 그 값을 먼저 사용한 키가 담깁니다.

```text
[DUPLICATE_VALUE] ko -> 'dup-b' (en: "Beta") The key `dup-a` in the same locale already uses this value.
```

이 검사만은 로케일 전체를 한 번에 봐야 하므로, 키 하나씩 받는 [`checkEntry`](/ko/api/create-analyzer)에서는 **보고되지 않습니다**. 그런 성질을 가진 코드는 `CROSS_KEY_CHECK_CODES`에 정리되어 있습니다.

## 보간 검사

보간 키는 문자열 안의 자리표시자입니다. 기본값은 `{name}` 형태입니다. 비교 양쪽에서 자리표시자를 추출해 두 집합을 비교하므로, 문장과 함께 번역되어 버린 자리표시자를 잡아냅니다.

### `NO_INTERPOLATION_KEY`

기준 언어 값에는 있는 자리표시자가 이 값에는 없는 경우입니다. 런타임에 치환되지 않는 변수가 되므로 오류입니다.

```json
// en.json
{ "desc": { "hello": "Hello {name}" } }
// ko.json
{ "desc": { "hello": "안녕하세요" } }
```

```text
[NO_INTERPOLATION_KEY] ko -> 'desc.hello' (en: "Hello {name}")
  The interpolation key `{name}` of the target language is missing from this value.
```

### `EXTRA_INTERPOLATION_KEY`

반대로, 기준 언어가 정의하지 않은 자리표시자가 이 값에 있는 경우입니다. 보통 오타(`{nmae}`)이거나 번역 중에 만들어진 자리표시자이며, 런타임에는 중괄호가 그대로 렌더링됩니다.

### 구분자 바꾸기

기본 구분자는 `{`와 `}`입니다. 프로젝트가 `{{ }}`를 쓴다면 반드시 알려주세요. 그러지 않으면 자리표시자가 전혀 인식되지 않고 두 보간 검사가 조용히 통과합니다.

```bash
npx chki18n ./locales --interpolation-prefix "{{" --interpolation-suffix "}}"
```

```javascript
await checkTranslationFiles('./locales', {
	interpolationPrefix: '{{',
	interpolationSuffix: '}}'
});
```

## 실행할 검사 고르기

일부만 실행하기:

```bash
npx chki18n ./locales --checks NO_KEY,NO_INTERPOLATION_KEY
```

일부만 빼고 실행하기:

```bash
npx chki18n ./locales --ignore-checks DUPLICATE_VALUE,MISSING_NUMBER
```

둘을 함께 쓸 수는 없습니다. `checks`가 우선하며 `ignoreChecks`는 무시되었다고 보고됩니다. `INVALID_FILE`과 `INVALID_OPTIONS`는 어느 목록에도 속하지 않습니다. 실행 자체가 어떻게 됐는지를 알리는 항목이라 끌 수 없습니다.

## 심각도 바꾸기

모든 비교 검사는 심각도를 다시 지정할 수 있습니다. 무엇이 빌드를 막을지 프로젝트가 스스로 정하는 방법입니다.

```bash
npx chki18n ./locales --levels EMPTY_VALUE=error,DUPLICATE_VALUE=info
```

```javascript
await checkTranslationFiles('./locales', {
	levels: { EMPTY_VALUE: 'error', DUPLICATE_VALUE: 'info' }
});
```

수준은 `error`, `warn`, `info`입니다. `error`만 실행을 실패시키므로, `info`로 낮추면 아무것도 막지 않으면서 리포트에는 계속 남습니다. `INVALID_FILE`과 `INVALID_OPTIONS`는 변경할 수 없습니다.

## 코드에서 검사 정보 읽기

검사 코드와 메타데이터가 export되어 있어, UI가 문자열을 하드코딩할 필요가 없습니다.

```javascript
import { ANALYZE_CHECK_CODES, CHECK_CODE, CHECK_META } from 'chki18n';

CHECK_META[CHECK_CODE.NO_KEY];
// {
//   level: 'error',
//   summary: 'Some translation files did not include the following keys',
//   description: 'The key exists in the target language but is missing here.'
// }

ANALYZE_CHECK_CODES; // 번역을 비교하는 모든 코드, 리포트 순서대로
```

`summary`는 여러 발생 건을 묶는 제목이고, `description`은 한 건을 설명합니다. 이 둘이 어떻게 쓰이는지는 [결과 객체](/ko/reference/result)를 참고하세요.
