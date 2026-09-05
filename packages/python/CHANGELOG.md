# Changelog

## 1.2.0 (2026-09-05)

> A scan can be pointed at an application's root rather than at a folder of locales. It skips the configuration and lock files that root is full of, an exclude can name a path rather than a bare directory name, and it reports which interpolation delimiters the files it read appear to use.

### Added

- `exclude_files` names the files a scan never reads, as patterns where `*` stands for any run of characters and case is ignored. It defaults to the configuration and lock files no project keeps translations in — `package.json`, `tsconfig.json`, `tsconfig.*.json`, `eslintrc.json`, `*-lock.json`, `*-config.json` and `*.config.json` — which a scan of an application root used to read and parse in full on every run. The default list is exported as `DEFAULT_EXCLUDE_FILES`, and `--exclude-files` is the flag
- `detect_interpolation_delimiters` guesses which delimiters a text writes its interpolation keys with: `{{name}}` before `{name}`, and `[[ ]]`, `(( ))` and `<< >>` after them. `ScanResult.detected_interpolation` reports what a whole scan saw, which `load_translations` carries as `session.detected_interpolation`. It is a suggestion for a project being set up, never what the run compared with — that stays `interpolation_prefix`. The pairs it knows are exported in order as `INTERPOLATION_DELIMITERS`
- `create_path_excluder` and `create_file_excluder` build the two tests a scan applies, so an application that shows a user which folders are excluded can ask the same question the scan asks

### Changed

- `exclude` accepts a path as well as a name. One segment still names a directory at any depth, so `node_modules` means every `node_modules` there is; an entry with a separator names a path from the scanned root, so `src/legacy` excludes that folder and everything under it without touching a `legacy` belonging to something else
- Both exclude lists apply to the source tree `source` names as well as to the translation directory

## 1.1.0 (2026-09-04)

> The target language is checked too. Everything else is compared against it, so it sat outside every check, and a mistake typed into the source language stayed there however often the files were checked.

### Changed

- The target language is now checked by everything that reads one value on its own: `EMPTY_VALUE`, `SURROUNDING_WHITESPACE`, `INVISIBLE_CHARACTER`, `INVALID_VALUE_TYPE` and `UNTRANSLATED_SCRIPT`. It was skipped outright before, so an empty string, a trailing space or a zero width character in `en.json` was never reported. The comparison checks still say nothing about it, since it is what they compare against. None of the five reports at `error`, so a run that passed still passes; switch one off with `ignore_checks` the way you would for any other language
- An issue about the target language's own value carries no `target_value`. What a report quotes beside a finding is the value it would be compared to, and for the target language that is the value already shown

### Fixed

- The `github` reporter writes the annotation's `file=` path with forward slashes on every platform. On a Windows runner it wrote the platform's own separator, which GitHub matches against nothing, so the annotation silently attached to no file
- The command writes UTF-8 to the console whatever its code page is. On Windows it printed the banner and then died with a `UnicodeEncodeError` half a report in, exiting `1` on a directory with nothing wrong

## 1.0.0 (2026-09-03)

> The first release. A port of the JavaScript package at the same version: the same twenty-five checks, the same option names, the same report, and the same exit code from the command line.

### Added

- `check_translation_files` reads a directory of translation files and compares every language against the target language, in one call
- `analyze_translations` compares translations passed in directly, with no file system work
- `create_analyzer` returns a reusable analyzer whose `check_entry` re-checks a single key
- `load_translations` reads a directory once and returns a session that holds the parsed translations: `analyze`, `check_key`, `get`, `set`, `remove`, `keys`, `translations` and `reload` all work on what is already in memory. `create_session` is the same for translations passed in directly
- Twenty-five checks. `NO_KEY`, `NO_LOCALE`, `DUPLICATE_KEY`, `NO_INTERPOLATION_KEY`, `EXTRA_INTERPOLATION_KEY` and `INTERPOLATION_COUNT` report at `error` and fail a run; `DUMMY_KEY`, `EMPTY_VALUE`, `INVALID_VALUE_TYPE`, `TAG_MISMATCH`, `NOT_TRANSLATED_VALUE`, `UNTRANSLATED_SCRIPT`, `DUPLICATE_VALUE`, `INCONSISTENT_VALUE`, `SURROUNDING_WHITESPACE`, `INVISIBLE_CHARACTER`, `MISSING_NUMBER`, `NUMBER_MISMATCH`, `NO_PLURAL_FORM`, `KEY_NAMING`, `KEY_DEPTH` and `UNDEFINED_KEY` at `warn`; `UNUSED_KEY` and `SUSPICIOUS_LENGTH` at `info`
- Every on-disk layout: one file per locale (`en.json`), one folder per locale (`en/common.json`), and one file holding every locale (`{"en": ...}`). Files holding the same keys are compared as a group
- Five reporters — `pretty`, `list`, `json`, `markdown` and `github` — and five grouping axes: `locale`, `code`, `group`, `file` and `none`. `output` writes a copy to a file, in the shape its extension implies
- The `chki18n` command, which takes the same options as the library and exits with `1` when an `error` level issue was found
- `chki18n.core`, the comparison on its own. It reaches no file system, so an application that must not touch the disk can import the checks without the scanner

### Notes on the port

- Options are one keyword-only frozen dataclass — `Options(target="en")` — rather than the twenty-four keyword arguments each entry point would otherwise carry. Every field is optional and every one has the JavaScript default
- Check codes, severities and the option choices are the same strings the JavaScript package uses, typed as `Literal`, so `"NO_KEY"` and `"error"` need no translating between the two. `checks` accepts a list or the comma separated text a flag gives it, and `levels` a mapping or the CLI's `CODE=level` list
- The entry points are synchronous. The JavaScript package is asynchronous because Node's file system is; Python's is not, and an `async` surface would be a promise this package cannot keep anything with
- A translation file whose JSON is not an object is reported as `INVALID_FILE` rather than read as an empty one
- No dependencies. The argument parser, the ANSI colours and the JSON key scanner are written out, because `argparse` cannot express `--no-x` as the negation of `x` and the other two would be a dependency each
