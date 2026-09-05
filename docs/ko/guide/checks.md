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
| 오류   | `NO_INTERPOLATION_KEY`    | 기준 언어에는 있고 이 값에는 없는 자리 표시자        |
| 오류   | `EXTRA_INTERPOLATION_KEY` | 이 값에는 있고 기준 언어에는 없는 자리 표시자        |
| 오류   | `DUPLICATE_KEY`           | 두 번 정의되어 한쪽 값이 사라지는 키                 |
| 경고   | `DUMMY_KEY`               | 이 로케일에는 있고 기준 언어에는 없는 키             |
| 경고   | `EMPTY_VALUE`             | 빈 문자열로 정의된 키                                |
| 경고   | `NOT_TRANSLATED_VALUE`    | 기준 언어와 값이 동일                                |
| 경고   | `DUPLICATE_VALUE`         | 한 로케일 안에서 값이 같은 두 키                     |
| 경고   | `SURROUNDING_WHITESPACE`  | 앞이나 뒤에 공백이 있는 값                           |
| 경고   | `MISSING_NUMBER`          | 기준 언어 값의 숫자가 번역에서 빠짐                  |
| 경고   | `INVALID_VALUE_TYPE`      | 문자열이 아닌 값                                     |
| 오류   | `NO_LOCALE`               | 다른 그룹에는 있는 언어의 파일이 이 그룹에는 없음    |
| 오류   | `INTERPOLATION_COUNT`     | 자리 표시자를 쓴 횟수가 기준 언어와 다름             |
| 경고   | `TAG_MISMATCH`            | 기준 언어에는 있고 이 값에는 없는 마크업             |
| 경고   | `UNTRANSLATED_SCRIPT`     | 그 언어의 문자가 하나도 없는 값                      |
| 경고   | `INCONSISTENT_VALUE`      | 원문이 같은 두 키가 서로 다르게 번역됨               |
| 경고   | `INVISIBLE_CHARACTER`     | 폭이 없는 문자, 양방향 제어문자, 줄바꿈 없는 공백    |
| 경고   | `NUMBER_MISMATCH`         | 번역이 숫자를 빠뜨리지 않고 바꿈                     |
| 경고   | `KEY_NAMING`              | `keyCase`가 정한 표기법을 따르지 않는 키             |
| 경고   | `KEY_DEPTH`               | `maxKeyDepth`보다 깊게 중첩된 키                     |
| 참고   | `SUSPICIOUS_LENGTH`       | 기준 언어보다 지나치게 길거나 짧은 값                |
| 참고   | `UNUSED_KEY`              | 검사한 소스 어디에서도 참조하지 않는 키              |
| 경고   | `UNDEFINED_KEY`           | 소스가 부르는데 어느 언어 파일에도 없는 키           |
| 경고   | `NO_PLURAL_FORM`          | 그 언어에 필요한 복수형이 파일에 없음                |

`KEY_NAMING`, `KEY_DEPTH`, `SUSPICIOUS_LENGTH`는 각각 `keyCase`, `maxKeyDepth`, `lengthRatio`를 지정하기 전까지 아무것도 보고하지 않습니다. 셋 다 정답이 하나로 정해지지 않고 프로젝트가 고르는 값이기 때문입니다. `UNUSED_KEY`와 `UNDEFINED_KEY`에는 검색할 `source` 디렉터리가 필요합니다.

`INVALID_OPTIONS`도 결과에 나타나며, 상황에 맞는 수준을 갖습니다. 옵션이 단순히 기본값으로 대체되면 `info`, 기준 언어가 파일에 전혀 없어 비교 대상이 없으면 `error`입니다.

## 기준 언어

다른 언어는 모두 기준 언어와 비교하므로, 대부분의 검사는 기준 언어 자신에게 물을 것이 없습니다. 자기가 정의한 키를 빠뜨릴 수 없고, 자기가 쓴 자리 표시자와 다르게 쓸 수도 없습니다. 값 하나만 읽으면 되는 검사는 다릅니다. 원문 언어도 사람이 손으로 쓰는 만큼 같은 실수가 섞이고, 검사하지 않으면 그대로 남습니다.

| 코드                     | 기준 언어에서 잡아내는 것                         |
| ------------------------ | ------------------------------------------------- |
| `EMPTY_VALUE`            | 빈 문자열로 정의된 키                             |
| `SURROUNDING_WHITESPACE` | 앞이나 뒤에 공백이 있는 값                        |
| `INVISIBLE_CHARACTER`    | 폭이 없는 문자, 양방향 제어문자, 줄바꿈 없는 공백 |
| `INVALID_VALUE_TYPE`     | 문자열이 아닌 값                                  |
| `UNTRANSLATED_SCRIPT`    | 기준 언어 자신의 문자가 하나도 없는 값            |

값이 아니라 키를 보는 검사인 `DUPLICATE_KEY`, `KEY_NAMING`, `KEY_DEPTH`, `UNUSED_KEY`, `UNDEFINED_KEY`는 애초에 특정 언어에 매이지 않고, `DUPLICATE_VALUE`와 `NO_PLURAL_FORM`은 이미 기준 언어를 포함한 모든 언어에 물어 왔습니다.

다섯 가지 중 `error`로 보고하는 것은 없습니다. 그래서 여태 검사한 적 없던 원문 언어 때문에 빌드가 갑자기 실패하지는 않습니다. 끄고 싶으면 다른 언어와 똑같이 `ignoreChecks`로 끄면 되고, 기준 언어만 따로 끄는 스위치는 없습니다.

## 구조 검사

### `NO_LOCALE`

다른 그룹에는 있는 언어인데 이 그룹에는 파일이 없습니다. 파일 하나를 통째로 만들지 않았을 때 나오는 이슈입니다. `ja/common.json`은 있고 `ja/errors.json`은 만든 적이 없다면, 이 검사가 없을 때 그 파일에 있어야 할 키가 비교에서 전부 빠지고 검사는 통과합니다.

```text
locales/
  en/common.json  en/errors.json
  ja/common.json
```

```text
[NO_LOCALE] ja @errors.json
```

그룹이 둘 이상일 때만 의미가 있습니다. 파일 묶음이 하나뿐이면 존재하는 언어는 모두 그 안에 있습니다.

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

### `DUPLICATE_KEY`

같은 키가 두 번 정의되어, 두 값 중 하나가 읽히기도 전에 버려지는 경우입니다. 두 가지 형태가 있고 둘 다 나중에는 흔적이 남지 않습니다.

```json
// 리터럴 중복 — 유효한 JSON이며, JSON.parse는 아무 말 없이 "Hi"를 반환합니다
{ "greeting": "Hello", "greeting": "Hi" }
```

```json
// 평탄화 충돌 — 중첩 키와 점 표기 키가 같은 키로 합쳐집니다
{ "attr": { "folder": "Folder" }, "attr.folder": "Directory" }
```

앞의 것은 머지 충돌을 잘못 정리했을 때 남고, 뒤의 것은 파일 일부는 점 표기로, 일부는 중첩으로 쓸 때 생깁니다. 둘 다 검출합니다. 리터럴 중복은 파싱 전에 파일 텍스트를 읽어서 찾아내며 — 증거가 남아 있는 유일한 시점입니다 — 메시지에 몇 번째 줄인지 표시합니다.

값이 사라지는 문제이므로 오류입니다. chki18n이 심각도를 낮추지 않기를 권하는 유일한 검사이지만, `levels`로 바꿀 수는 있습니다.

### `INVALID_FILE`

읽지 못했거나, 비어 있거나, JSON으로 파싱되지 않거나, `format`으로 구조를 강제했을 때 일치하는 파일이 하나도 없는 경우입니다. 비교보다 먼저 보고되며 항상 오류입니다. 읽지 못한 파일은 통과한 파일이 아니기 때문입니다.

## 값 검사

### `EMPTY_VALUE`

키는 정의되어 있지만 값이 `""`인 경우입니다. 나중에 채우려고 자리만 만들어 둔 경우가 많고, 그런 것이 실수로 배포되곤 합니다. 기본은 경고이며, 빈 문자열을 누락된 번역으로 취급하는 프로젝트라면 승격하세요.

```bash
chki18n ./locales --levels EMPTY_VALUE=error
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
chki18n ./locales --ignore-checks NOT_TRANSLATED_VALUE
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

`DUPLICATE_KEY`, `UNUSED_KEY`와 마찬가지로 이 검사는 키 하나보다 넓은 범위를 봐야 하므로 [`checkEntry`](/ko/api/create-analyzer)에서는 **보고되지 않습니다**. 그런 성질을 가진 코드는 `CROSS_KEY_CHECK_CODES`에 정리되어 있습니다.

### `NUMBER_MISMATCH`

`MISSING_NUMBER`는 번역에 숫자가 남아 있는지를 봅니다. 이 검사는 같은 숫자가 남았는지를 봅니다. 원문이 셋인데 번역이 다섯이라고 말하는 쪽이 숫자를 아예 빼먹은 것보다 나쁘고, 다른 검사에는 전부 걸리지 않습니다.

```json
// en.json
{ "count": "You have 3 items" }
// ko.json
{ "count": "5개 있습니다" }
```

번역이 숫자 순서를 바꾼 것은 문제 삼지 않습니다. `3 of 5`와 `5 중 3`은 같은 숫자를 담고 있습니다. 숫자를 글자로 풀어 쓴 번역은 `MISSING_NUMBER`가 맡습니다.

### `TAG_MISMATCH`

값에 들어 있는 마크업을 기준 언어와 비교합니다. `<b>`가 빠지면 굵게 표시되지 않고, `</b>`가 빠지면 그 뒤가 전부 굵어집니다. `<Trans>` 컴포넌트에서는 번역에 없는 태그가 끝내 렌더링되지 않는 자식이 됩니다.

```json
// en.json
{ "hint": "Click <b>here</b> to continue" }
// ko.json
{ "hint": "계속하려면 여기를 누르세요" }
```

```text
[TAG_MISMATCH] ko -> 'hint' The tags `<b>` and `</b>` of the target language are missing from this value.
```

있는지만 보는 것이 아니라 개수를 셉니다. 두 번 열고 한 번 닫은 값도 보고합니다. 태그 이름은 대소문자를 가리지 않고 읽으며, `a < b`처럼 숫자를 비교하는 문장은 마크업으로 착각하지 않습니다.

오류가 아니라 경고인 이유는, 단축키 안내에 쓰는 `<Ctrl>`도 패턴만 보면 태그이기 때문입니다. 파일을 파악한 뒤 `--levels TAG_MISMATCH=error`로 올리면 됩니다.

### `UNTRANSLATED_SCRIPT`

그 언어를 적는 문자가 값에 하나도 없습니다. `NOT_TRANSLATED_VALUE`는 원문과 글자 하나까지 같을 때만 잡아내므로, 느낌표 하나만 붙여도 통과합니다.

```json
// en.json
{ "greet": "Hello" }
// ko.json
{ "greet": "Hello!" }
```

문자가 단서가 되는 언어만 검사합니다. 한국어, 일본어, 중국어, 러시아어, 아랍어, 그리스어, 히브리어, 태국어 등입니다. 라틴 문자로 적는 언어는 대상이 아닙니다. 번역하지 않고 둔 영어와 구별할 방법이 없기 때문입니다. `sr-Latn`처럼 문자를 직접 밝힌 로케일도 건드리지 않습니다.

자리 표시자나 태그, 숫자뿐인 값은 건너뜁니다. 영어 그대로 두는 브랜드명은 건너뛰지 않으므로, 오탐이 나온다면 대개 그쪽입니다.

### `INCONSISTENT_VALUE`

`DUPLICATE_VALUE`는 한 로케일이 같은 값을 반복하는지를 봅니다. 이 검사는 반대를 봅니다. 기준 언어에서 문자열이 같은 두 키를 이 로케일이 서로 다르게 번역한 경우입니다.

```json
// en.json
{ "save-a": "Save", "save-b": "Save" }
// ko.json
{ "save-a": "저장", "save-b": "보관" }
```

```text
[INCONSISTENT_VALUE] ko -> 'save-b' The key `save-a` has the same en value but is translated as "저장".
```

한 버튼이 화면마다 다른 단어로 보이게 만드는 용어 흔들림입니다. 같은 영어 단어에 두 가지 번역이 필요한 경우도 있으므로 경고입니다.

### `INVISIBLE_CHARACTER`

폭이 없는 공백, 바이트 순서 표시, 양방향 제어문자, 그리고 보통 공백 자리에 들어간 줄바꿈 없는 공백입니다. 디자인 도구나 스프레드시트에서 복사할 때 딸려 오고, 문자열을 비교하는 조회를 깨뜨리며, 리뷰에서는 절대 보이지 않습니다.

```text
[INVISIBLE_CHARACTER] ko -> 'clean' The value holds a zero width space (U+200B), which nothing will draw.
```

### `SUSPICIOUS_LENGTH`

원문보다 지나치게 길거나 짧은 값입니다. 잘린 문자열이나 통째로 붙여 넣은 문단이 이렇게 보입니다. 어디까지가 지나친지는 `lengthRatio`가 정합니다. `4`를 주면 원문의 4분의 1보다 짧거나 4배보다 긴 값을 보고합니다.

```bash
chki18n ./locales --length-ratio 3
```

길이는 글자 수가 아니라 칸 수로 셉니다. 한국어와 일본어가 그냥 짧게 나오지 않습니다. 원문이 여덟 칸 미만이면 건너뜁니다. `OK` 같은 값에 비율은 아무것도 말해 주지 않기 때문입니다. 언어마다 길이가 다른 것은 정상이므로 `info`로 보고하며, 결함이라기보다 한번 보라는 신호입니다.

## 사용 여부 검사

### `UNUSED_KEY`

소스 파일 어디에서도 이 키를 참조하지 않는 것으로 보이는 경우입니다. 검사할 소스 위치를 지정해야 동작합니다.

```bash
chki18n ./locales --target en --source ./src
```

::: lang js

```javascript
await checkTranslationFiles('./locales', { target: 'en', source: './src' });
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(target: 'en', source: './src'),
);
```

:::

::: lang py

```python
check_translation_files("./locales", Options(target="en", source="./src"))
```

:::

검색은 키의 **마지막 세그먼트**를 기준으로 합니다. `desc.hello`는 `hello`로 찾습니다. 코드에서 중첩 키를 마지막 세그먼트만으로 참조하는 경우가 매우 흔하기 때문입니다. 네임스페이스가 상위에 묶인 `t('hello')` 같은 형태입니다. 점으로 이어진 전체 키로 찾으면 멀쩡히 동작하는 코드를 미사용으로 보고하게 되는데, 둘 중 그쪽이 더 나쁜 실수입니다.

심각도도 여기서 결정됩니다. `name`이나 `title` 같은 세그먼트는 키의 실제 사용 여부와 무관하게 거의 모든 코드베이스에 등장하므로, 이것은 발견이라기보다 힌트입니다. `info` 수준으로 보고되고 실행을 실패시키지 않으며, "지우세요"가 아니라 "여기부터 살펴보세요"로 읽는 것이 맞습니다.

프로젝트 자신의 번역 파일은 검색 대상에서 제외됩니다. 키는 그것을 정의한 파일에 그대로 등장하므로, 번역 파일을 읽으면 모든 키가 사용 중으로 판정됩니다. 텍스트 파일(소스, 스타일, 템플릿, 문서)만 읽으며 5MB를 넘는 파일은 건너뛰고, `exclude`와 `excludeFiles` 목록도 함께 적용됩니다.

이미 답을 알고 있다면 — 프로젝트를 직접 스캔한 편집기라면 — 다시 계산하게 하지 말고 넘기세요.

::: lang js

```javascript
analyzeTranslations({ locales, unusedKeys: ['desc.orphan'] }, { target: 'en' });
```

:::

::: lang dart

```dart
analyzeTranslations(
  Chki18nInput(locales: locales, unusedKeys: const ['desc.orphan']),
  options: const Chki18nOptions(target: 'en'),
);
```

:::

::: lang py

```python
analyze_translations(
    Input(locales=locales, unused_keys=["desc.orphan"]), Options(target="en")
)
```

:::

### `UNDEFINED_KEY`

`UNUSED_KEY`의 반대이며, 둘 중 심각한 쪽입니다. 소스가 어떤 키를 부르는데 어느 언어 파일에도 그 키가 없습니다. 런타임에 따라 사용자에게 키 문자열이 그대로 보이거나, 빈 문자열이 보이거나, 아무것도 보이지 않습니다.

```javascript
t('attr.missing'); // 어느 언어 파일에도 없음
```

```text
[UNDEFINED_KEY] 'attr.missing' The scanned source asks for `attr.missing` and no language file defines it.
```

`UNUSED_KEY`와 같은 `source` 디렉터리가 필요하며, 거기서 찾은 호출을 읽습니다. 호출 이름은 `translateFunctions`가 정합니다. 기본값인 `t`, `$t`, `translate`가 i18next, react-i18next, vue-i18n을 함께 덮으며, `i18n.t`와 `useTranslation`이 넘겨준 `t`도 여기 포함됩니다. `<Trans>` 컴포넌트의 `i18nKey` 속성도 읽습니다.

세 가지 형태는 일부러 통과시킵니다. `UNUSED_KEY`가 마지막 세그먼트로 찾는 것과 같은 판단입니다. 잘 도는 코드를 잘못됐다고 말하는 검사가 놓치는 검사보다 나쁩니다.

- 실행 중에 만들어지는 키. ``t(`error.${code}`)``는 실행하기 전에는 알 수 없습니다.
- 접두사로 닿는 키. 파일이 `attr.folder`를 정의하는데 소스가 `t('folder')`라고 부르면 `keyPrefix`나 네임스페이스가 해결해 줍니다.
- 원형으로 부르는 복수형 키. 파일이 `item_one`과 `item_other`를 정의하는데 소스가 `t('item')`이라고 부르면 형태는 런타임이 고릅니다.

`t('common:attr.folder')`처럼 키 앞에 붙은 네임스페이스는 읽고 떼어 냅니다. 뒤에 남는 키로 찾습니다.

## 복수형 검사

### `NO_PLURAL_FORM`

복수형 접미사로 쓴 키인데 그 언어에 필요한 형태가 빠졌습니다. 어떤 형태가 필요한지는 원문이 아니라 언어가 정합니다. 영어는 둘, 러시아어는 넷, 한국어는 하나를 씁니다.

```json
// ru.json — 러시아어는 one, few, many, other가 필요합니다
{ "item_one": "{count} элемент", "item_other": "{count} элементов" }
```

```text
[NO_PLURAL_FORM] ru -> 'item' `ru` needs `item_few` and `item_many` and the file does not define them.
```

이름이 붙은 범주만 읽습니다. `_zero`, `_one`, `_two`, `_few`, `_many`, `_other`입니다. 원형 키와 `_plural`을 짝지어 쓰던 예전 i18next 방식은 평범한 키로 둡니다. 둘 중 어느 쪽이 어떤 형태인지는 언어마다 다르기 때문입니다.

표에 없는 언어는 판단하지 않습니다. 표는 일부러 보수적으로 만들었습니다. 최근 CLDR은 여러 언어에 축약 십진수용 `many` 범주를 더했는데, 예전 런타임을 쓰는 프로젝트는 그 형태를 쓰지 않습니다.

### 복수형 키와 `NO_KEY`, `DUMMY_KEY`

복수형은 그 언어의 문법에 속하므로, 두 키 검사는 모든 언어에 모든 형태를 요구하지 않습니다. 한국어는 `item_other`만 있으면 되고, `item_one`이 없는 것은 누락이 아니라 정상입니다. 러시아어는 영어가 쓰지 않는 `item_few`가 필요하며, 그것은 남는 키가 아닙니다.

이름이 붙은 복수형 범주로 끝나는 키에만, 그리고 표에 있는 언어에만 해당합니다. 나머지 키는 평소대로 비교합니다.

## 키 형태 검사

둘 다 프로젝트가 기준을 정해 주기 전까지 꺼져 있습니다. 키 형태에는 정답이 따로 없고 프로젝트가 고른 규칙만 있기 때문입니다. 로케일마다가 아니라 키마다 한 번씩 판단합니다. 키 이름은 어느 언어에서나 같습니다.

### `KEY_NAMING`

`keyCase`는 키의 각 단계를 어떤 표기법으로 적을지 정합니다. `kebab`, `camel`, `snake` 중 하나입니다.

```bash
chki18n ./locales --key-case kebab
```

```text
[KEY_NAMING] 'attr.badName' The part `badName` is not written in kebab case.
```

i18n 라이브러리가 붙이는 복수형과 문맥 접미사는 어떤 표기법에서도 통과합니다. `item-count_one`이나 `greeting_male`의 밑줄은 작명이 아니라 라이브러리의 것이기 때문입니다.

한 키에서 여러 단계가 어긋나도 한 번만 보고합니다. 두 번째를 알려 준다고 해야 할 일이 달라지지 않습니다.

### `KEY_DEPTH`

`maxKeyDepth`는 키를 몇 단계까지 중첩할 수 있는지 정합니다. `2`를 주면 `attr.folder`는 통과하고 `attr.folder.name`은 보고합니다.

```bash
chki18n ./locales --max-key-depth 2
```

```text
[KEY_DEPTH] 'a.b.c.d' The key is 4 levels deep, and `maxKeyDepth` allows 2.
```

깊은 중첩은 키를 검색하기 어렵게 만들고 번역 파일을 병합하기 어렵게 만듭니다. 대개 한 단계 묶음이면 충분합니다.

## 보간 검사

보간 키는 문자열 안의 자리 표시자입니다. 기본값은 `{name}` 형태입니다. 비교 양쪽에서 자리 표시자를 추출해 두 집합을 비교하므로, 문장과 함께 번역되어 버린 자리 표시자를 잡아냅니다.

### `NO_INTERPOLATION_KEY`

기준 언어 값에는 있는 자리 표시자가 이 값에는 없는 경우입니다. 런타임에 치환되지 않는 변수가 되므로 오류입니다.

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

반대로, 기준 언어가 정의하지 않은 자리 표시자가 이 값에 있는 경우입니다. 보통 오타(`{nmae}`)이거나 번역 중에 만들어진 자리 표시자이며, 런타임에는 중괄호가 그대로 렌더링됩니다.

### `INTERPOLATION_COUNT`

위 두 검사는 값이 어떤 자리 표시자를 쓰는지 봅니다. 이 검사는 각각을 몇 번 쓰는지 봅니다. 같은 자리 표시자를 두 번 부르는 원문과 한 번만 부르는 번역은 집합으로는 같고 문장으로는 다릅니다.

```json
// en.json
{ "invite": "{name} invited {name}" }
// ko.json
{ "invite": "{name}님이 초대했습니다" }
```

```text
[INTERPOLATION_COUNT] ko -> 'invite' The interpolation key `{name}` is used 1 time here and 2 times in the target language.
```

자리 표시자가 아예 없거나 기준 언어에 없는 경우는 위 두 검사가 맡습니다.

### 구분자 바꾸기

기본 구분자는 `{`와 `}`입니다. 프로젝트가 `{{ }}`를 쓴다면 반드시 알려주세요. 그러지 않으면 자리 표시자가 전혀 인식되지 않고 두 보간 검사가 조용히 통과합니다.

```bash
chki18n ./locales --interpolation-prefix "{{" --interpolation-suffix "}}"
```

::: lang js

```javascript
await checkTranslationFiles('./locales', {
	interpolationPrefix: '{{',
	interpolationSuffix: '}}'
});
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(interpolationPrefix: '{{', interpolationSuffix: '}}'),
);
```

:::

::: lang py

```python
check_translation_files(
    "./locales", Options(interpolation_prefix="{{", interpolation_suffix="}}")
)
```

:::

## 실행할 검사 고르기

일부만 실행하기:

```bash
chki18n ./locales --checks NO_KEY,NO_INTERPOLATION_KEY
```

일부만 빼고 실행하기:

```bash
chki18n ./locales --ignore-checks DUPLICATE_VALUE,MISSING_NUMBER
```

둘을 함께 쓸 수는 없습니다. `checks`가 우선하며 `ignoreChecks`는 무시되었다고 보고됩니다. `INVALID_FILE`과 `INVALID_OPTIONS`는 어느 목록에도 속하지 않습니다. 실행 자체가 어떻게 됐는지를 알리는 항목이라 끌 수 없습니다.

## 심각도 바꾸기

모든 비교 검사는 심각도를 다시 지정할 수 있습니다. 무엇이 빌드를 막을지 프로젝트가 스스로 정하는 방법입니다.

```bash
chki18n ./locales --levels EMPTY_VALUE=error,DUPLICATE_VALUE=info
```

::: lang js

```javascript
await checkTranslationFiles('./locales', {
	levels: { EMPTY_VALUE: 'error', DUPLICATE_VALUE: 'info' }
});
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(
    levels: {
      Chki18nCheckCode.emptyValue: Chki18nLevel.error,
      Chki18nCheckCode.duplicateValue: Chki18nLevel.info,
    },
  ),
);
```

:::

::: lang py

```python
check_translation_files(
    "./locales",
    Options(levels={"EMPTY_VALUE": "error", "DUPLICATE_VALUE": "info"}),
)
```

:::

수준은 `error`, `warn`, `info`입니다. `error`만 실행을 실패시키므로, `info`로 낮추면 아무것도 막지 않으면서 리포트에는 계속 남습니다. `INVALID_FILE`과 `INVALID_OPTIONS`는 변경할 수 없습니다.

## 코드에서 검사 정보 읽기

검사 코드와 메타데이터가 공개되어 있어, UI가 문자열을 하드코딩할 필요가 없습니다.

::: lang js

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

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

checkMeta[Chki18nCheckCode.noKey];
// Chki18nCheckMeta(
//   level: Chki18nLevel.error,
//   summary: 'Some translation files did not include the following keys',
//   description: 'The key exists in the target language but is missing here.',
// )

analyzeCheckCodes; // 번역을 비교하는 모든 코드, 리포트 순서대로
```

:::

::: lang py

```python
from chki18n import ANALYZE_CHECK_CODES, CHECK_META

CHECK_META["NO_KEY"]
# CheckMeta(
#     level="error",
#     summary="Some translation files did not include the following keys",
#     description="The key exists in the target language but is missing here.",
# )

ANALYZE_CHECK_CODES  # 번역을 비교하는 모든 코드, 리포트 순서대로
```

:::

`summary`는 여러 발생 건을 묶는 제목이고, `description`은 한 건을 설명합니다. 이 둘이 어떻게 쓰이는지는 [결과 객체](/ko/reference/result)를 참고하세요.
