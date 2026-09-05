<img src="https://raw.githubusercontent.com/jooy2/chki18n/main/docs/public/128x128.png" alt="chki18n" width="96" height="96" />

# chki18n for Dart

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/jooy2/chki18n/blob/main/LICENSE) [![pub package](https://img.shields.io/pub/v/chki18n.svg)](https://pub.dev/packages/chki18n) [![pub points](https://img.shields.io/pub/points/chki18n)](https://pub.dev/packages/chki18n/score)

### 📘 [**chki18n.cdget.com**](https://chki18n.cdget.com)

Every check, every option and every example. This README is just the quick start.

---

**chki18n** checks that your i18n translation files agree with each other. Point it at a folder of JSON, name the language everything is compared against, and it reports what is missing, what was never translated and what quietly broke.

- **Twenty-five checks** — missing keys, a language file nobody created, keys defined twice, empty values, untranslated strings, mismatched interpolation placeholders, dropped markup, changed numbers, invisible characters, drifting terminology, missing plural forms, and — pointed at your sources — keys nothing references and keys nothing defines.
- **Every layout** — one file per locale, one folder per locale, or one file holding them all.
- **CLI and library** share one set of checks and one set of options.
- **A report you can act on** — grouped by language, check, file or nothing; rendered for a terminal, for `grep`, as JSON, as Markdown or as GitHub Actions annotations; saved to a file on request.
- **No dependencies**, and `package:chki18n/core.dart` imports no `dart:io`, so the comparison runs in a Flutter web build too.

## Install

```bash
dart pub add chki18n
```

Requires **Dart 3.7 or newer**. In a Flutter project use `flutter pub add chki18n`.

## From the command line

```bash
dart pub global activate chki18n
chki18n ./locales --target en
```

```text
  Path     ./locales
  Target   en
  Locales  en, ko
  Layout   single, 1 group, 10 keys

 ko ──────────────────────────────────────────────────────────────────────── 1 error · 1 warning

  ERROR  NO_KEY (1)
         The key exists in the target language but is missing here.
    attr.folder  en: "Folder"

  WARN   NOT_TRANSLATED_VALUE (1)
         The value is identical to the target language, so the translation may be incomplete.
    desc.no-str  en: "12345"

 Summary ───────────────────────────────────────────────────────────────────────────────────────

  Compared 10 keys across 2 locales in 1 group. (3ms)
  1 error · 1 warning
  Clean: en

  FAIL  1 error must be fixed before this passes.
```

Exits with `1` when an error level issue was found, so a CI job fails on it. `chki18n --help` lists every flag. Inside a project that already depends on the package, `dart run chki18n` does the same thing without installing it globally.

`--group-by` decides what a section is (`locale`, `code`, `group`, `file` or `none`), `--reporter` decides the shape (`pretty`, `list`, `json`, `markdown` or `github`), and `--output` keeps a copy:

```bash
chki18n ./locales --target en --reporter json > report.json
chki18n ./locales --target en --output translation-report.md
```

## From Dart

Four entry points, depending on who owns the translations:

```dart
import 'package:chki18n/chki18n.dart';

// Check a directory once — the same thing the CLI does.
final result = await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(target: 'en'),
);

result.success; // false
result.issues; // every issue, with its level, key, locale and file

// Check data you already have, with no file system work at all.
analyzeTranslations(
  Chki18nInput(locales: {'en': en, 'ko': ko}),
  options: const Chki18nOptions(target: 'en'),
);

// Read a directory once, then check it as often as you like.
final session = await loadTranslations(
  path: './locales',
  options: const Chki18nOptions(target: 'en'),
);
session.set('ko', 'desc.hello', '안녕하세요'); // the issues for that key

// Or let your own application own the values and ask only for a verdict.
createAnalyzer(options: const Chki18nOptions(target: 'en')).checkEntry(
  const Chki18nEntry(
    key: 'desc.hello',
    values: {'en': 'Hello {name}', 'ko': '안녕하세요'},
  ),
);
// [NO_INTERPOLATION_KEY error ko desc.hello: ...]
```

`analyzeTranslations` and `createAnalyzer` do no file system work and are also published as `package:chki18n/core.dart`, which imports no `dart:io` and runs in a Flutter web build or anywhere else the file system is not there.

Every option is one object with named parameters, so a flag and its Dart counterpart are the same thing:

```dart
const Chki18nOptions(
  target: 'en',
  ignoreChecks: [Chki18nCheckCode.suspiciousLength],
  levels: {Chki18nCheckCode.emptyValue: Chki18nLevel.error},
  keyCase: Chki18nKeyCase.kebab,
  reporter: Chki18nReporter.markdown,
);
```

[**The documentation site**](https://chki18n.cdget.com) covers every check, every option and how to render a result.

## Contributing

Anyone can contribute by reporting an issue or opening a pull request. See [CONTRIBUTING.md](https://github.com/jooy2/chki18n/blob/main/CONTRIBUTING.md).

## License

Released under the [MIT License](https://github.com/jooy2/chki18n/blob/main/LICENSE).
