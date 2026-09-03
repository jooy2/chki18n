---
title: Command line
---

# Command line

The `chki18n` command checks a folder of translation files and prints what is wrong with them. It exits with `1` when it finds an error level issue, which is what makes it useful in a CI job or a pre-commit hook.

## Usage

```bash
npx chki18n [options] <targetDirectory>
```

The directory can be given as a bare argument or with `--path`; the two mean the same thing. A relative path is resolved against the current working directory.

```bash
npx chki18n ./locales
```

```bash
npx chki18n --path ./locales --target en
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
  --exclude <dirs>                Comma separated directory names to skip while scanning
  --source <dir>                  Search this directory of source files for key usages (enables `UNUSED_KEY`)
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

Every flag is also an API option with the same name in camelCase — `--ignore-checks` is `ignoreChecks` — because both are resolved from one definition. [Options](./options) documents them once, for both sides.

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

One section per language, because that is the unit a translator works in. Inside it the findings are grouped by check, worst first, with the number of occurrences after the code and the check's meaning under it. Each line names the key and, beside it, the target language's own wording — what the translation is being compared against. A finding with something specific to add puts it on the line below. When a project has more than one comparable set of files, the group follows the key after an `@`.

The summary answers the question the grouping left open: sections are per language, so the tally is per check. Group by check and the two swap places.

## Choosing a format

`--reporter` decides the shape of the report. Every one of them reports the same issues in the same order; only the text around them changes.

| Reporter   | What it is for                                                        |
| ---------- | --------------------------------------------------------------------- |
| `pretty`   | Reading in a terminal. Sections, colour and a summary. The default.   |
| `list`     | One line per issue, for `grep`, an editor or a CI log.                |
| `json`     | The whole result object, for another tool to read.                    |
| `markdown` | Tables, for a pull request comment or a report kept with the project. |
| `github`   | Workflow commands, so GitHub Actions annotates the files themselves.  |

```bash
npx chki18n ./locales --target en --reporter list
```

```text
ko  error  NO_KEY                attr.folder  en: "Folder"
ko  error  NO_INTERPOLATION_KEY  greeting     en: "Hello {name}"  The interpolation key `{name}` of the target language is missing from this value.
ko  warn   DUPLICATE_VALUE       dup-b        en: "Beta"  The key `dup-a` in the same locale already uses this value.

Found 2 errors, 3 warnings. Compared 5 keys across 3 locales in 1 group. (3ms)
```

Anything other than `pretty` prints the report and nothing else — no banner and no progress lines — so it can be piped straight into another program:

```bash
npx chki18n ./locales --target en --reporter json > report.json
```

`--debug` writes to standard error rather than standard output, so it never lands in a piped report.

## Fitting the terminal

The report is laid out to the terminal's own width, or to what `COLUMNS` says when there is no terminal to measure — which is how a CI runner usually reports its log width. A measured width is capped at 120 columns, because further apart than that the counts stop reading as part of the same line as their label.

`--width` overrides all of it, and is not capped:

```bash
npx chki18n ./locales --width 72
```

Descriptions wrap rather than being cut short, so a narrow terminal loses no wording. A file written by `--output` ignores the terminal entirely and uses a fixed width, unless `--width` says otherwise.

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
npx chki18n ./locales --target en --group-by code
```

Sections are ordered worst first: those with an error, then those with only warnings, then the rest. Within a section the same order applies, then the check order, then the key. Two runs over unchanged files print the same lines in the same places, which is what makes a saved report worth diffing.

`list`, `json` and `markdown` follow the grouping too — `list` only in its ordering, since it has no sections.

## Saving a report

`--output` writes the report to a file as well as to the terminal. The extension picks the format: `.json` and `.md` have one of their own, and anything else is written as plain text.

```bash
npx chki18n ./locales --target en --output translation-report.md
```

Missing directories are created. The file never contains colour codes, and it is laid out to a fixed width rather than to the terminal's, so the same run produces the same file anywhere.

`--reporter` wins when both are given, which is how you keep one format on screen and another on disk — or force a format the extension does not imply:

```bash
npx chki18n ./locales --target en --output report.txt --reporter list
```

A report that could not be written is an error like any other, so the run fails rather than reporting a file that is not there.

## Exit code

| Code | Meaning                                                             |
| ---- | ------------------------------------------------------------------- |
| `0`  | No error level issue. Warnings may still have been printed.         |
| `1`  | At least one error level issue, or the directory could not be read. |

Warnings never fail the run. If your project treats one of them as a blocker, promote it with `--levels`:

```bash
npx chki18n ./locales --target en --levels EMPTY_VALUE=error
```

## In CI

A GitHub Actions step is one line:

```yaml
- name: Check translations
  run: npx chki18n ./locales --target en
```

To keep the job green while you work through the warnings, narrow it to the checks you have already fixed:

```yaml
- name: Check translations
  run: npx chki18n ./locales --target en --checks NO_KEY,NO_INTERPOLATION_KEY
```

Or the other way round — everything except the noisy one:

```yaml
- name: Check translations
  run: npx chki18n ./locales --target en --ignore-checks DUPLICATE_VALUE
```

`--reporter github` turns each finding into a workflow command, which GitHub shows as an annotation on the translation file itself rather than as a line in a log:

```yaml
- name: Check translations
  run: npx chki18n ./locales --target en --reporter github
```

```text
::error file=locales/ko.json,title=chki18n NO_KEY::ko attr.folder The key exists in the target language but is missing here. (en: "Folder")
::warning file=locales/ko.json,title=chki18n EMPTY_VALUE::ko attr.open The key is defined but its value is an empty string. (en: "Open")
```

An `error` becomes an error annotation, a `warn` a warning and an `info` a notice. There is no line number to give — the checks work on parsed translations, and the commonest finding of all is a key that is not in the file to begin with — so an annotation points at the file.

The Markdown report is what a job summary wants:

```yaml
- name: Check translations
  run: npx chki18n ./locales --target en --output "$GITHUB_STEP_SUMMARY" --reporter markdown
```

To keep the result after the job is gone, write it out and upload it:

```yaml
- name: Check translations
  run: npx chki18n ./locales --target en --output translation-report.md
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: translation-report
    path: translation-report.md
```

## In a pre-commit hook

```bash
#!/bin/sh
npx chki18n ./locales --target en --no-info || exit 1
```

`--no-info` drops the heading block and the summary and leaves the issues, which is what you want in a hook that should be quiet when everything passes. `--no-warn` goes further and leaves only what fails the run; the report says how many issues it hid.

## Debugging a scan that finds nothing

`--debug` prints the resolved options, the layout that was detected, and every file that was read but did not belong to a locale:

```bash
npx chki18n ./locales --debug
```

If the answer is that no file matched, the layout is usually the reason — see [File layouts](./file-layouts), and force one with `--format`.
