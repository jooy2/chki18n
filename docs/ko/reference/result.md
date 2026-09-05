---
title: 결과 객체
---

# 결과 객체

번역 데이터가 디렉터리에서 왔든, 메모리에서 왔든, 세션에서 왔든 모든 진입점은 같은 결과를 반환합니다. 발견한 모든 이슈와, 같은 이슈를 검사 코드별로 묶은 것, 그리고 심각도·코드·로케일·그룹별 집계를 함께 담고 있어 대시보드나 빌드 스크립트가 직접 계산할 일이 없습니다.

## 결과

::: lang js

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

:::

::: lang dart

```dart
class Chki18nResult {
  final bool success;
  final List<Chki18nIssue> issues;
  final Map<Chki18nCheckCode, List<Chki18nIssue>> issuesByCode;
  final Chki18nSummary summary;
  final String target;
  final List<String> locales;
  final List<String> groups;
  final int keyCount;
  final List<Chki18nSourceFile> files;
  final Chki18nFileFormat? fileFormat;
  final int elapsedMs;

  List<Chki18nIssue> of(Chki18nCheckCode code);
  Map<String, Object?> toJson();
}
```

:::

::: lang py

```python
@dataclass(slots=True)
class Result:
    success: bool
    issues: list[Issue]
    issues_by_code: dict[CheckCode, list[Issue]]
    summary: Summary
    target: str
    locales: list[str]
    groups: list[str]
    key_count: int
    files: list[SourceFile]
    file_format: FileFormat | None
    elapsed_ms: int

    def of(self, code: CheckCode) -> list[Issue]: ...
    def to_json(self) -> dict[str, Any]: ...
```

:::

| 필드 | 의미 |
| --- | --- |
| `success` | `error` 수준 이슈가 하나라도 있으면 거짓입니다. 경고는 영향을 주지 않습니다. |
| `issues` | 모든 이슈를 검사 순서대로. 기준 언어의 키 순서를 따라 로케일별로 이어집니다. |
| <Lang js="issuesByCode" dart="issuesByCode" py="issues_by_code" code /> | 같은 이슈를 검사 코드별로 묶은 것. 코드가 처음 등장한 순서입니다. |
| `summary` | 심각도, 코드, 로케일, 그룹별 집계. |
| `target` | 모든 비교의 기준이 된 언어. |
| `locales` | 비교에 참여한 모든 로케일. |
| `groups` | 모든 그룹 이름. 이름 없는 그룹 하나뿐이면 <Lang js="`['']`" dart="`['']`" py="`[&quot;&quot;]`" />입니다. |
| <Lang js="keyCount" dart="keyCount" py="key_count" code /> | 모든 그룹에 걸쳐 비교한 고유 키 수. |
| `files` | 읽어들인 파일. 메모리 입력이면 비어 있습니다. |
| <Lang js="fileFormat" dart="fileFormat" py="file_format" code /> | `single`, `folder`, `nested`, 또는 메모리 입력이면 <Lang js="`null`" dart="`null`" py="`None`" />. |
| <Lang js="elapsedMs" dart="elapsedMs" py="elapsed_ms" code /> | 호출 전체에 걸린 시간. 파일을 읽었다면 그 시간도 포함합니다. |

<Lang js="`issues`와 `issuesByCode`" dart="`issues`와 `issuesByCode`" py="`issues`와 `issues_by_code`" />는 같은 객체를 담고 있습니다. 코드별로 묶어도 이슈가 복사되지는 않습니다.

::: lang dart py

검사 하나의 결과만 꺼내는 일이 잦아 전용 메서드를 두었습니다. 결과가 없는 경우를 매번 처리하지 않아도 됩니다.

:::

::: lang dart

```dart
result.of(Chki18nCheckCode.noKey); // issuesByCode[noKey] ?? const []
```

:::

::: lang py

```python
result.of("NO_KEY")  # issues_by_code.get("NO_KEY", [])
```

:::

## 이슈

::: lang js

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

:::

::: lang dart

```dart
class Chki18nIssue {
  final Chki18nCheckCode code;
  final Chki18nLevel level;
  final String locale;
  final String key;
  final String group;
  final String? value;
  final String? targetValue;
  final String? interpolation;
  final String? relatedKey;
  final String? file;
  final String message;

  Chki18nIssue withLevel(Chki18nLevel level);
  Map<String, Object?> toJson();
}
```

:::

::: lang py

```python
@dataclass(frozen=True, slots=True)
class Issue:
    code: CheckCode
    level: Level
    message: str
    locale: str = ""
    key: str = ""
    group: str = ""
    value: str | None = None
    target_value: str | None = None
    interpolation: str | None = None
    related_key: str | None = None
    file: str | None = None

    def with_level(self, level: Level) -> Issue: ...
    def to_json(self) -> dict[str, Any]: ...
```

:::

| 필드 | 의미 |
| --- | --- |
| `code` | 어느 검사가 보고했는지. [검사 항목](/ko/guide/checks) 참고. |
| `level` | [`levels`](/ko/guide/options#levels)로 조정한 뒤의 심각도. |
| `locale` | 이슈가 속한 로케일. 로케일과 무관한 이슈는 비어 있습니다. |
| `key` | 평탄화된 키. 파일이나 옵션 수준의 이슈는 비어 있습니다. |
| `group` | 키가 속한 그룹. 그룹이 하나뿐이면 비어 있습니다. |
| `value` | 값에 대한 검사라면, 발견된 그대로의 값. |
| <Lang js="targetValue" dart="targetValue" py="target_value" code /> | 비교 대상이 된 기준 언어의 값. |
| `interpolation` | 보간 관련 이슈를 일으킨 자리 표시자. |
| <Lang js="relatedKey" dart="relatedKey" py="related_key" code /> | 함께 얽힌 다른 키. `DUPLICATE_VALUE`라면 그 값을 먼저 쓴 키입니다. |
| `file` | 키가 파일에서 왔다면 그 파일의 절대 경로. |
| `message` | 이 발생 건을 설명하는 한 문장. |

::: lang js

선택적 필드는 `undefined`가 아니라 **아예 없습니다**. `JSON.stringify`와 깊은 비교가 모두 기대대로 동작합니다.

:::

::: lang dart py

값이 없는 선택적 필드는 <Lang dart="`null`" py="`None`" />이며, <Lang dart="`toJson`" py="`to_json`" code />은 이를 `null`로 쓰지 않고 생략합니다. 그래서 `json` 리포터의 출력이 세 패키지에서 똑같습니다.

:::

## 집계

::: lang js

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

:::

::: lang dart

```dart
class Chki18nSummary {
  final int error;
  final int warn;
  final int info;
  final int total;
  final Map<Chki18nCheckCode, int> byCode;
  final Map<String, Chki18nLevelCount> byLocale;
  final Map<String, Chki18nLevelCount> byGroup;

  Chki18nLevelCount get levelCount;
}
```

:::

::: lang py

```python
@dataclass(slots=True)
class Summary:
    error: int
    warn: int
    info: int
    total: int
    by_code: dict[CheckCode, int]
    by_locale: dict[str, LevelCount]
    by_group: dict[str, LevelCount]

    @property
    def level_count(self) -> LevelCount: ...
```

:::

이슈를 한 번 훑으면서 계산합니다.

::: lang js

```javascript
result.summary;
// {
//   error: 2, warn: 7, info: 1, total: 10,
//   byCode: { NO_KEY: 1, EMPTY_VALUE: 1, NOT_TRANSLATED_VALUE: 1, … },
//   byLocale: { ko: { error: 2, warn: 7, info: 0 } },
//   byGroup: { '': { error: 2, warn: 7, info: 1 } }
// }
```

:::

::: lang dart

```dart
result.summary;
// error: 2, warn: 7, info: 1, total: 10
// byCode: {NO_KEY: 1, EMPTY_VALUE: 1, NOT_TRANSLATED_VALUE: 1, …}
// byLocale: {ko: Chki18nLevelCount(error: 2, warn: 7, info: 0)}
// byGroup: {: Chki18nLevelCount(error: 2, warn: 7, info: 1)}
```

:::

::: lang py

```python
result.summary
# error=2, warn=7, info=1, total=10
# by_code={"NO_KEY": 1, "EMPTY_VALUE": 1, "NOT_TRANSLATED_VALUE": 1, …}
# by_locale={"ko": LevelCount(error=2, warn=7, info=0)}
# by_group={"": LevelCount(error=2, warn=7, info=1)}
```

:::

<Lang js="byLocale" dart="byLocale" py="by_locale" code />은 로케일에 속한 이슈만 셉니다. 옵션이나 파일 수준의 이슈는 <Lang js="byGroup" dart="byGroup" py="by_group" code />에는 들어가지만 <Lang js="byLocale" dart="byLocale" py="by_locale" code />에는 들어가지 않습니다.

## 결과를 화면에 그리기

모든 이슈가 자신의 `message`를 들고 있고 검사 메타데이터가 각 검사를 설명하므로, UI에 문자열을 하드코딩하지 않아도 됩니다.

::: lang js

```javascript
import { CHECK_META } from 'chki18n';

CHECK_META.NO_KEY;
// {
//   level: 'error',
//   summary: 'Some translation files did not include the following keys',
//   description: 'The key exists in the target language but is missing here.'
// }
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
```

:::

::: lang py

```python
from chki18n import CHECK_META

CHECK_META["NO_KEY"]
# CheckMeta(
#     level="error",
#     summary="Some translation files did not include the following keys",
#     description="The key exists in the target language but is missing here.",
# )
```

:::

`summary`는 여러 발생 건을 묶는 제목이고, `description`은 한 건을 설명합니다. 이슈의 `message`는 검사가 더 구체적인 문장을 만들지 않았다면 `description`과 같습니다. `NO_INTERPOLATION_KEY`가 자리 표시자 이름을 넣어 만드는 문장이 그런 경우입니다.

가장 단순한 리포트는 이렇습니다.

::: lang js

```javascript
for (const [code, issues] of Object.entries(result.issuesByCode)) {
	console.log(`${CHECK_META[code].summary} (${issues.length})`);

	for (const issue of issues) {
		console.log(`  ${issue.locale} ${issue.key} — ${issue.message}`);
	}
}
```

:::

::: lang dart

```dart
for (final entry in result.issuesByCode.entries) {
  print('${checkMeta[entry.key]!.summary} (${entry.value.length})');

  for (final issue in entry.value) {
    print('  ${issue.locale} ${issue.key} — ${issue.message}');
  }
}
```

:::

::: lang py

```python
for code, issues in result.issues_by_code.items():
    print(f"{CHECK_META[code].summary} ({len(issues)})")

    for issue in issues:
        print(f"  {issue.locale} {issue.key} — {issue.message}")
```

:::

## 걸러낸 이슈 다시 묶기

<Lang js="`issuesByCode`와 `summary`" dart="`issuesByCode`와 `summary`" py="`issues_by_code`와 `summary`" />는 결과 전체를 설명합니다. 이슈를 걸러낸 다음 두 헬퍼를 부르면 둘 다 다시 만들어집니다.

::: lang js

```javascript
import { groupIssuesByCode, summarizeIssues } from 'chki18n';

const visible = result.issues.filter((issue) => issue.locale !== 'ja');

groupIssuesByCode(visible);
summarizeIssues(visible);
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

final visible = result.issues.where((issue) => issue.locale != 'ja').toList();

groupIssuesByCode(visible);
summarizeIssues(visible);
```

:::

::: lang py

```python
from chki18n import group_issues_by_code, summarize_issues

visible = [issue for issue in result.issues if issue.locale != "ja"]

group_issues_by_code(visible)
summarize_issues(visible)
```

:::

로케일 필터나 심각도 토글을 붙였을 때, 화면에 보이는 집계와 목록을 맞추는 데 씁니다.

## 다른 기준으로 묶기

이슈 하나에 담긴 정보만으로 원하는 기준을 만들 수 있습니다.

::: lang js

```javascript
// 로케일별
const byLocale = Object.groupBy(result.issues, (issue) => issue.locale);

// 키별. 문자열 하나의 모든 문제를 한 번에 보여줄 때
const byKey = Object.groupBy(result.issues, (issue) => `${issue.group}/${issue.key}`);

// 파일별. 편집기에 표시를 남길 때
const byFile = Object.groupBy(result.issues, (issue) => issue.file ?? '');
```

:::

::: lang dart

```dart
Map<String, List<Chki18nIssue>> groupBy(
  List<Chki18nIssue> issues,
  String Function(Chki18nIssue issue) keyOf,
) {
  final grouped = <String, List<Chki18nIssue>>{};

  for (final issue in issues) {
    grouped.putIfAbsent(keyOf(issue), () => []).add(issue);
  }

  return grouped;
}

// 로케일별
final byLocale = groupBy(result.issues, (issue) => issue.locale);

// 키별. 문자열 하나의 모든 문제를 한 번에 보여줄 때
final byKey = groupBy(result.issues, (issue) => '${issue.group}/${issue.key}');

// 파일별. 편집기에 표시를 남길 때
final byFile = groupBy(result.issues, (issue) => issue.file ?? '');
```

:::

::: lang py

```python
from collections import defaultdict


def group_by(issues, key_of):
    grouped = defaultdict(list)

    for issue in issues:
        grouped[key_of(issue)].append(issue)

    return grouped


# 로케일별
by_locale = group_by(result.issues, lambda issue: issue.locale)

# 키별. 문자열 하나의 모든 문제를 한 번에 보여줄 때
by_key = group_by(result.issues, lambda issue: f"{issue.group}/{issue.key}")

# 파일별. 편집기에 표시를 남길 때
by_file = group_by(result.issues, lambda issue: issue.file or "")
```

:::

## 직접 결과 만들기

<Lang js="buildResult" dart="buildResult" py="build_result" code />는 이슈 목록으로 결과 하나를 조립합니다. `success`와 코드별 묶음, 집계를 직접 계산하므로 담긴 이슈와 어긋날 수 없습니다.

::: lang js

```javascript
import { buildResult, createIssue, resolveOptions } from 'chki18n';

const { options } = resolveOptions({ target: 'en' });

const result = buildResult([createIssue('NO_KEY', { locale: 'ko', key: 'a' })], options, {
	locales: ['en', 'ko'],
	groups: ['']
});
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

final options = resolveOptions(const Chki18nOptions(target: 'en')).options;

final result = buildResult(
  [createIssue(Chki18nCheckCode.noKey, locale: 'ko', key: 'a')],
  options,
  locales: ['en', 'ko'],
  groups: [''],
);
```

:::

::: lang py

```python
from chki18n import Options, build_result, create_issue, resolve_options

options, _ = resolve_options(Options(target="en"))

result = build_result(
    [create_issue("NO_KEY", locale="ko", key="a")],
    options,
    locales=["en", "ko"],
    groups=[""],
)
```

:::

chki18n이 찾은 것과 직접 만든 검사 결과를 합쳐 하나의 결과로 그리고 싶을 때 쓰면 됩니다.
