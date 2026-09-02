# Changelog

## 0.4.0 (2026-09-02)

> The check logic no longer depends on the file system, so the module can also validate translations an application already holds in memory.

### Added

- `analyzeTranslations` compares translations passed in directly, with no file system work
- `createAnalyzer` returns a reusable analyzer whose `checkEntry` re-checks a single key
- `EXTRA_INTERPOLATION_KEY`, `SURROUNDING_WHITESPACE`, `MISSING_NUMBER` and `INVALID_VALUE_TYPE` checks
- Support for the folder-per-locale (`en/common.json`) and single-file-per-project (`{ "en": ... }`) layouts, alongside the existing one-file-per-locale layout. Files holding the same keys are compared as a group, so several translation files no longer share one pile of keys
- `checks`, `ignoreChecks`, `format`, `exclude` and the interpolation delimiter options, available both as CLI flags and as JavaScript options
- `--help` and `--version`

### Changed

- The result now carries every issue, whether the run passed or failed, as a flat `issues` list plus `issuesByCode` and a `summary` with per-level, per-code, per-locale and per-group counts. Each issue has its own `level`, `message` and originating `file`
- `CHECK_META` describes each check's severity and wording, so a user interface does not have to hard-code them
- The CLI moved to its own entry point (`dist/cli.js`). Importing the module has no side effect and never writes to the console or exits the process
- The package now publishes `types`, so TypeScript consumers get the result shape
- Analysis is linear in the number of keys rather than quadratic: comparing 5,000 keys across 5 locales went from about 10.8s to about 26ms

### Fixed

- `EMPTY_VALUE` and `DUMMY_KEY` were written so their conditions could never be true, and never reported anything
- A missing target language file threw instead of being reported

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
