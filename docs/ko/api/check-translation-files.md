---
title: checkTranslationFiles
---

# `checkTranslationFiles`

번역 파일 디렉토리를 읽어 모든 언어를 기준 언어와 비교하는 일을 한 번의 호출로 수행합니다. CLI가 하는 일을 그대로, 코드에서 다룰 수 있는 값으로 돌려주며, 디렉토리를 한 번만 검사할 때 쓰는 진입점입니다.

## 시그니처

```typescript
function checkTranslationFiles(path?: string, options?: Chki18nOptions): Promise<Chki18nResult>;
```

## 사용법

```javascript
import { checkTranslationFiles } from 'chki18n';

const result = await checkTranslationFiles('./locales', { target: 'en' });

result.success; // false
result.summary.error; // 1
result.issues;
// [
//   {
//     code: 'NO_KEY',
//     level: 'error',
//     locale: 'ko',
//     key: 'attr.folder',
//     group: '',
//     targetValue: 'Folder',
//     file: '/project/locales/ko.json',
//     message: 'The key exists in the target language but is missing here.'
//   }
// ]
```

경로는 옵션으로도 전달할 수 있으며, CLI가 위치 인자를 처리하는 방식이기도 합니다.

```javascript
await checkTranslationFiles(undefined, { path: './locales', target: 'en' });
```

모든 옵션은 [옵션](/ko/guide/options)에, 결과는 [결과 객체](/ko/reference/result)에 정리되어 있습니다.

## 출력하지도, 종료하지도 않습니다

이 함수가 의도적으로 하지 않는 두 가지입니다.

- **`verbose`를 켜지 않으면 아무것도 출력하지 않습니다.** 모듈을 import하는 것만으로 호스트 애플리케이션의 출력이 오염되지 않습니다.
- **프로세스를 종료하지 않습니다.** 검사 실패는 `result.success === false`이지 `process.exit(1)`이 아닙니다. 종료는 CLI의 몫이며, 이 함수가 반환된 뒤에 이루어집니다.

직접 만든 스크립트에서 CLI와 같은 리포트를 보고 싶다면 출력을 켜세요.

```javascript
await checkTranslationFiles('./locales', { target: 'en', verbose: true });
```

## 빌드 실패시키기

```javascript
import { checkTranslationFiles } from 'chki18n';

const result = await checkTranslationFiles('./locales', { target: 'en' });

if (!result.success) {
	for (const issue of result.issues.filter((one) => one.level === 'error')) {
		console.error(`${issue.locale} ${issue.key}: ${issue.message}`);
	}

	process.exit(1);
}
```

`success`는 `error` 수준 이슈가 하나라도 있을 때 `false`가 됩니다. 경고는 절대 `false`로 만들지 않습니다. 프로젝트에서 차단 요소로 취급한다면 [`levels`](/ko/guide/options#levels)로 승격하세요.

## 오류는 던지지 않고 보고합니다

없는 디렉토리, 읽을 수 없는 파일, 파싱되지 않는 JSON, 파일 어디에도 없는 기준 언어 — 어느 것도 예외를 던지지 않습니다. 모두 이슈로 돌아오므로, 잘못된 파일 하나가 나머지 발견을 가리지 않습니다.

```javascript
const result = await checkTranslationFiles('./does-not-exist');

result.success; // false
result.issuesByCode.INVALID_FILE;
// [{ code: 'INVALID_FILE', level: 'error', message: "Failed to read the directory …" }]
```

경로를 아예 전달하지 않은 경우도 같은 방식으로, `INVALID_OPTIONS` 오류로 보고됩니다.

## 소요 시간

`result.elapsedMs`는 검사, 파싱, 비교를 모두 포함한 전체 호출 시간입니다. 같은 디렉토리를 여러 번 검사하면 그만큼 여러 번 읽게 되므로, 그런 형태의 작업이라면 [`loadTranslations`](./load-translations)를 쓰세요.

## 함께 보기

- [`analyzeTranslations`](./analyze-translations) — 이미 가진 데이터에 대한 같은 비교.
- [`loadTranslations`](./load-translations) — 한 번 읽고 원하는 만큼 검사.
- [커맨드라인](/ko/guide/cli) — 같은 일을 명령으로.
