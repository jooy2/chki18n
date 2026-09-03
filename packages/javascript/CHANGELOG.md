# Changelog

## vNext

> The check logic no longer depends on the file system, so the module can also validate translations an application already holds in memory.

### Added

- `analyzeTranslations` compares translations passed in directly, with no file system work
- `createAnalyzer` returns a reusable analyzer whose `checkEntry` re-checks a single key
- `loadTranslations` reads a directory once and returns a session that holds the parsed translations: `analyze`, `checkKey`, `get`, `set`, `remove`, `keys`, `translations` and `reload` all work on what is already in memory. `createSession` is the same for translations passed in directly
- `EXTRA_INTERPOLATION_KEY`, `SURROUNDING_WHITESPACE`, `MISSING_NUMBER` and `INVALID_VALUE_TYPE` checks
- `DUPLICATE_KEY`, which catches a key defined twice — both the literal kind (`{"a": 1, "a": 2}`, which `JSON.parse` resolves silently) and the kind where a nested key and a dotted one flatten onto each other
- `UNUSED_KEY`, reported at `info`, for keys nothing in a `source` directory appears to reference. An application that has already worked this out can pass its own answer as `unusedKeys` instead
- `source`, the directory the unused-key scan searches
- Support for the folder-per-locale (`en/common.json`) and single-file-per-project (`{ "en": ... }`) layouts, alongside the existing one-file-per-locale layout. Files holding the same keys are compared as a group, so several translation files no longer share one pile of keys
- `Chki18nInput` accepts `issues` and `fileFormat`, so whatever produced the input can report its own problems into the same result
- `chki18n/core`, a subpath that exports the comparison engine on its own. It imports no Node built-in, so it bundles for a browser or an editor's renderer process
- `checks`, `ignoreChecks`, `levels`, `format`, `exclude` and the interpolation delimiter options, available both as CLI flags and as JavaScript options
- `--help` and `--version`
- `reporter`, which decides the shape of the report: `pretty` for a terminal, `list` for one line per issue, `json` for another program to read, and `markdown` for a table. Everything but `pretty` prints the report alone, with no banner, so it can be piped straight into something else
- `groupBy`, the axis the report groups its issues by: `locale` (the default), `code`, `group`, `file` or `none`
- `output`, a file the report is written to as well as the terminal. The extension picks the format, an explicit `reporter` overrides it, missing directories are created, and a write that fails is reported as an error and fails the run
- `color`, and `--no-color` with it. A file written by `output` is never coloured
- `formatResult` and `groupIssues` are exported, so an application can render a result the way the CLI does, along with `displayWidth`, `padTo` and `truncate` for laying out columns of its own

### Changed

- The result now carries every issue, whether the run passed or failed, as a flat `issues` list plus `issuesByCode` and a `summary` with per-level, per-code, per-locale and per-group counts. Each issue has its own `level`, `message` and originating `file`
- `CHECK_META` describes each check's severity and wording, so a user interface does not have to hard-code them
- The CLI report was rebuilt around what the reader is looking for: a heading block naming what was scanned, one section per language with its own tally, each check's meaning printed once above its findings, and a summary that counts the axis the sections did not use. Columns are laid out by display width, so a Korean, Japanese or Chinese value no longer pushes the ones beside it out of line
- `--no-info` drops the heading block and the summary rather than only the progress lines, and `--debug` writes to standard error so a report piped out of standard output stays parseable
- The CLI moved to its own entry point (`dist/cli.js`). Importing the module has no side effect and never writes to the console or exits the process
- The package now publishes `types`, so TypeScript consumers get the result shape
- Analysis is linear in the number of keys rather than quadratic: comparing 5,000 keys across 5 locales went from about 10.8s to about 26ms

### Fixed

- `--no-warn` hid the heading of a warning but still printed the lines under it. A suppressed issue is now left out entirely, and the report says how many it hid
- `EMPTY_VALUE` and `DUMMY_KEY` were written so their conditions could never be true, and never reported anything
- A missing target language file threw instead of being reported
- A relative path was joined as if it were absolute, so a scan rooted at one found nothing. Paths now resolve against the working directory
- An explicit `path` option was overridden by the (absent) first argument, which is how the CLI passes it

## 0.1.0 ~ 0.3.0 (2026-04-14 ~ 2026-04-17) (Beta)

> This is for the Beta release. It can be used in production, but some features are still under development.

- Cleanup and refactoring (0.1.0)
- Improved error handling (0.1.0)
- Fix and cleanup codes (0.2.0)
- Add `NO_INTERPOLATION_KEY` check (0.2.0)
- Base JS function support (0.3.0)

## 0.0.1 ~ 0.0.5 (2026-04-14) (Alpha)

> This is for the Alpha release and is not recommended for use

- Initial release
