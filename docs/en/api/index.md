---
title: API
---

# API

chki18n has four entry points. Which one you want depends on who owns the translations and how often you check them. They share one comparison engine, one option set and one result shape, so moving between them changes only how the data arrives. Every package has all four.

## Which entry point

| Situation | Use | Reads files |
| --- | --- | --- |
| Check a directory once — CI, a script, a pre-commit hook | [`checkTranslationFiles`](./check-translation-files) | yes |
| Check data you already have, once | [`analyzeTranslations`](./analyze-translations) | no |
| Read a directory once, then check it repeatedly | [`loadTranslations`](./load-translations) | once |
| Your own application owns the values and needs only a verdict | [`createAnalyzer`](./create-analyzer) | no |

`analyzeTranslations` and `createAnalyzer` are also published on their own as <Lang js="chki18n/core" dart="package:chki18n/core.dart" py="chki18n.core" code />, which reaches no file system at all. See [The core entry point](./core).

Every name below is written in its JavaScript spelling. Dart uses the same one; Python is snake_case, so `analyzeTranslations` is `analyze_translations`. [Getting started](/guide/getting-started#how-the-names-map) states that mapping once.

## Who owns the values

This is usually what decides between the four. A [session](./load-translations) holds its own copy of every string, so `session.set` and `session.checkKey` work from memory. If your application is _also_ holding those strings, as a translation editor or a form bound to what a user is typing does, then two copies exist and every edit has to reach both. They drift apart easily.

In that case use [`createAnalyzer().checkEntry`](./create-analyzer) instead: you pass the values in on each call, your application stays the single source of truth, and the check costs about two microseconds.

When chki18n owns the values, as it does in a script, a file watcher or a CI step that checks the same folder twice, the session is much simpler.

## Everything else that is exported

Beyond the four entry points:

- **Check metadata** — <Lang js="CHECK_CODE" dart="Chki18nCheckCode" py="CHECK_CODES" code />, `CHECK_META`, `ANALYZE_CHECK_CODES`, `CROSS_KEY_CHECK_CODES`. See [Checks](/guide/checks).
- **Result helpers** — `groupIssuesByCode`, `summarizeIssues`, `createIssue`, `buildResult`. See [The result object](/reference/result).
- **Options** — `resolveOptions`, <Lang js="argsToOptions" dart="optionsFromArgs" py="options_from_args" code />, `buildUsageText`, `OPTION_DEFINITIONS`. See [Options](/guide/options).
- **Defaults** — `DEFAULT_TARGET_LOCALE`, `DEFAULT_EXCLUDE_DIRS`, `DEFAULT_INTERPOLATION_PREFIX`, `DEFAULT_INTERPOLATION_SUFFIX`, <Lang js="FILE_FORMAT" dart="Chki18nFileFormat" py="FILE_FORMATS" code />.
- **Reporting** — `formatResult`, `groupIssues`, `displayWidth`, `padTo`, `truncate`. See [Options](/guide/options#reporter).
- **Utilities** — `isLocaleCode`, `extractInterpolationKeys`, `scanTranslationDirectory`.
- **Sessions** — `createSession`, for translations you pass in rather than a directory.

Every type is exported too.

::: lang js

`Chki18nOptions`, `Chki18nResult`, `Chki18nIssue`, `Chki18nSummary`, `Chki18nEntry`, `Chki18nSession` and the rest.

:::

::: lang dart

`Chki18nOptions`, `Chki18nResult`, `Chki18nIssue`, `Chki18nSummary`, `Chki18nEntry`, `Chki18nSession` and the rest. Dart prefixes every public type, so a name never collides with something in the importing library.

:::

::: lang py

`Options`, `Result`, `Issue`, `Summary`, `Entry`, `Session` and the rest. Python does not prefix them, because `chki18n.Result` already says which library it belongs to.

:::
