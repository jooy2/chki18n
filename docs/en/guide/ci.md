---
title: Continuous integration
---

# Continuous integration

A translation file breaks quietly. Nothing crashes, no test fails, and the missing key ships — it is only noticed when someone opens the app in that language. Running chki18n on every pull request is what turns that into a red build.

There is nothing to configure: a path, a target language, and the exit code does the rest. This page has jobs you can paste for GitHub Actions and Bitbucket Pipelines, in all three languages.

## What CI relies on

| Exit code | Meaning                                                             |
| --------- | ------------------------------------------------------------------- |
| `0`       | No error level issue. Warnings may still have been printed.         |
| `1`       | At least one error level issue, or the directory could not be read. |

Warnings never fail a build. That is deliberate — a warning is worth fixing, not worth blocking a release — and it is what makes the tool safe to add to an existing project without a day of cleanup first. Promote the ones your project treats as blockers with [`--levels`](./options#levels).

Four reporters matter here:

| Reporter   | Where it earns its place                                             |
| ---------- | -------------------------------------------------------------------- |
| `github`   | GitHub Actions. Each issue becomes an annotation on the file itself. |
| `markdown` | A job summary, or a report kept with the build.                      |
| `list`     | One line per issue, which is what a plain log wants.                 |
| `json`     | Another tool reads it — a dashboard, a bot, a gate of your own.      |

## GitHub Actions

### The job

Put this in `.github/workflows/translations.yml`. It runs on every pull request and on every push to the main branch.

::: lang js

```yaml
name: translations

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    name: Check translations

    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v6
        with:
          node-version: '22'
      - name: Check translations
        run: npx chki18n ./locales --target en
```

:::

::: lang dart

```yaml
name: translations

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    name: Check translations

    steps:
      - uses: actions/checkout@v5
      - uses: dart-lang/setup-dart@v1
      - name: Check translations
        run: |
          dart pub global activate chki18n
          dart pub global run chki18n ./locales --target en
```

`dart pub global run` is used rather than the bare `chki18n` because whether the pub cache's `bin` is on the runner's path is not something to depend on. If it is on yours, call the command by name.

:::

::: lang py

```yaml
name: translations

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    name: Check translations

    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-python@v6
        with:
          python-version: '3.12'
      - name: Check translations
        run: |
          pip install chki18n
          chki18n ./locales --target en
```

:::

That is the whole thing. A missing key now fails the pull request.

### Annotating the files

`--reporter github` turns each issue into a workflow command, which GitHub renders as an annotation on the translation file itself rather than a line buried in a log:

```bash
chki18n ./locales --target en --reporter github
```

```text
::error file=locales/ko.json,title=chki18n NO_KEY::ko attr.folder The key exists in the target language but is missing here. (en: "Folder")
::warning file=locales/ko.json,title=chki18n EMPTY_VALUE::ko attr.open The key is defined but its value is an empty string. (en: "Open")
```

An `error` becomes an error annotation, a `warn` a warning, an `info` a notice. There is no line number to give — the checks work on parsed translations, and the commonest finding of all is a key that is not in the file at all — so an annotation points at the file.

Annotations need permission to write checks when the workflow runs with a restricted token:

```yaml
permissions:
  contents: read
  checks: write
```

### A summary on the run

`$GITHUB_STEP_SUMMARY` is a file; anything Markdown written to it appears on the run's own page. That is exactly the shape of the `markdown` reporter:

```bash
chki18n ./locales --target en --output "$GITHUB_STEP_SUMMARY" --reporter markdown
```

The report is written before the command exits, so the summary is there whether the run passed or failed.

### Keeping the report

```yaml
- name: Check translations
  run: chki18n ./locales --target en --output translation-report.md
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: translation-report
    path: translation-report.md
```

`if: always()` is the point of it: without that line the upload is skipped exactly when the report is worth reading.

### Only when translations change

Scanning a folder takes milliseconds, so running it every time costs nothing. If you would rather not, a path filter is enough:

```yaml
on:
  pull_request:
    paths:
      - 'locales/**'
      - '.github/workflows/translations.yml'
```

Be careful making a required check conditional: a pull request that skips the job leaves the check pending rather than green, which blocks a merge on some branch protection settings.

## Bitbucket Pipelines

### The pipeline

Bitbucket reads one file, `bitbucket-pipelines.yml`, at the root of the repository. The image at the top decides what the step has available.

::: lang js

```yaml
image: node:22

pipelines:
  pull-requests:
    '**':
      - step:
          name: Check translations
          script:
            - npx chki18n ./locales --target en
  branches:
    main:
      - step:
          name: Check translations
          script:
            - npx chki18n ./locales --target en
```

:::

::: lang dart

```yaml
image: dart:stable

pipelines:
  pull-requests:
    '**':
      - step:
          name: Check translations
          script:
            - dart pub global activate chki18n
            - dart pub global run chki18n ./locales --target en
  branches:
    main:
      - step:
          name: Check translations
          script:
            - dart pub global activate chki18n
            - dart pub global run chki18n ./locales --target en
```

:::

::: lang py

```yaml
image: python:3.12-slim

pipelines:
  pull-requests:
    '**':
      - step:
          name: Check translations
          script:
            - pip install chki18n
            - chki18n ./locales --target en
  branches:
    main:
      - step:
          name: Check translations
          script:
            - pip install chki18n
            - chki18n ./locales --target en
```

:::

A step fails when a command in it exits non-zero, so the exit code is all the wiring there is.

To write the two blocks once rather than twice, define the step and point both at it:

```yaml
definitions:
  steps:
    - step: &check-translations
        name: Check translations
        script:
          - npx chki18n ./locales --target en

pipelines:
  pull-requests:
    '**':
      - step: *check-translations
  branches:
    main:
      - step: *check-translations
```

### Keeping the report

```yaml
- step:
    name: Check translations
    script:
      - npx chki18n ./locales --target en --output translation-report.md
    artifacts:
      - translation-report.md
```

The file is written before the command exits with `1`, so it exists whether the check passed or failed.

`--reporter list` is what a Bitbucket log reads best. There are no annotations to produce here, so nothing is gained by the `github` reporter:

```bash
chki18n ./locales --target en --reporter list
```

### Caching the install

Not required — the install is small — but it takes a second off every run:

::: lang js

```yaml
- step:
    name: Check translations
    caches:
      - node
    script:
      - npx chki18n ./locales --target en
```

`node` is one of Bitbucket's own caches, so nothing has to be defined for it.

:::

::: lang dart

```yaml
definitions:
  caches:
    pub: ~/.pub-cache

pipelines:
  pull-requests:
    '**':
      - step:
          name: Check translations
          caches:
            - pub
          script:
            - dart pub global activate chki18n
            - dart pub global run chki18n ./locales --target en
```

:::

::: lang py

```yaml
- step:
    name: Check translations
    caches:
      - pip
    script:
      - pip install chki18n
      - chki18n ./locales --target en
```

`pip` is one of Bitbucket's own caches, so nothing has to be defined for it.

:::

### Only when translations change

A step can be told which paths it cares about:

```yaml
- step:
    name: Check translations
    condition:
      changesets:
        includePaths:
          - 'locales/**'
    script:
      - npx chki18n ./locales --target en
```

## Adopting it on a project that has translations already

Turning this on for the first time on a real project usually reports more than anyone wants to fix that afternoon. Nothing about that has to block the build.

Start with the checks you already agree with, and add to the list as you clear them:

```bash
chki18n ./locales --target en --checks NO_KEY,NO_INTERPOLATION_KEY
```

Or start from everything and drop what is noisy in your project:

```bash
chki18n ./locales --target en --ignore-checks DUPLICATE_VALUE
```

Or keep every check and decide what an error is:

```bash
chki18n ./locales --target en --levels EMPTY_VALUE=error,NOT_TRANSLATED_VALUE=info
```

Every check, and what each one is for, is on [Checks](./checks). All three flags are on [Options](./options).

## When a command is not enough

If the gate your project wants is not "did anything fail" — a threshold, a per-language rule, a comment posted somewhere — read the result instead of the exit code:

::: lang js

```javascript
import { checkTranslationFiles } from 'chki18n';

const result = await checkTranslationFiles('./locales', { target: 'en' });
const untranslated = result.summary.byCode.NOT_TRANSLATED_VALUE ?? 0;

if (untranslated > 50) {
	console.error(`${untranslated} strings are still untranslated.`);
	process.exit(1);
}
```

:::

::: lang dart

```dart
import 'dart:io';

import 'package:chki18n/chki18n.dart';

final result = await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(target: 'en'),
);
final untranslated = result.summary.byCode[Chki18nCheckCode.notTranslatedValue] ?? 0;

if (untranslated > 50) {
  stderr.writeln('$untranslated strings are still untranslated.');
  exitCode = 1;
}
```

:::

::: lang py

```python
import sys

from chki18n import Options, check_translation_files

result = check_translation_files("./locales", Options(target="en"))
untranslated = result.summary.by_code.get("NOT_TRANSLATED_VALUE", 0)

if untranslated > 50:
    print(f"{untranslated} strings are still untranslated.", file=sys.stderr)
    sys.exit(1)
```

:::

The library never exits the process and never prints unless asked, so a script of your own decides both. See [`checkTranslationFiles`](/api/check-translation-files) and [The result object](/reference/result).

## See also

- [Command line](./cli) — every flag, and the report the job prints.
- [Options](./options) — the same options, from either side.
- [Checks](./checks) — what each check looks for, and its severity.
