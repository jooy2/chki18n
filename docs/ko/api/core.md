---
title: 코어 진입점
---

# 코어 진입점

디렉터리 스캐너를 뺀 비교 엔진입니다. 읽을 파일 시스템이 없는 곳에서도 실행됩니다.

패키지마다 이름이 다릅니다.

| 패키지     | 가져오기                             |
| ---------- | ------------------------------------ |
| JavaScript | `import { … } from 'chki18n/core'`   |
| Dart       | `import 'package:chki18n/core.dart'` |
| Python     | `from chki18n.core import …`         |
| Rust       | `use chki18n::core::…`               |

## 루트 진입점과의 차이

패키지 루트는 디렉터리를 읽으므로 파일 시스템 모듈을 가져옵니다. <Lang js="`node:fs`, `node:path`, `node:os`" dart="`dart:io`" py="`os`와 `shutil`" rs="`std::fs`와 `std::path`" />입니다.

::: lang js dart py

이 모듈을 제공하지 못하는 빌드는 실패하거나, 실행되지 않을 코드를 위해 폴리필을 잔뜩 끌어옵니다.

:::

비교 자체는 이 모듈을 쓰지 않습니다. 코어 진입점은 파일을 읽는 부분만 덜어낸 같은 엔진입니다.

::: lang js

```javascript
import { analyzeTranslations, createAnalyzer, CHECK_META } from 'chki18n/core';
```

빌드할 때마다 이 서브패스의 import 그래프를 따라가며 Node 내장 모듈이 섞이지 않았는지 테스트가 확인합니다.

:::

::: lang dart

```dart
import 'package:chki18n/core.dart';
```

실행할 때마다 이 진입점의 import 그래프를 따라가며 `dart:io`가 섞이지 않았는지 테스트가 확인합니다. Flutter 웹 빌드에서 비교를 쓸 수 있는 근거이기도 합니다.

:::

::: lang py

```python
from chki18n.core import CHECK_META, analyze_translations, create_analyzer
```

실행할 때마다 이 모듈의 import 그래프를 따라가며 `os`, `pathlib`, `shutil`이 섞이지 않았는지 테스트가 확인합니다.

:::

::: lang rs

```rust
use chki18n::core::analyzer::{analyze_translations, create_analyzer};
use chki18n::core::session::create_session;
```

Rust는 크레이트 하나로 배포되고, 스캐너를 빼는 기능 플래그가 없습니다. 그래서 `chki18n::core`는 별도 빌드가 아니라 모듈입니다. 이 모듈은 `std::fs`도 `std::path`도 호출하지 않으며, 바탕이 되는 `types`, `options`, `constants`도 마찬가지입니다. `core`만 써도 크레이트 전체가 컴파일되므로 스캐너도 함께 빌드됩니다.

`analyze`는 `elapsed_ms`를 채우려고 `std::time::Instant`로 시계를 읽습니다. `check_entry`는 시계를 읽지 않습니다.

:::

## 공개 대상

파일을 읽는 부분을 **제외한** 루트의 모든 것입니다.

::: lang js

| 포함 | 미포함 |
| --- | --- |
| [`analyzeTranslations`](./analyze-translations), [`createAnalyzer`](./create-analyzer) | `checkTranslationFiles` |
| `createSession` (직접 전달하는 번역 데이터용) | `loadTranslations` |
| `CHECK_CODE`, `CHECK_META`, `ANALYZE_CHECK_CODES`, `CROSS_KEY_CHECK_CODES`, `FILE_FORMAT` | `scanTranslationDirectory` |
| `groupIssuesByCode`, `summarizeIssues`, `createIssue`, `buildResult` | `findUnusedKeys` |
| `resolveOptions`, `argsToOptions`, `buildUsageText`, `OPTION_DEFINITIONS` |  |
| `isLocaleCode`, `extractInterpolationKeys`, `detectInterpolationDelimiters` |  |
| `createPathExcluder`, `createFileExcluder`, 그리고 모든 타입 |  |

루트가 이 전부를 다시 내보내므로 `import { createAnalyzer } from 'chki18n'`도 동작합니다. 번들에 스캐너가 들어가면 안 될 때 서브패스를 쓰세요.

:::

::: lang dart

| 포함 | 미포함 |
| --- | --- |
| [`analyzeTranslations`](./analyze-translations), [`createAnalyzer`](./create-analyzer) | `checkTranslationFiles` |
| `createSession` (직접 전달하는 번역 데이터용) | `loadTranslations` |
| `Chki18nCheckCode`, `checkMeta`, `analyzeCheckCodes`, `crossKeyCheckCodes`, `Chki18nFileFormat` | `scanTranslationDirectory` |
| `groupIssuesByCode`, `summarizeIssues`, `createIssue`, `buildResult` | `findUnusedKeys` |
| `resolveOptions`, `optionsFromArgs`, `buildUsageText`, `optionDefinitions` | `formatResult` |
| `isLocaleCode`, `extractInterpolationKeys`, `detectInterpolationDelimiters` |  |
| `createPathExcluder`, `createFileExcluder`, 그리고 모든 타입 |  |

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
| `is_locale_code`, `extract_interpolation_keys`, `detect_interpolation_delimiters` |  |
| `create_path_excluder`, `create_file_excluder`, 그리고 모든 타입 |  |

`chki18n`이 이 전부를 다시 내보내므로 `from chki18n import create_analyzer`도 동작합니다. 모듈이 디스크에 닿으면 안 될 때 `chki18n.core`를 쓰세요.

:::

::: lang rs

| 파일을 읽지 않음 | 파일이나 환경을 읽음 |
| --- | --- |
| `core::analyzer`: [`analyze_translations`](./analyze-translations), [`create_analyzer`](./create-analyzer), `Analyzer` | `check`: `check_translation_files` |
| `core::session`: `create_session`, `Session` (직접 전달하는 번역 데이터용) | `check`: `load_translations`, `FileSession` |
| `constants`: `CheckCode`, `check_meta`, `ANALYZE_CHECK_CODES`, `CROSS_KEY_CHECK_CODES`, `FileFormat` | `loader::scan`: `scan_translation_directory` |
| `core::issue`, `core::result`: `summarize_issues`, `create_issue`, `build_result` | `loader::unused_keys`: `find_unused_keys` |
| `options`: `resolve_options`, `options_from_args`, `build_usage_text`, `OPTION_DEFINITIONS` | `reporter`: 색을 입히기 전에 환경과 터미널을 확인하는 `format_result` |
| `core::locale`, `core::interpolation`: `is_locale_code`, `extract_interpolation_keys`, `detect_interpolation_delimiters` |  |
| `core::exclude`: `create_path_excluder`, `create_file_excluder` |  |
| `types`: 모든 타입, 그리고 결과를 코드별로 묶는 `CheckResult::issues_by_code` |  |

위 경로는 모두 `chki18n::` 아래에 있습니다. 크레이트 루트가 자주 쓰는 것을 다시 내보내므로 `use chki18n::{create_analyzer, Entry, Options};`처럼 모듈 경로 없이 가져올 수 있습니다. 나머지는 `chki18n::core::locale::is_locale_code`처럼 모듈 경로로 씁니다.

:::

## 사용 예

환경이 이미 쓰는 방식으로 파일을 읽은 뒤, 파싱된 객체를 넘기면 됩니다.

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

::: lang rs

```rust
use chki18n::{analyze_translations, Input, Options, TranslationMap};
use indexmap::IndexMap;

// 바이너리에 함께 컴파일되므로 실행 중에는 아무것도 읽지 않습니다.
let en: TranslationMap = serde_json::from_str(include_str!("../locales/en.json"))?;
let ko: TranslationMap = serde_json::from_str(include_str!("../locales/ko.json"))?;

let result = analyze_translations(
    &Input {
        locales: Some(IndexMap::from([("en".into(), en), ("ko".into(), ko)])),
        ..Input::default()
    },
    &Options {
        target: Some("en".into()),
        ..Options::default()
    },
);
```

:::

## 편집기에서

프로젝트를 열 때 전체를 한 번 검사하고, 수정할 때마다 키 하나만 다시 검사합니다.

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

::: lang rs

```rust
use chki18n::{create_analyzer, Entry, Input, Options};

let analyzer = create_analyzer(&Options {
    target: Some("en".into()),
    ..Options::default()
});

analyzer.analyze(&Input {
    groups: Some(everything),
    ..Input::default()
}); // 열 때
analyzer.check_entry(&Entry {
    key,
    values,
    locales: Some(locales),
    group: None,
}); // 매 입력마다
```

:::

전체 흐름과, chki18n에 사본을 맡기는 대신 값을 직접 넘기는 편이 나은 이유는 [`createAnalyzer`](./create-analyzer)에 정리되어 있습니다.

## 의존성

::: lang js

없습니다. 평탄화, 자리 표시자 추출을 비롯한 모든 단계를 패키지 안에서 직접 구현합니다. `chalk`와 `minimist`는 CLI의 것이며 여기서는 도달할 수 없습니다.

:::

::: lang dart py

없습니다. 코어 진입점이 바깥에서 가져다 쓰는 것은 <Lang dart="`json` 리포터를 위한 `dart:convert`뿐입니다" py="표준 라이브러리인 `json`, `re`, `dataclasses`뿐입니다" />.

:::

::: lang rs

크레이트 세 개입니다. `indexmap`과 `serde_json`이 번역 데이터를 담고, 기본 기능을 끈 `regex`가 값에 어느 문자 체계든 글자가 들어 있는지 판단합니다. `core` 바깥에서는 콘솔 리포트가 터미널 너비를 잴 수 있도록 Unix에서 `libc`도 씁니다.

:::
