# Changelog

## vNext (2026--)

### Fixed

- The `github` reporter writes the annotation's `file=` path with forward slashes on every platform. On a Windows runner it wrote the platform's own separator, which GitHub matches against nothing, so the annotation silently attached to no file

## 1.0.0 (2026-09-03)

> The first stable release. The checks no longer depend on the file system, so they run against translations an application already holds in memory as well as against a folder of files; the report was rebuilt around what a reader is looking for, and can be written as JSON, Markdown or GitHub annotations; and the comparison grew to twenty-five checks.

### Breaking changes

- A project that passed on `0.3.0` can fail on this release. Four of the checks added report at `error` — `NO_LOCALE`, `DUPLICATE_KEY`, `EXTRA_INTERPOLATION_KEY` and `INTERPOLATION_COUNT` — and `EMPTY_VALUE` and `DUMMY_KEY` were fixed to report at all. Everything else added reports at `warn` or `info`, which never fails a run. Switch off what a project does not want with `ignoreChecks`, or `--ignore-checks` on the command line
- The CLI report was rebuilt around what the reader is looking for: a heading block naming what was scanned, one section per language with its own tally, each check's meaning printed once above its findings, and a summary that counts the axis the sections did not use. Columns are laid out by display width, so a Korean, Japanese or Chinese value no longer pushes the ones beside it out of line. Nothing should read the text of that report — anything that used to parse standard output wants `--reporter json`
- `--no-info` drops the heading block and the summary rather than only the progress lines, and `--debug` writes to standard error so a report piped out of standard output stays parseable
- The CLI moved to its own entry point (`dist/cli.js`), which the `chki18n` binary points at. Importing the module has no side effect and never writes to the console or exits the process, so an import that ran the CLI has to call `checkTranslationFiles` instead
- The result now carries every issue, whether the run passed or failed, as a flat `issues` list plus `issuesByCode` and a `summary` with per-level, per-code, per-locale and per-group counts. Each issue has its own `level`, `message` and originating `file`. Code that read the old shape has to move to these fields

### Added

- `analyzeTranslations` compares translations passed in directly, with no file system work
- `createAnalyzer` returns a reusable analyzer whose `checkEntry` re-checks a single key
- `loadTranslations` reads a directory once and returns a session that holds the parsed translations: `analyze`, `checkKey`, `get`, `set`, `remove`, `keys`, `translations` and `reload` all work on what is already in memory. `createSession` is the same for translations passed in directly
- `EXTRA_INTERPOLATION_KEY`, `SURROUNDING_WHITESPACE`, `MISSING_NUMBER` and `INVALID_VALUE_TYPE` checks
- `NO_LOCALE`, for a group of files that holds nothing for a language the other groups have. Until now a translation file nobody created dropped out of the comparison entirely and the run passed
- `INTERPOLATION_COUNT`, for a placeholder used a different number of times than the target language uses it. The two interpolation checks compare which placeholders a value has, so `{name} invited {name}` translated with one `{name}` passed both
- `TAG_MISMATCH`, for markup a translation dropped, added or left unbalanced. Tags are counted rather than looked for, and read case-insensitively
- `UNTRANSLATED_SCRIPT`, for a value holding no character of the script its language is written in. `NOT_TRANSLATED_VALUE` only catches a translation identical to the original, so `Hello` becoming `Hello!` passed it
- `INVISIBLE_CHARACTER`, for a zero width space, a byte order mark, a bidirectional control or a non-breaking space
- `NUMBER_MISMATCH`, for a number the translation changed rather than dropped. `MISSING_NUMBER` only asks whether any digits survived
- `INCONSISTENT_VALUE`, for two keys sharing one target language string that a locale translates two different ways. `DUPLICATE_VALUE` asks whether one locale repeats itself; this asks the opposite
- `KEY_NAMING` and `KEY_DEPTH`, for the shape of a key rather than what it translates to. Both wait for `keyCase` and `maxKeyDepth` to say what the project wants, and are judged once per key rather than once per locale
- `keyCase` and `maxKeyDepth`, the options those two compare against. `keyCase` accepts the plural and context suffixes an i18n library appends, whatever case the project uses
- `UNDEFINED_KEY`, the reverse of `UNUSED_KEY` and the more serious of the two: the scanned source calls for a key and no language file defines it. Reads the calls it finds under `source`, and lets through a key built at run time, one reached through a bound prefix, and a plural key asked for by its base
- `translateFunctions`, the names a translation call goes by. The default covers i18next, react-i18next and vue-i18n
- `NO_PLURAL_FORM`, for a plural key missing a form its language needs. Which forms a language needs is a fact about the language rather than about the original: English writes two, Russian four, Korean one. The older i18next pairing of a bare key with `_plural` is left as ordinary keys, and a language the table does not cover is never judged
- `SUSPICIOUS_LENGTH`, reported at `info`, for a value far longer or shorter than the one it translates. Waits for `lengthRatio`, and measures columns rather than characters so a Korean or Japanese value is not short by default
- `lengthRatio`, the option it compares against
- `checkKeyShape` and `displayWidth` are exported, so an editor can judge a key the user is still typing and lay a value out the way the report does
- `extractTags`, `extractNumbers`, `findInvisibleCharacter`, `scriptOfLocale` and `hasTranslatableText` are exported, so an editor can run the same measurements on a value it is holding
- `DUPLICATE_KEY`, which catches a key defined twice — both the literal kind (`{"a": 1, "a": 2}`, which `JSON.parse` resolves silently) and the kind where a nested key and a dotted one flatten onto each other
- `UNUSED_KEY`, reported at `info`, for keys nothing in a `source` directory appears to reference. An application that has already worked this out can pass its own answer as `unusedKeys` instead
- `source`, the directory the unused-key scan searches
- Support for the folder-per-locale (`en/common.json`) and single-file-per-project (`{ "en": ... }`) layouts, alongside the existing one-file-per-locale layout. Files holding the same keys are compared as a group, so several translation files no longer share one pile of keys
- `Chki18nInput` accepts `issues` and `fileFormat`, so whatever produced the input can report its own problems into the same result
- `chki18n/core`, a subpath that exports the comparison engine on its own. It imports no Node built-in, so it bundles for a browser or an editor's renderer process
- `checks`, `ignoreChecks`, `levels`, `format`, `exclude` and the interpolation delimiter options, available both as CLI flags and as JavaScript options
- `--help` and `--version`
- `reporter`, which decides the shape of the report: `pretty` for a terminal, `list` for one line per issue, `json` for another program to read, `markdown` for a table, and `github` for the workflow commands GitHub Actions turns into annotations on the translation files themselves. Everything but `pretty` prints the report alone, with no banner, so it can be piped straight into something else
- `groupBy`, the axis the report groups its issues by: `locale` (the default), `code`, `group`, `file` or `none`
- `output`, a file the report is written to as well as the terminal. The extension picks the format, an explicit `reporter` overrides it, missing directories are created, and a write that fails is reported as an error and fails the run
- `color`, and `--no-color` with it. A file written by `output` is never coloured
- `width`, the column count the report is laid out to. Without it the terminal's own width is used, then `COLUMNS`, which is where a CI runner reports its log width
- `formatResult` and `groupIssues` are exported, so an application can render a result the way the CLI does, along with `displayWidth`, `padTo` and `truncate` for laying out columns of its own

### Changed

- `CHECK_META` describes each check's severity and wording, so a user interface does not have to hard-code them
- A description that does not fit the width wraps onto the next line instead of being cut short, so a narrow terminal loses no wording
- `NO_KEY` and `DUMMY_KEY` no longer ask every language for every plural form. Korean needs only `item_other`, so `item_one` being absent from it was reported as missing and is not; Russian needs an `item_few` that English never writes, and that was reported as a stray key. Applies only to keys ending in a named plural category, and only to the languages the plural table covers
- `UNUSED_KEY` searches for a plural key by its base. No source file writes `item_one`, so every plural key in a project was reported as unused
- The package now publishes `types`, so TypeScript consumers get the result shape
- Analysis is linear in the number of keys rather than quadratic: comparing 5,000 keys across 5 locales went from about 10.8s to about 26ms
- The twelve checks added since cost about a third as much again as the original twelve over the same 5,000 keys, and a check that is switched off costs nothing at all. `lengthRatio` is the exception worth knowing: measuring every value in display columns more than doubles the run, which is part of why it stays off until it is asked for

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
