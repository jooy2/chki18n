---
title: Command line
---

# Command line

The `chki18n` command checks a folder of translation files and prints what is wrong with them. It exits with `1` when it finds an error level issue, so it drops straight into a CI job or a pre-commit hook.

Every package ships the same command, with the same flags and the same output. Only the way you get it onto your path differs.

::: lang js

```bash
# Run it without installing anything, which is what CI usually wants.
npx chki18n ./locales --target en

# Or install it, and the command is `chki18n`.
npm install chki18n
```

:::

::: lang dart

```bash
# Install the command once and it is on your path.
dart pub global activate chki18n

# Inside a project that already depends on it, without installing globally.
dart run chki18n ./locales --target en
```

:::

::: lang py

```bash
# Run it without installing anything, which is what CI usually wants.
pipx run chki18n ./locales --target en

# Or install it, and the command is `chki18n`.
pip install chki18n
```

:::

The rest of this page writes the command as `chki18n`.

## Usage

```bash
chki18n [options] <targetDirectory>
```

The directory can be given as a bare argument or with `--path`, and the two mean the same thing. A relative path is resolved against the current working directory.

```bash
chki18n ./locales
```

```bash
chki18n --path ./locales --target en
```

## Flags

```text
  --path <dir>                    The directory where the files to be scanned are located (required)
  --target <locale>               The language every other language is compared against (default: `en`)
  --format <format>               Layout of the translation files: `auto`, `single`, `folder` or `nested`
  --checks <codes>                Run only these comma separated check codes
  --ignore-checks <codes>         Run every check except these comma separated check codes
  --levels <code=level>           Report a check at another severity, e.g. `EMPTY_VALUE=error`
  --interpolation-prefix <str>    Opening delimiter of an interpolation key (default: `{`)
  --interpolation-suffix <str>    Closing delimiter of an interpolation key (default: `}`)
  --exclude <dirs>                Comma separated directory names or paths to skip while scanning
  --exclude-files <globs>         Comma separated file name patterns never read as translations
  --source <dir>                  Source files to read for key usages (enables `UNUSED_KEY` and `UNDEFINED_KEY`)
  --translate-functions <names>   Comma separated names a translation call goes by (default: `t`, `$t`, `translate`)
  --key-case <case>               Case every key segment has to use: `kebab`, `camel`, `snake`
  --max-key-depth <levels>        How many levels a key may be nested, e.g. `2` for `attr.folder`
  --length-ratio <times>          Report a value more than this many times longer or shorter than the target
  --reporter <name>               How to render the report: `pretty`, `list`, `json`, `markdown`, `github`
  --group-by <axis>               Group the reported issues by `locale`, `code`, `group`, `file`, `none`
  --output <file>                 Also write the report to this file, in the format its extension implies
  --width <columns>               Lay the report out to this many columns instead of measuring the terminal
  --no-color                      Do not colour the output
  --no-info                       Do not show info messages
  --no-warn                       Do not show warning messages
  --debug                         Show debug messages
  --help                          Show this message
  --version                       Show the installed version
```

Every flag is also an API option with the same name, so `--ignore-checks` is <Lang js="ignoreChecks" dart="ignoreChecks" py="ignore_checks" code />. Both are resolved from one definition, and [Options](./options) documents them once for both sides.

## Reading the output

```text
  Path     ./locales
  Target   en
  Locales  en, ja, ko
  Layout   single, 1 group, 5 keys

 ko ─────────────────────────────────────────────────────────────────────── 2 errors · 1 warning

  ERROR  NO_KEY (1)
         The key exists in the target language but is missing here.
    attr.folder  en: "Folder"

  ERROR  NO_INTERPOLATION_KEY (1)
    greeting     en: "Hello {name}"
      The interpolation key `{name}` of the target language is missing from this value.

  WARN   DUPLICATE_VALUE (1)
    dup-b        en: "Beta"
      The key `dup-a` in the same locale already uses this value.

 Summary ───────────────────────────────────────────────────────────────────────────────────────

  Compared 5 keys across 3 locales in 1 group. (3ms)
  2 errors · 3 warnings

  By check
    NO_INTERPOLATION_KEY  1 error
    NO_KEY                1 error
    DUPLICATE_VALUE       3 warnings

  FAIL  2 errors must be fixed before this passes.
```

One section per language, because that is the unit a translator works in. Inside it the findings are grouped by check, worst first, with the number of occurrences after the code and the check's meaning under it. Each line names the key and, beside it, the target language's own wording, which is what the translation is being compared against. A finding with something specific to add puts it on the line below. When a project has more than one comparable set of files, the group follows the key after an `@`.

The summary counts the axis the sections do not use. Sections per language give a tally per check, and grouping by check swaps the two.

## Choosing a format

`--reporter` decides the shape of the report. Every one of them reports the same issues in the same order, and only the text around them changes.

| Reporter   | What it is for                                                        |
| ---------- | --------------------------------------------------------------------- |
| `pretty`   | Reading in a terminal. Sections, colour and a summary. The default.   |
| `list`     | One line per issue, for `grep`, an editor or a CI log.                |
| `json`     | The whole result object, for another tool to read.                    |
| `markdown` | Tables, for a pull request comment or a report kept with the project. |
| `github`   | Workflow commands, so GitHub Actions annotates the files themselves.  |

```bash
chki18n ./locales --target en --reporter list
```

```text
ko  error  NO_KEY                attr.folder  en: "Folder"
ko  error  NO_INTERPOLATION_KEY  greeting     en: "Hello {name}"  The interpolation key `{name}` of the target language is missing from this value.
ko  warn   DUPLICATE_VALUE       dup-b        en: "Beta"  The key `dup-a` in the same locale already uses this value.

Found 2 errors, 3 warnings. Compared 5 keys across 3 locales in 1 group. (3ms)
```

Anything other than `pretty` prints the report and nothing else, with no banner and no progress lines, so it can be piped straight into another program:

```bash
chki18n ./locales --target en --reporter json > report.json
```

`--debug` writes to standard error rather than standard output, so it never lands in a piped report.

## Fitting the terminal

The report is laid out to the terminal's own width, or to what `COLUMNS` says when there is no terminal to measure, which is how a CI runner usually reports its log width. A measured width is capped at 120 columns, because past that the counts stop reading as part of the same line as their label.

`--width` overrides all of it, and is not capped:

```bash
chki18n ./locales --width 72
```

Descriptions wrap instead of being cut short, so a narrow terminal loses no wording. A file written by `--output` ignores the terminal entirely and uses a fixed width, unless `--width` says otherwise.

## Grouping the issues

`--group-by` decides what a section is. The default is `locale`.

| Axis     | One section per                                   |
| -------- | ------------------------------------------------- |
| `locale` | Language. What a translator fixes in one sitting. |
| `code`   | Check. What a maintainer fixes in one pass.       |
| `group`  | Comparable set of files, e.g. `common.json`.      |
| `file`   | Translation file on disk.                         |
| `none`   | Nothing. One list.                                |

```bash
chki18n ./locales --target en --group-by code
```

Sections are ordered worst first: those with an error, then those with only warnings, then the rest. Within a section the same order applies, then the check order, then the key. Two runs over unchanged files print the same lines in the same places, so two saved reports can be diffed.

`list`, `json` and `markdown` follow the grouping too. For `list` that shows only in the ordering, since it has no sections.

## Saving a report

`--output` writes the report to a file as well as to the terminal. The extension picks the format: `.json` and `.md` have one of their own, and anything else is written as plain text.

```bash
chki18n ./locales --target en --output translation-report.md
```

Missing directories are created. The file never contains colour codes, and it is laid out to a fixed width instead of the terminal's, so the same run produces the same file anywhere.

`--reporter` wins when both are given, so you can keep one format on screen and another on disk, or force a format the extension does not imply:

```bash
chki18n ./locales --target en --output report.txt --reporter list
```

A report that could not be written is an error like any other, so the run fails instead of claiming a file that is not there.

## Exit code

| Code | Meaning                                                             |
| ---- | ------------------------------------------------------------------- |
| `0`  | No error level issue. Warnings may still have been printed.         |
| `1`  | At least one error level issue, or the directory could not be read. |

Warnings never fail the run. If your project treats one of them as a blocker, promote it with `--levels`:

```bash
chki18n ./locales --target en --levels EMPTY_VALUE=error
```

## In CI

A GitHub Actions step is one line. [Continuous integration](./ci) has the whole job, and the Bitbucket Pipelines equivalent.

::: lang js

```yaml
- name: Check translations
  run: npx chki18n ./locales --target en
```

:::

::: lang dart

```yaml
- uses: dart-lang/setup-dart@v1
- name: Check translations
  run: |
    dart pub global activate chki18n
    dart pub global run chki18n ./locales --target en
```

:::

::: lang py

```yaml
- uses: actions/setup-python@v6
- name: Check translations
  run: |
    pip install chki18n
    chki18n ./locales --target en
```

:::

To keep the job green while you work through the warnings, narrow it to the checks you have already fixed:

```bash
chki18n ./locales --target en --checks NO_KEY,NO_INTERPOLATION_KEY
```

Or the other way round, every check except the noisy one:

```bash
chki18n ./locales --target en --ignore-checks DUPLICATE_VALUE
```

`--reporter github` turns each finding into a workflow command, which GitHub shows as an annotation on the translation file itself rather than as a line in a log:

```bash
chki18n ./locales --target en --reporter github
```

```text
::error file=locales/ko.json,title=chki18n NO_KEY::ko attr.folder The key exists in the target language but is missing here. (en: "Folder")
::warning file=locales/ko.json,title=chki18n EMPTY_VALUE::ko attr.open The key is defined but its value is an empty string. (en: "Open")
```

An `error` becomes an error annotation, a `warn` a warning and an `info` a notice. An annotation points at the file rather than a line, because the checks work on parsed translations and the commonest finding is a key that is not in the file at all.

The Markdown report is what a job summary wants:

```bash
chki18n ./locales --target en --output "$GITHUB_STEP_SUMMARY" --reporter markdown
```

To keep the result after the job is gone, write it out and upload it:

```yaml
- name: Check translations
  run: chki18n ./locales --target en --output translation-report.md
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: translation-report
    path: translation-report.md
```

## In a pre-commit hook

```bash
#!/bin/sh
chki18n ./locales --target en --no-info || exit 1
```

`--no-info` drops the heading block and the summary and leaves the issues, which suits a hook that should be quiet when everything passes. `--no-warn` goes further and leaves only what fails the run. Either way the report says how many issues it hid.

## When a scan finds nothing

`--debug` prints the resolved options, the layout that was detected, and every file that was read but did not belong to a locale:

```bash
chki18n ./locales --debug
```

If no file matched, the layout is usually the reason. See [File layouts](./file-layouts), and force one with `--format`.
