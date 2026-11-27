# Changelog

## vNext (2026--)

> The first release. A port of the JavaScript package at version 1.3.0: the same twenty-five checks, the same option names, the same report, and the same exit code from the command line.

### Added

- `check_translation_files` reads a directory of translation files and compares every language against the target language, in one call
- `analyze_translations` compares translations passed in directly, with no file system work
- `create_analyzer` returns a reusable analyzer whose `check_entry` checks a single key again
- `load_translations` reads a directory once and returns a session that holds the parsed translations: `analyze`, `check_key`, `get`, `set`, `remove`, `keys`, `translations` and `reload` work on what is already in memory. `create_session` is the same for translations passed in directly
- Twenty-five checks. `NO_KEY`, `NO_LOCALE`, `DUPLICATE_KEY`, `NO_INTERPOLATION_KEY`, `EXTRA_INTERPOLATION_KEY` and `INTERPOLATION_COUNT` report at `error` and fail a run; `DUMMY_KEY`, `EMPTY_VALUE`, `INVALID_VALUE_TYPE`, `TAG_MISMATCH`, `NOT_TRANSLATED_VALUE`, `UNTRANSLATED_SCRIPT`, `DUPLICATE_VALUE`, `INCONSISTENT_VALUE`, `SURROUNDING_WHITESPACE`, `INVISIBLE_CHARACTER`, `MISSING_NUMBER`, `NUMBER_MISMATCH`, `NO_PLURAL_FORM`, `KEY_NAMING`, `KEY_DEPTH` and `UNDEFINED_KEY` at `warn`; `UNUSED_KEY` and `SUSPICIOUS_LENGTH` at `info`
- Every on-disk layout: one file per locale (`en.json`), one folder per locale (`en/common.json`), and one file holding every locale (`{"en": ...}`). Files holding the same keys are compared as a group
- Five reporters, `pretty`, `list`, `json`, `markdown` and `github`, and five grouping axes: `locale`, `code`, `group`, `file` and `none`. `output` writes a copy to a file, in the shape its extension implies
- The `chki18n` command, with the same flags as the other packages and a report that matches theirs character for character
