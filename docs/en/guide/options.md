---
title: Options
---

# Options

The command line and the API take the same options. Every CLI flag is an API option with the same name, resolved from one definition — so a flag and its option counterpart cannot drift apart, and what passes in CI passes in your build script.

Option names are written here in their JavaScript spelling. Dart uses the same one; Python is snake_case throughout, so `ignoreChecks` is `ignore_checks` and `maxKeyDepth` is `max_key_depth`. [Getting started](./getting-started#how-the-names-map) states that mapping once.

## The full set

| Option | CLI flag | Type | Default |
| --- | --- | --- | --- |
| `path` | `--path` | `string` | — |
| `target` | `--target` | `string` | `'en'` |
| `format` | `--format` | `'auto' \| 'single' \| 'folder' \| 'nested'` | `'auto'` |
| `checks` | `--checks` | `string[]` or a comma separated string | all |
| `ignoreChecks` | `--ignore-checks` | `string[]` or a comma separated string | none |
| `levels` | `--levels` | `Record<code, level>` or `CODE=level` pairs | none |
| `interpolationPrefix` | `--interpolation-prefix` | `string` | `'{'` |
| `interpolationSuffix` | `--interpolation-suffix` | `string` | `'}'` |
| `exclude` | `--exclude` | `string[]` or a comma separated string | see below |
| `source` | `--source` | `string` | — |
| `translateFunctions` | `--translate-functions` | `string[]` or a comma separated string | see below |
| `keyCase` | `--key-case` | `'kebab' \| 'camel' \| 'snake'` | — |
| `maxKeyDepth` | `--max-key-depth` | `number` | — |
| `lengthRatio` | `--length-ratio` | `number` | — |
| `reporter` | `--reporter` | `'pretty' \| 'list' \| 'json' \| 'markdown' \| 'github'` | `'pretty'` |
| `groupBy` | `--group-by` | `'locale' \| 'code' \| 'group' \| 'file' \| 'none'` | `'locale'` |
| `output` | `--output` | `string` | — |
| `color` | `--no-color` | `boolean` | `true` |
| `width` | `--width` | `number` | the terminal's |
| `info` | `--no-info` | `boolean` | `true` |
| `warn` | `--no-warn` | `boolean` | `true` |
| `debug` | `--debug` | `boolean` | `false` |
| `flattened` | — | `boolean` | `false` |
| `verbose` | — | `boolean` | `false` |

The last two are API-only: the CLI always prints, so `verbose` is set for you, and `flattened` describes data you pass in rather than a directory.

::: lang dart Dart takes all of them as one

`Chki18nOptions` object built with named parameters, and the closed value sets are enums — `Chki18nFileFormat.folder` rather than `'folder'`, `Chki18nCheckCode.noKey` rather than `'NO_KEY'`. The text forms a flag writes (`'NO_KEY,EMPTY_VALUE'`, `'EMPTY_VALUE=error'`) live on `Chki18nTextOptions`, which `Chki18nOptions.text` carries, so no field has to accept two types.

:::

::: lang py Python takes all of them as one

keyword-only `Options` object, and the closed value sets stay the strings they are everywhere else: `format="folder"`, `checks=["NO_KEY"]`, `levels={"EMPTY_VALUE": "error"}`. A list option also accepts the comma separated text a flag gives it.

:::

## Path and target

### `path`

The directory holding the translation files. On the CLI it is also the bare positional argument, so these are the same:

```bash
chki18n ./locales
chki18n --path ./locales
```

A relative path resolves against the current working directory. From code it is the first argument, and the `path` option is accepted too — it wins when both are given, which is what the CLI relies on.

### `target`

The language every other language is compared against — the one you write first. Defaults to `en`, and a run that falls back to the default says so at `info` level rather than failing.

```bash
chki18n ./locales --target ko
```

If the target language is not among the scanned files there is nothing to compare against, and that is an error rather than a silent pass.

## Layout

### `format`

Which on-disk layout to read. `auto` decides from the paths, which is right nearly always; force it when the detection guesses wrong or when you want a mismatch to fail loudly.

```bash
chki18n ./locales --format folder
```

See [File layouts](./file-layouts) for what each value means.

### `exclude`

Directory names to skip while scanning. **Replaces** the default list rather than adding to it:

```text
node_modules  dist  build  out  coverage
.git  .next  .nuxt  .svelte-kit  .turbo  .cache
```

```bash
chki18n . --exclude node_modules,dist,fixtures
```

The default list is exported as `DEFAULT_EXCLUDE_DIRS` if you would rather extend it than replace it:

::: lang js

```javascript
import { DEFAULT_EXCLUDE_DIRS } from 'chki18n';

await checkTranslationFiles('.', { exclude: [...DEFAULT_EXCLUDE_DIRS, 'fixtures'] });
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

await checkTranslationFiles(
  path: '.',
  options: const Chki18nOptions(exclude: [...defaultExcludeDirs, 'fixtures']),
);
```

:::

::: lang py

```python
from chki18n import DEFAULT_EXCLUDE_DIRS, Options, check_translation_files

check_translation_files(".", Options(exclude=[*DEFAULT_EXCLUDE_DIRS, "fixtures"]))
```

:::

Hidden entries — anything starting with `.` — are always skipped, whatever this is set to.

### `source`

A directory of source files to search for key usages, which is what the [`UNUSED_KEY`](./checks#unused-key) check needs. Without it that check reports nothing.

```bash
chki18n ./locales --target en --source ./src
```

Only text files are read, anything over 5MB is skipped, and `exclude` applies here as well. The project's own translation files are never searched.

The same directory answers [`UNDEFINED_KEY`](./checks#undefined-key), which asks the opposite question: which keys the source calls for that no language file defines.

### `translateFunctions`

The names a translation call goes by, which is how `UNDEFINED_KEY` finds the keys the source asks for. **Replaces** the default list rather than adding to it:

```text
t  $t  translate
```

Those three cover i18next, react-i18next and vue-i18n between them, including `i18n.t` and a `t` bound by `useTranslation`, because a call is matched wherever its name ends. The `i18nKey` attribute a `<Trans>` component takes is always read.

```bash
chki18n ./locales --source ./src --translate-functions t,trans,__
```

The default list is exported as `TRANSLATION_FUNCTIONS` if you would rather extend it than replace it.

## Key and value limits

Three options exist only to give a check something to compare against. Each one is off until it is set, because none of them has a right answer of its own — only the one your project chose.

### `keyCase`

The case every segment of a key has to be written in, which is what [`KEY_NAMING`](./checks#key-naming) compares against: `kebab`, `camel` or `snake`.

```bash
chki18n ./locales --key-case kebab
```

The plural and context suffixes an i18n library appends — `item-count_one`, `greeting_male` — are accepted whatever case you chose.

### `maxKeyDepth`

How many levels a key may be nested, for [`KEY_DEPTH`](./checks#key-depth). `2` allows `attr.folder` and reports `attr.folder.name`.

```bash
chki18n ./locales --max-key-depth 2
```

### `lengthRatio`

How many times longer or shorter than its original a value may be before [`SUSPICIOUS_LENGTH`](./checks#suspicious-length) reports it. `4` allows a quarter to four times.

```bash
chki18n ./locales --length-ratio 4
```

Lengths are counted in columns rather than characters, so a Korean or Japanese value is not short by default, and originals under eight columns are skipped.

## Choosing checks

### `checks`

Run only these. Accepts an array or a comma separated string, case-insensitively:

```bash
chki18n ./locales --checks NO_KEY,NO_INTERPOLATION_KEY
```

::: lang js

```javascript
await checkTranslationFiles('./locales', { checks: ['NO_KEY', 'NO_INTERPOLATION_KEY'] });
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(
    checks: [Chki18nCheckCode.noKey, Chki18nCheckCode.noInterpolationKey],
  ),
);
```

:::

::: lang py

```python
check_translation_files("./locales", Options(checks=["NO_KEY", "NO_INTERPOLATION_KEY"]))
```

:::

### `ignoreChecks`

Run everything except these:

```bash
chki18n ./locales --ignore-checks DUPLICATE_VALUE
```

Combining the two is not allowed: `checks` wins, and an `INVALID_OPTIONS` issue says `ignoreChecks` was ignored. An unknown code is reported the same way and skipped, rather than failing the run — a typo in one flag should not stop the rest of the scan.

### `levels`

Report a check at another severity. Accepts an object or `CODE=level` pairs:

```bash
chki18n ./locales --levels EMPTY_VALUE=error,DUPLICATE_VALUE=info
```

::: lang js

```javascript
await checkTranslationFiles('./locales', { levels: { EMPTY_VALUE: 'error' } });
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(
    levels: {Chki18nCheckCode.emptyValue: Chki18nLevel.error},
  ),
);
```

:::

::: lang py

```python
check_translation_files("./locales", Options(levels={"EMPTY_VALUE": "error"}))
```

:::

Only comparison checks can be re-graded; `INVALID_FILE` and `INVALID_OPTIONS` report how the run itself went and keep their level.

## Interpolation

### `interpolationPrefix` / `interpolationSuffix`

The delimiters that mark a placeholder. Defaults are `{` and `}`; `{{ }}`, `[[ ]]` and `%{ }` are all common in the wild.

```bash
chki18n ./locales --interpolation-prefix "{{" --interpolation-suffix "}}"
```

Getting this wrong does not produce a wrong answer so much as no answer: unrecognised placeholders mean both interpolation checks find nothing and pass quietly.

## Output

### `reporter`

The shape of the report: `pretty` for a terminal, `list` for one line per issue, `json` for another program, `markdown` for a table, and `github` for the workflow commands GitHub Actions turns into annotations on the files themselves. Every reporter carries the same issues in the same order.

```bash
chki18n ./locales --reporter json > report.json
```

::: lang js

```javascript
import { formatResult, resolveOptions } from 'chki18n';

const { options } = resolveOptions({ target: 'en', reporter: 'markdown' });

formatResult(result, options); // the report as a string
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

final resolved = resolveOptions(
  const Chki18nOptions(target: 'en', reporter: Chki18nReporter.markdown),
);

formatResult(result, resolved.options); // the report as a string
```

:::

::: lang py

```python
from chki18n import Options, format_result, resolve_options

options, _ = resolve_options(Options(target="en", reporter="markdown"))

format_result(result, options)  # the report as a string
```

:::

Anything other than `pretty` prints the report on its own, with no banner and no progress lines, so it can be piped straight into another program. An unknown name is reported as an `INVALID_OPTIONS` issue and falls back to `pretty`.

### `groupBy`

What a section of the report is: `locale` (the default), `code`, `group`, `file` or `none`. Grouping by language matches how a translator works; grouping by check matches how a maintainer fixes things.

```bash
chki18n ./locales --group-by code
```

Sections with an error come first, then those with only warnings. The order is fixed for a given set of files, so two reports of the same translations can be compared line by line.

<Lang js="groupIssues" dart="groupIssues" py="group_issues" code /> is exported if you would rather do the grouping yourself:

::: lang js

```javascript
import { groupIssues } from 'chki18n';

groupIssues(result.issues, 'locale'); // [{ id, label, issues, counts }, ...]
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

groupIssues(result.issues, Chki18nGroupBy.locale); // [Chki18nIssueGroup, ...]
```

:::

::: lang py

```python
from chki18n import group_issues

group_issues(result.issues, "locale")  # [IssueGroup(id=…, label=…, issues=…, counts=…), …]
```

:::

### `output`

A file to write the report to, in addition to the terminal. The extension picks the reporter — `.json` and `.md` have one of their own, anything else is plain text — and `reporter` overrides it when both are given.

```bash
chki18n ./locales --output report.md
```

Missing directories are created, colour codes are never written, and the layout uses a fixed width rather than the terminal's, so the same run produces the same file anywhere. A write that fails is reported as an error and fails the run.

### `color`

Whether to colour the terminal report. On by default where the terminal supports it, and `--no-color` turns it off. A file written by `output` is never coloured, whatever this says.

### `width`

Columns to lay the report out to. Without it the terminal's own width is used, then `COLUMNS`, then 96 — and a measured width is capped at 120, since further apart than that the counts stop reading as part of the same line as their label. What `width` asks for is not capped.

```bash
chki18n ./locales --width 72
```

Descriptions wrap rather than being cut short, so a narrow report loses no wording. A file written by `output` ignores the terminal and uses the fixed default, unless `width` says otherwise, so the same run produces the same file anywhere.

### `info`, `warn`, `debug`

What the CLI prints. `--no-info` drops the heading block and the summary, `--no-warn` drops warning level issues, and `--debug` adds the resolved options, the detected layout and every file that was skipped.

```bash
chki18n ./locales --no-info
```

These affect printing only. A suppressed warning is still in `result.issues`, still counted in `result.summary`, and still present in the `json` report, which is the whole result rather than a rendering of it. When something is hidden, the report says how many.

`--debug` writes to standard error, so it never lands in a report piped out of standard output.

### `verbose`

API-only. The library prints nothing unless this is set, so importing it cannot pollute a host application's output. The CLI sets it for you.

::: lang js

```javascript
await checkTranslationFiles('./locales', { verbose: true });
```

:::

::: lang dart

```dart
await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(verbose: true),
);
```

:::

::: lang py

```python
check_translation_files("./locales", Options(verbose=True))
```

:::

## Data

### `flattened`

API-only. Says the translations you are passing in already use flat keys (`'desc.hello'`) rather than nested objects, so the flatten pass is skipped entirely. This is what makes analysing data you already hold allocation-free:

::: lang js

```javascript
analyzeTranslations({ locales: { en, ko } }, { target: 'en', flattened: true });
```

:::

::: lang dart

```dart
analyzeTranslations(
  Chki18nInput(locales: {'en': en, 'ko': ko}),
  options: const Chki18nOptions(target: 'en', flattened: true),
);
```

:::

::: lang py

```python
analyze_translations(Input(locales={"en": en, "ko": ko}), Options(target="en", flattened=True))
```

:::

Setting it when the data is actually nested does not error — it compares the top-level keys and finds very little.

## Resolving options yourself

<Lang js="resolveOptions" dart="resolveOptions" py="resolve_options" code /> applies the defaults and normalises the loose forms, and reports what it could not use rather than raising:

::: lang js

```javascript
import { argsToOptions, resolveOptions } from 'chki18n';

const { options, issues } = resolveOptions({ target: 'ko', ignoreChecks: 'NO_KEY' });

options.enabledChecks; // Set of the codes that will run
issues; // anything unusable, as INVALID_OPTIONS issues

// The CLI form resolves to exactly the same thing
resolveOptions(argsToOptions({ _: [], target: 'ko', 'ignore-checks': 'NO_KEY' }));
```

:::

::: lang dart

```dart
import 'package:chki18n/chki18n.dart';

final resolved = resolveOptions(
  const Chki18nOptions(target: 'ko', ignoreChecks: [Chki18nCheckCode.noKey]),
);

resolved.options.enabledChecks; // Set of the codes that will run
resolved.issues; // anything unusable, as INVALID_OPTIONS issues

// The CLI form resolves to exactly the same thing
resolveOptions(optionsFromArgs({'_': <String>[], 'target': 'ko', 'ignore-checks': 'NO_KEY'}));
```

:::

::: lang py

```python
from chki18n import Options, options_from_args, resolve_options

options, issues = resolve_options(Options(target="ko", ignore_checks="NO_KEY"))

options.enabled_checks  # frozenset of the codes that will run
issues  # anything unusable, as INVALID_OPTIONS issues

# The CLI form resolves to exactly the same thing
resolve_options(options_from_args({"_": [], "target": "ko", "ignore-checks": "NO_KEY"}))
```

:::

<Lang js="OPTION_DEFINITIONS" dart="optionDefinitions" py="OPTION_DEFINITIONS" code /> is the table both sides are built from, if you are generating a UI or a help text of your own.
