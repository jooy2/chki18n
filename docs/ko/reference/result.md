---
title: 결과 객체
---

# 결과 객체

번역 데이터가 디렉토리에서 왔든, 메모리에서 왔든, 세션에서 왔든, 모든 진입점은 같은 결과를 반환합니다. 발견된 모든 이슈와, 같은 이슈를 검사 코드별로 묶은 것, 그리고 심각도·코드·로케일·그룹별 집계를 함께 담고 있어 대시보드나 빌드 스크립트가 직접 계산할 일이 없습니다.

## `Chki18nResult`

```typescript
interface Chki18nResult {
	success: boolean;
	issues: Chki18nIssue[];
	issuesByCode: Partial<Record<Chki18nCheckCode, Chki18nIssue[]>>;
	summary: Chki18nSummary;
	target: string;
	locales: string[];
	groups: string[];
	keyCount: number;
	files: Chki18nSourceFile[];
	fileFormat: Chki18nFileFormat | null;
	elapsedMs: number;
}
```

| 필드           | 의미                                                                      |
| -------------- | ------------------------------------------------------------------------- |
| `success`      | `error` 수준 이슈가 하나라도 있으면 `false`. 경고는 영향을 주지 않습니다. |
| `issues`       | 모든 이슈. 검사 순서(기준 언어 키 순서, 로케일 순서)대로 담깁니다.        |
| `issuesByCode` | 같은 이슈를 검사 코드별로 묶은 것. 코드가 처음 등장한 순서를 따릅니다.    |
| `summary`      | 심각도·코드·로케일·그룹별 집계.                                           |
| `target`       | 비교 기준이 된 언어.                                                      |
| `locales`      | 비교에 참여한 모든 로케일.                                                |
| `groups`       | 모든 그룹 이름. 이름 없는 그룹 하나면 `['']`.                             |
| `keyCount`     | 모든 그룹을 통틀어 비교한 고유 키 수.                                     |
| `files`        | 읽어들인 파일들. 메모리 입력이면 비어 있습니다.                           |
| `fileFormat`   | `'single'`, `'folder'`, `'nested'`, 또는 메모리 입력이면 `null`.          |
| `elapsedMs`    | 호출에 걸린 시간. 디렉토리를 읽었다면 그 시간도 포함합니다.               |

`issues`와 `issuesByCode`는 같은 객체를 가리키며 사본이 아닙니다. 그룹핑은 사본이 아니라 시점(view)입니다.

## `Chki18nIssue`

```typescript
interface Chki18nIssue {
	code: Chki18nCheckCode;
	level: 'error' | 'warn' | 'info';
	locale: string;
	key: string;
	group: string;
	value?: string;
	targetValue?: string;
	interpolation?: string;
	relatedKey?: string;
	file?: string;
	message: string;
}
```

| 필드            | 의미                                                                   |
| --------------- | ---------------------------------------------------------------------- |
| `code`          | 어떤 검사가 보고했는지. [검사 항목](/ko/guide/checks) 참고.            |
| `level`         | 심각도. [`levels`](/ko/guide/options#levels) 재지정이 반영된 값입니다. |
| `locale`        | 이슈가 속한 로케일. 로케일과 무관한 이슈는 비어 있습니다.              |
| `key`           | 평탄화된 키. 파일이나 옵션 수준 이슈는 비어 있습니다.                  |
| `group`         | 키가 속한 그룹. 그룹이 하나뿐이면 `''`.                                |
| `value`         | 값에 대한 검사인 경우, 발견된 값.                                      |
| `targetValue`   | 비교 대상이 된 기준 언어의 값.                                         |
| `interpolation` | 보간 이슈를 일으킨 자리표시자.                                         |
| `relatedKey`    | 관련된 다른 키. `DUPLICATE_VALUE`에서는 그 값을 먼저 쓴 키입니다.      |
| `file`          | 키가 온 파일의 절대 경로. 파일에서 왔을 때만 존재합니다.               |
| `message`       | 이 건을 설명하는 문장.                                                 |

선택 필드는 `undefined`가 아니라 **아예 없습니다.** 그래서 `JSON.stringify`와 깊은 비교가 모두 기대대로 동작합니다.

## `Chki18nSummary`

```typescript
interface Chki18nSummary {
	error: number;
	warn: number;
	info: number;
	total: number;
	byCode: Partial<Record<Chki18nCheckCode, number>>;
	byLocale: Record<string, { error: number; warn: number; info: number }>;
	byGroup: Record<string, { error: number; warn: number; info: number }>;
}
```

이슈를 한 번 훑으면서 계산됩니다.

```javascript
result.summary;
// {
//   error: 2, warn: 7, info: 1, total: 10,
//   byCode: { NO_KEY: 1, EMPTY_VALUE: 1, NOT_TRANSLATED_VALUE: 1, … },
//   byLocale: { ko: { error: 2, warn: 7, info: 0 } },
//   byGroup: { '': { error: 2, warn: 7, info: 1 } }
// }
```

`byLocale`은 로케일에 속한 이슈만 집계합니다. 옵션이나 파일 수준 이슈는 `byGroup`에는 들어가지만 `byLocale`에는 들어가지 않습니다.

## 결과를 화면에 그리기

모든 이슈가 자신의 `message`를 갖고 있고 `CHECK_META`가 각 검사를 설명하므로, UI가 문자열을 하드코딩할 필요가 없습니다.

```javascript
import { CHECK_META } from 'chki18n';

CHECK_META.NO_KEY;
// {
//   level: 'error',
//   summary: 'Some translation files did not include the following keys',
//   description: 'The key exists in the target language but is missing here.'
// }
```

`summary`는 여러 건을 묶는 제목이고 `description`은 한 건을 설명합니다. 이슈의 `message`는 검사가 더 구체적인 문장을 만들지 않았다면 `description`과 같습니다. `NO_INTERPOLATION_KEY`가 자리표시자 이름을 넣어 문장을 만드는 것이 그 예입니다.

최소한의 리포트는 이렇습니다.

```javascript
for (const [code, issues] of Object.entries(result.issuesByCode)) {
	console.log(`${CHECK_META[code].summary} (${issues.length})`);

	for (const issue of issues) {
		console.log(`  ${issue.locale} ${issue.key} — ${issue.message}`);
	}
}
```

## 걸러낸 일부만 다시 묶기

`issuesByCode`와 `summary`는 결과 전체를 설명합니다. 이슈를 걸러낸 뒤 두 헬퍼로 다시 만들 수 있습니다.

```javascript
import { groupIssuesByCode, summarizeIssues } from 'chki18n';

const visible = result.issues.filter((issue) => issue.locale !== 'ja');

groupIssuesByCode(visible);
summarizeIssues(visible);
```

로케일 필터나 심각도 토글 뒤에서, 화면에 표시된 개수가 화면에 표시된 내용과 일치해야 할 때 유용합니다.

## 다른 기준으로 묶기

이슈는 원하는 대로 묶을 수 있을 만큼의 정보를 담고 있습니다.

```javascript
// 로케일별
const byLocale = Object.groupBy(result.issues, (issue) => issue.locale);

// 키별 — 한 문자열의 모든 문제를 한 번에 보여줄 때
const byKey = Object.groupBy(result.issues, (issue) => `${issue.group}/${issue.key}`);

// 파일별 — 편집기에 표시할 때
const byFile = Object.groupBy(result.issues, (issue) => issue.file ?? '');
```

## 직접 결과 만들기

`buildResult`는 이슈 목록으로부터 결과를 조립하며, `success`와 `issuesByCode`, `summary`를 직접 계산해 이슈와 어긋날 수 없게 합니다.

```javascript
import { buildResult, createIssue, resolveOptions } from 'chki18n';

const { options } = resolveOptions({ target: 'en' });

const result = buildResult([createIssue('NO_KEY', { locale: 'ko', key: 'a' })], options, {
	locales: ['en', 'ko'],
	groups: ['']
});
```

chki18n의 발견을 직접 만든 검사와 합쳐 하나의 결과로 표시하고 싶을 때 쓸 만합니다.
