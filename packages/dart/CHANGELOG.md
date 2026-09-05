# Changelog

## vNext (2026--)

> A scan can be pointed at an application's root rather than at a folder of locales. It skips the configuration and lock files that root is full of, and an exclude can name a path rather than a bare directory name.

### Added

- `excludeFiles` names the files a scan never reads, as patterns where `*` stands for any run of characters and case is ignored. It defaults to the configuration and lock files no project keeps translations in — `package.json`, `tsconfig.json`, `tsconfig.*.json`, `eslintrc.json`, `*-lock.json`, `*-config.json` and `*.config.json` — which a scan of an application root used to read and parse in full on every run. The default list is exported as `defaultExcludeFiles`, and `--exclude-files` is the flag
- `createPathExcluder` and `createFileExcluder` build the two tests a scan applies, so an application that shows a user which folders are excluded can ask the same question the scan asks

### Changed

- `exclude` accepts a path as well as a name. One segment still names a directory at any depth, so `node_modules` means every `node_modules` there is; an entry with a separator names a path from the scanned root, so `src/legacy` excludes that folder and everything under it without touching a `legacy` belonging to something else
- Both exclude lists apply to the source tree `source` names as well as to the translation directory

## 1.1.0 (2026-09-04)

> The target language is checked too. Everything else is compared against it, so it sat outside every check, and a mistake typed into the source language stayed there however often the files were checked.

### Changed

- The target language is now checked by everything that reads one value on its own: `EMPTY_VALUE`, `SURROUNDING_WHITESPACE`, `INVISIBLE_CHARACTER`, `INVALID_VALUE_TYPE` and `UNTRANSLATED_SCRIPT`. It was skipped outright before, so an empty string, a trailing space or a zero width character in `en.json` was never reported. The comparison checks still say nothing about it, since it is what they compare against. None of the five reports at `error`, so a run that passed still passes; switch one off with `ignoreChecks` the way you would for any other language
- An issue about the target language's own value carries no `targetValue`. What a report quotes beside a finding is the value it would be compared to, and for the target language that is the value already shown

### Fixed

- The `github` reporter writes the annotation's `file=` path with forward slashes on every platform. On a Windows runner it wrote the platform's own separator, which GitHub matches against nothing, so the annotation silently attached to no file

## 1.0.0 (2026-09-03)

> The first release. A port of the JavaScript package at the same version: the same twenty-five checks, the same option names, the same report, and the same exit code from the command line.

### Added

- `checkTranslationFiles` reads a directory of translation files and compares every language against the target language, in one call
- `analyzeTranslations` compares translations passed in directly, with no file system work
- `createAnalyzer` returns a reusable analyzer whose `checkEntry` re-checks a single key
- `loadTranslations` reads a directory once and returns a session that holds the parsed translations: `analyze`, `checkKey`, `get`, `set`, `remove`, `keys`, `translations` and `reload` all work on what is already in memory. `createSession` is the same for translations passed in directly
- Twenty-five checks. `NO_KEY`, `NO_LOCALE`, `DUPLICATE_KEY`, `NO_INTERPOLATION_KEY`, `EXTRA_INTERPOLATION_KEY` and `INTERPOLATION_COUNT` report at `error` and fail a run; `DUMMY_KEY`, `EMPTY_VALUE`, `INVALID_VALUE_TYPE`, `TAG_MISMATCH`, `NOT_TRANSLATED_VALUE`, `UNTRANSLATED_SCRIPT`, `DUPLICATE_VALUE`, `INCONSISTENT_VALUE`, `SURROUNDING_WHITESPACE`, `INVISIBLE_CHARACTER`, `MISSING_NUMBER`, `NUMBER_MISMATCH`, `NO_PLURAL_FORM`, `KEY_NAMING`, `KEY_DEPTH` and `UNDEFINED_KEY` at `warn`; `UNUSED_KEY` and `SUSPICIOUS_LENGTH` at `info`
- Every on-disk layout: one file per locale (`en.json`), one folder per locale (`en/common.json`), and one file holding every locale (`{"en": ...}`). Files holding the same keys are compared as a group
- Five reporters — `pretty`, `list`, `json`, `markdown` and `github` — and five grouping axes: `locale`, `code`, `group`, `file` and `none`. `output` writes a copy to a file, in the shape its extension implies
- The `chki18n` command, which takes the same options as the library and exits with `1` when an `error` level issue was found. Install it with `dart pub global activate chki18n`
- `package:chki18n/core.dart`, the comparison on its own. It imports no `dart:io`, so it runs in a Flutter web build or anywhere else the file system is not there

### Notes on the port

- Options are one object with named parameters — `Chki18nOptions(target: 'en')` — rather than the twenty-four named parameters each entry point would otherwise carry. Every field is optional and every one has the JavaScript default
- Enums replace the string unions: `Chki18nCheckCode.noKey`, `Chki18nLevel.error`, `Chki18nFileFormat.single`. Each carries the spelling the CLI and the JSON reporter share, so `Chki18nCheckCode.noKey.code` is `NO_KEY` in every package
- The loose text forms a command line writes — `'NO_KEY,EMPTY_VALUE'`, `'EMPTY_VALUE=error'` — live on `Chki18nTextOptions` rather than being a second accepted type on every field. `resolveOptions` reads both, and a typed field wins over the text one
- A translation file whose JSON is not an object is reported as `INVALID_FILE` rather than read as an empty one
- No dependencies. The argument parser, the ANSI colours and the path helpers are written out, because `args`, `chalk` and `package:path` would be the only three
