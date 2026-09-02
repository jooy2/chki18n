---
title: API
---

# API

chki18n has four entry points, and which one you want depends on who owns the translations and how often you check them. They share one comparison engine, one option set and one result shape, so moving between them changes how the data arrives and nothing else.

## Which entry point

| Situation | Use | Reads files |
| --- | --- | --- |
| Check a directory once — CI, a script, a pre-commit hook | [`checkTranslationFiles`](./check-translation-files) | yes |
| Check data you already have, once | [`analyzeTranslations`](./analyze-translations) | no |
| Read a directory once, then check it repeatedly | [`loadTranslations`](./load-translations) | once |
| Your own application owns the values and needs only a verdict | [`createAnalyzer`](./create-analyzer) | no |

The two that do no file system work are also published as [`chki18n/core`](./core), which imports no Node built-in and bundles for a browser or an editor's renderer process.

## Who owns the values

The one decision worth making deliberately. A [session](./load-translations) holds its own copy of every string, which is what lets `session.set` and `session.checkKey` work from memory. If your application is _also_ holding those strings — a translation editor, a form bound to the values a user is typing — then two copies exist and every edit has to reach both. That is a bug waiting to happen.

In that case use [`createAnalyzer().checkEntry`](./create-analyzer) instead: you pass the values in on each call, your application stays the single source of truth, and the check costs about two microseconds.

When chki18n _is_ the owner — a script, a watcher, a CI step that checks the same folder twice — the session is the simpler thing by a wide margin.

## Everything else that is exported

Beyond the four entry points:

- **Check metadata** — `CHECK_CODE`, `CHECK_META`, `ANALYZE_CHECK_CODES`, `CROSS_KEY_CHECK_CODES`. See [Checks](/guide/checks).
- **Result helpers** — `groupIssuesByCode`, `summarizeIssues`, `createIssue`, `buildResult`. See [The result object](/reference/result).
- **Options** — `resolveOptions`, `argsToOptions`, `buildUsageText`, `OPTION_DEFINITIONS`. See [Options](/guide/options).
- **Defaults** — `DEFAULT_TARGET_LOCALE`, `DEFAULT_EXCLUDE_DIRS`, `DEFAULT_INTERPOLATION_PREFIX`, `DEFAULT_INTERPOLATION_SUFFIX`, `FILE_FORMAT`.
- **Utilities** — `isLocaleCode`, `extractInterpolationKeys`, `scanTranslationDirectory`.
- **Sessions** — `createSession`, for translations you pass in rather than a directory.

Every type is exported too: `Chki18nOptions`, `Chki18nResult`, `Chki18nIssue`, `Chki18nSummary`, `Chki18nEntry`, `Chki18nSession` and the rest.
