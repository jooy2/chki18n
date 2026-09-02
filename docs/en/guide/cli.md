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
  --no-info                       Do not show info messages
  --no-warn                       Do not show warning messages
  --debug                         Show debug messages
  --help                          Show this message
  --version                       Show the installed version
```

Every flag is also an API option with the same name in camelCase — `--ignore-checks` is `ignoreChecks` — because both are resolved from one definition. [Options](./options) documents them once, for both sides.

## Reading the output

```text
 Chki18n  INFO  Process to check specified translation files... (Current path: /project/locales)
 Chki18n  INFO  This comparison is based on the following language: en

 Chki18n  ERROR  [NO_KEY] Some translation files did not include the following keys (2):
 - ko -> 'attr.folder' (en: "Folder")
 - ja @common.json -> 'attr.open' (en: "Open")

 Chki18n  WARN  [DUPLICATE_VALUE] Some keys have duplicate values (1):
 - ko -> 'dup-b' (en: "Beta") The key `dup-a` in the same locale already uses this value.

 Chki18n  INFO  Compared 11 keys across 3 locales in 2 groups. (4ms)
 Chki18n  INFO  Found 2 errors and 1 warning.
```

Issues are grouped by check code, with the number of occurrences in the heading. Each line names the locale, the key and — when the project has more than one group of files — the group it belongs to, after an `@`. In brackets is the target language's own wording, which is what the translation is being compared against. A check that produced a specific explanation adds it at the end of the line.

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

## In a pre-commit hook

```bash
#!/bin/sh
npx chki18n ./locales --target en --no-info || exit 1
```

`--no-info` drops the progress lines and leaves the issues, which is what you want in a hook that should be quiet when everything passes.

## Debugging a scan that finds nothing

`--debug` prints the resolved options, the layout that was detected, and every file that was read but did not belong to a locale:

```bash
npx chki18n ./locales --debug
```

If the answer is that no file matched, the layout is usually the reason — see [File layouts](./file-layouts), and force one with `--format`.
