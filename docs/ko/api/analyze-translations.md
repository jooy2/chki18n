---
title: analyzeTranslations
---

# `analyzeTranslations`

이미 메모리에 가지고 있는 번역 데이터를 비교합니다. 파일 시스템을 전혀 사용하지 않으므로 JavaScript가 도는 곳이라면 어디서든 — 브라우저, 편집기, 워커 — 실행되며, 다른 무언가가 이미 파일을 읽어둔 상황에서 쓰는 진입점입니다.

## 시그니처

```typescript
function analyzeTranslations(input: Chki18nInput, options?: Chki18nOptions): Chki18nResult;
```

동기 함수입니다. `await`할 것이 없습니다.

## 사용법

로케일 하나의 묶음을 전달합니다.

```javascript
import { analyzeTranslations } from 'chki18n';

const result = analyzeTranslations(
	{
		locales: {
			en: { desc: { hello: 'Hello {name}', bye: 'Goodbye' } },
			ko: { desc: { hello: '안녕하세요' } }
		}
	},
	{ target: 'en' }
);

result.keyCount; // 2
result.issuesByCode.NO_KEY[0].key; // 'desc.bye'
result.issuesByCode.NO_INTERPOLATION_KEY[0].interpolation; // 'name'
```

중첩 객체는 비교 전에 평탄화되므로, 모든 이슈는 `desc.hello` 형태로 키를 보고합니다.

## 번역 파일이 여러 개일 때

프로젝트에 파일 묶음이 둘 이상이면 `groups`를 쓰세요. 각각 따로 비교되므로 한쪽에 없는 키가 다른 쪽 문제로 보고되지 않습니다.

```javascript
analyzeTranslations(
	{
		groups: {
			'common.json': { en: { ok: 'OK' }, ko: { ok: '확인' } },
			'errors.json': { en: { failed: 'Failed' }, ko: {} }
		}
	},
	{ target: 'en' }
);
// 하나뿐인 NO_KEY 이슈가 group: 'errors.json'을 갖습니다
```

`{ locales }`는 이름이 `''`인 그룹 하나에 대한 축약형입니다. 디렉토리 검사가 어떻게 같은 형태에 도달하는지는 [파일 구조](/ko/guide/file-layouts#그룹)를 참고하세요.

## 평탄화 건너뛰기

키가 이미 평탄한 형태라면 그렇다고 알려주세요. 전달한 객체가 그대로 사용되며, 아무것도 복사하거나 다시 만들지 않습니다.

```javascript
const en = { 'desc.hello': 'Hello {name}' };
const ko = { 'desc.hello': '안녕하세요' };

analyzeTranslations({ locales: { en, ko } }, { target: 'en', flattened: true });
```

이것이 빠른 경로입니다. 로케일 5개에 걸친 키 5,000개 비교가 평탄화된 입력에서는 약 **17ms**, 평탄화 단계를 거치면 약 22ms입니다.

## 입력

```typescript
interface Chki18nInput {
	groups?: { [group: string]: { [locale: string]: TranslationMap } };
	locales?: { [locale: string]: TranslationMap };
	files?: Chki18nSourceFile[];
	issues?: Chki18nIssue[];
	fileFormat?: Chki18nFileFormat;
}
```

`files`는 그룹과 로케일을 원본 파일에 연결해, 이슈가 `file` 경로를 담을 수 있게 합니다. `issues`는 입력을 만들어낸 쪽이 자신이 발견한 문제를 같은 결과에 실어 보내는 통로입니다. 디렉토리 검사에서 읽지 못한 파일 오류가 비교 결과와 한 목록에 담기는 것도 이 방식입니다. `fileFormat`은 결과로 그대로 전달됩니다.

## 결과가 말해주는 것

```javascript
result.files; // [] — 디스크에서 읽은 것이 없습니다
result.fileFormat; // null — 직접 전달하지 않았다면
result.locales; // 모든 그룹에서 발견된 모든 로케일
result.groups; // 모든 그룹 이름, 입력 순서대로
result.keyCount; // 비교한 고유 키 수
```

나머지는 [`checkTranslationFiles`](./check-translation-files)가 반환하는 것과 같은 형태입니다. [결과 객체](/ko/reference/result)를 참고하세요.

## 객체가 아닌 로케일

다른 입력 문제와 마찬가지로 예외를 던지지 않고 보고합니다.

```javascript
analyzeTranslations({ locales: { en: { a: 'A' }, ko: null } }, { target: 'en' });
// issuesByCode.INVALID_FILE — "The translations of `ko` are not an object."
```

## 함께 보기

- [`createAnalyzer`](./create-analyzer) — 분석기를 재사용하고 키 하나만 검사하기.
- [`chki18n/core`](./core) — 검사기가 필요로 하는 Node 내장 모듈 없이 이 함수만.
