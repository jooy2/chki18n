---
title: 코어 진입점
---

# 코어 진입점

디렉토리 검사기를 뺀 비교 엔진 그 자체입니다. 읽을 파일 시스템이 없는 곳에서도 돌아갑니다.

패키지마다 이름이 다릅니다.

| 패키지     | 가져오기                             |
| ---------- | ------------------------------------ |
| JavaScript | `import { … } from 'chki18n/core'`   |
| Dart       | `import 'package:chki18n/core.dart'` |
| Python     | `from chki18n.core import …`         |

## 왜 따로 있나

패키지 루트는 디렉토리를 읽기 때문에 파일 시스템에 손을 뻗습니다. <Lang js="`node:fs`, `node:path`, `node:os`" dart="`dart:io`" py="`os`와 `shutil`" />입니다. 이것들을 제공하지 못하는 빌드는 실패하거나, 실행될 일 없는 코드를 위해 폴리필 더미를 끌어옵니다.

비교 자체는 그런 것들이 필요했던 적이 없습니다. 코어 진입점은 파일 시스템을 뺀 같은 엔진입니다.

::: lang js

```javascript
import { analyzeTranslations, createAnalyzer, CHECK_META } from 'chki18n/core';
```

빌드마다 이 서브패스의 import 그래프를 따라가며 Node 내장 모듈이 나타나는지 검사하는 테스트가 있으므로, 이는 의도가 아니라 보장입니다.

:::

::: lang dart

```dart
import 'package:chki18n/core.dart';
```

실행할 때마다 이 진입점의 import 그래프를 따라가며 `dart:io`가 나타나는지 검사하는 테스트가 있으므로, 이는 의도가 아니라 보장입니다. Flutter 웹 빌드에서 비교를 쓸 수 있는 근거이기도 합니다.

:::

::: lang py

```python
from chki18n.core import CHECK_META, analyze_translations, create_analyzer
```

실행할 때마다 이 모듈의 import 그래프를 따라가며 `os`, `pathlib`, `shutil`이 나타나는지 검사하는 테스트가 있으므로, 이는 의도가 아니라 보장입니다.

:::

## 무엇이 들어 있나

파일을 읽는 부분을 **제외한** 루트의 모든 것입니다.

::: lang js

| 포함 | 미포함 |
| --- | --- |
| [`analyzeTranslations`](./analyze-translations), [`createAnalyzer`](./create-analyzer) | `checkTranslationFiles` |
| `createSession` (직접 전달하는 번역 데이터용) | `loadTranslations` |
| `CHECK_CODE`, `CHECK_META`, `ANALYZE_CHECK_CODES`, `CROSS_KEY_CHECK_CODES`, `FILE_FORMAT` | `scanTranslationDirectory` |
| `groupIssuesByCode`, `summarizeIssues`, `createIssue`, `buildResult` | `findUnusedKeys` |
| `resolveOptions`, `argsToOptions`, `buildUsageText`, `OPTION_DEFINITIONS` |  |
| `isLocaleCode`, `extractInterpolationKeys`, `createPathExcluder` |  |
| `createFileExcluder`, 그리고 모든 타입 |  |

루트가 이 전부를 다시 내보내므로 `import { createAnalyzer } from 'chki18n'`도 동작합니다. 번들에 검사기가 들어가면 안 될 때 서브패스를 쓰세요.

:::

::: lang dart

| 포함 | 미포함 |
| --- | --- |
| [`analyzeTranslations`](./analyze-translations), [`createAnalyzer`](./create-analyzer) | `checkTranslationFiles` |
| `createSession` (직접 전달하는 번역 데이터용) | `loadTranslations` |
| `Chki18nCheckCode`, `checkMeta`, `analyzeCheckCodes`, `crossKeyCheckCodes`, `Chki18nFileFormat` | `scanTranslationDirectory` |
| `groupIssuesByCode`, `summarizeIssues`, `createIssue`, `buildResult` | `findUnusedKeys` |
| `resolveOptions`, `optionsFromArgs`, `buildUsageText`, `optionDefinitions` | `formatResult` |
| `isLocaleCode`, `extractInterpolationKeys`, `createPathExcluder` |  |
| `createFileExcluder`, 그리고 모든 타입 |  |

`package:chki18n/chki18n.dart`가 이 전부를 다시 내보내므로 하나만 가져와도 둘 다 쓸 수 있습니다. 빌드가 `dart:io`를 끌어오면 안 될 때 `core.dart`를 쓰세요.

:::

::: lang py

| 포함 | 미포함 |
| --- | --- |
| [`analyze_translations`](./analyze-translations), [`create_analyzer`](./create-analyzer) | `check_translation_files` |
| `create_session` (직접 전달하는 번역 데이터용) | `load_translations` |
| `CHECK_CODES`, `CHECK_META`, `ANALYZE_CHECK_CODES`, `CROSS_KEY_CHECK_CODES`, `FILE_FORMATS` | `scan_translation_directory` |
| `group_issues_by_code`, `summarize_issues`, `create_issue`, `build_result` | `find_unused_keys` |
| `resolve_options`, `options_from_args`, `build_usage_text`, `OPTION_DEFINITIONS` | `format_result` |
| `is_locale_code`, `extract_interpolation_keys`, `create_path_excluder` |  |
| `create_file_excluder`, 그리고 모든 타입 |  |

`chki18n`이 이 전부를 다시 내보내므로 `from chki18n import create_analyzer`도 동작합니다. 모듈이 디스크에 닿으면 안 될 때 `chki18n.core`를 쓰세요.

:::

## 어디에 쓸모가 있나

그 환경이 이미 쓰고 있는 방식으로 파일을 읽은 뒤, 파싱된 객체를 넘기면 됩니다.

::: lang js

```javascript
import { analyzeTranslations } from 'chki18n/core';

const en = await fetch('/locales/en.json').then((res) => res.json());
const ko = await fetch('/locales/ko.json').then((res) => res.json());

const result = analyzeTranslations({ locales: { en, ko } }, { target: 'en' });
```

:::

::: lang dart

```dart
import 'dart:convert';

import 'package:chki18n/core.dart';
import 'package:flutter/services.dart' show rootBundle;

final en = jsonDecode(await rootBundle.loadString('locales/en.json'));
final ko = jsonDecode(await rootBundle.loadString('locales/ko.json'));

final result = analyzeTranslations(
  Chki18nInput(locales: {'en': en as Map<String, Object?>, 'ko': ko as Map<String, Object?>}),
  options: const Chki18nOptions(target: 'en'),
);
```

:::

::: lang py

```python
import json

from chki18n.core import Input, Options, analyze_translations

en = json.loads(request.files["en"].read())
ko = json.loads(request.files["ko"].read())

result = analyze_translations(Input(locales={"en": en, "ko": ko}), Options(target="en"))
```

:::

## 편집기에서

이 진입점이 만들어진 이유인 조합입니다. 프로젝트를 열 때 전체 검사, 수정할 때마다 키 하나.

::: lang js

```javascript
import { createAnalyzer } from 'chki18n/core';

const analyzer = createAnalyzer({ target: 'en' });

analyzer.analyze({ groups: everything }); // 열 때
analyzer.checkEntry({ key, values, locales }); // 매 입력마다
```

:::

::: lang dart

```dart
import 'package:chki18n/core.dart';

final analyzer = createAnalyzer(options: const Chki18nOptions(target: 'en'));

analyzer.analyze(Chki18nInput(groups: everything)); // 열 때
analyzer.checkEntry(Chki18nEntry(key: key, values: values, locales: locales)); // 매 입력마다
```

:::

::: lang py

```python
from chki18n.core import Entry, Input, Options, create_analyzer

analyzer = create_analyzer(Options(target="en"))

analyzer.analyze(Input(groups=everything))  # 열 때
analyzer.check_entry(Entry(key=key, values=values, locales=locales))  # 매 입력마다
```

:::

전체 패턴과, chki18n이 값의 사본을 들고 있게 하는 것보다 값을 넘기는 편이 나은 이유는 [`createAnalyzer`](./create-analyzer)를 참고하세요.

## 의존성

::: lang js

두 개뿐이며 둘 다 작고 Node 전용이 아닙니다. 중첩 키 평탄화를 위한 `flat`과 보간 자리표시자 추출을 위한 `qsu`입니다. `chalk`와 `minimist`는 CLI의 것이며 여기서는 도달할 수 없습니다.

:::

::: lang dart py

없습니다. 코어 진입점이 바깥에서 가져다 쓰는 것은 <Lang dart="`json` 리포터를 위한 `dart:convert`뿐입니다" py="표준 라이브러리인 `json`, `re`, `dataclasses`뿐입니다" />.

:::
