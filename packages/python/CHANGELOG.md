# Changelog

## vNext (2026--)

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
