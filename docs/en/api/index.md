---
title: API
---

# API

chki18n has four entry points, and which one you want depends on who owns the translations and how often you check them. They share one comparison engine, one option set and one result shape, so moving between them changes how the data arrives and nothing else. Every package has all four.

## Which entry point

| Situation | Use | Reads files |
| --- | --- | --- |
| Check a directory once — CI, a script, a pre-commit hook | [`checkTranslationFiles`](./check-translation-files) | yes |
| Check data you already have, once | [`analyzeTranslations`](./analyze-translations) | no |
| Read a directory once, then check it repeatedly | [`loadTranslations`](./load-translations) | once |
| Your own application owns the values and needs only a verdict | [`createAnalyzer`](./create-analyzer) | no |

The two that do no file system work are also published on their own as <Lang js="chki18n/core" dart="package:chki18n/core.dart" py="chki18n.core" code />, which reaches no file system at all — see [The core entry point](./core).

Every name below is written in its JavaScript spelling. Dart uses the same one; Python is snake_case, so `analyzeTranslations` is `analyze_translations`. [Getting started](/guide/getting-started#how-the-names-map) states that mapping once.

## Who owns the values

The one decision worth making deliberately. A [session](./load-translations) holds its own copy of every string, which is what lets `session.set` and `session.checkKey` work from memory. If your application is _also_ holding those strings — a translation editor, a form bound to the values a user is typing — then two copies exist and every edit has to reach both. That is a bug waiting to happen.

In that case use [`createAnalyzer().checkEntry`](./create-analyzer) instead: you pass the values in on each call, your application stays the single source of truth, and the check costs about two microseconds.

When chki18n _is_ the owner — a script, a watcher, a CI step that checks the same folder twice — the session is the simpler thing by a wide margin.

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
