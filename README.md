<img src="docs/public/128x128.png" alt="chki18n" width="96" height="96" />

# chki18n

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/jooy2/chki18n/blob/main/LICENSE) [![npm latest package](https://img.shields.io/npm/v/chki18n/latest.svg)](https://www.npmjs.com/package/chki18n) [![pub package](https://img.shields.io/pub/v/chki18n.svg)](https://pub.dev/packages/chki18n) [![PyPI](https://img.shields.io/pypi/v/chki18n.svg)](https://pypi.org/project/chki18n/) ![Commit Count](https://img.shields.io/github/commit-activity/y/jooy2/chki18n) ![Stars](https://img.shields.io/github/stars/jooy2/chki18n?style=social)

### 📘 [**chki18n.cdget.com**](https://chki18n.cdget.com)

Every check, every option and every example, for all three packages on one page. This README is the map; each package has a quick start of its own.

---

**chki18n** checks that your translation files agree with each other. Point it at a folder of i18n JSON, name the language everything is compared against, and it reports what is missing, what was never translated and what quietly broke.

- **Twenty-five checks.** Missing keys, a whole language file nobody created, keys defined twice, empty values, untranslated strings, interpolation placeholders that do not match in name or in number, markup a translation dropped, numbers it changed, characters nothing will draw, terminology that drifted between two screens, plural forms a language needs, and — pointed at your sources — keys nothing references and keys nothing defines.
- **Every layout.** One file per locale (`en.json`), one folder per locale (`en/common.json`), or one file holding them all. Files that share keys are compared as a group, so a key missing from `errors.json` is never confused with one missing from `common.json`.
- **Three languages, one library.** The JavaScript, Dart and Python packages run the same checks in the same order and print the same report, byte for byte. Pick the one your project already speaks.
- **From the command line or from code.** The same checks and the same options either way — a CLI flag and its API option are one definition, so the two can never disagree.
- **Fast enough to run on every keystroke.** Comparing 5,000 keys across 5 locales takes about 17ms, and re-checking a single edited key takes about 2µs. An editor can lint as the user types.
- **A report you can act on.** Grouped by language, by check, by file or not at all; rendered for a terminal, for `grep`, as JSON, as Markdown or as GitHub Actions annotations; and written to a file when you want to keep it.
- **No configuration file.** Nothing to set up: a path and a target language are the whole contract.

## Packages

| Package                                      | Registry                                                | Requires             | Quick start                             |
| -------------------------------------------- | ------------------------------------------------------- | -------------------- | --------------------------------------- |
| [`packages/javascript`](packages/javascript) | [npm: `chki18n`](https://www.npmjs.com/package/chki18n) | Node.js 18 or later  | [README](packages/javascript/README.md) |
| [`packages/dart`](packages/dart)             | [pub.dev: `chki18n`](https://pub.dev/packages/chki18n)  | Dart 3.7 or later    | [README](packages/dart/README.md)       |
| [`packages/python`](packages/python)         | [PyPI: `chki18n`](https://pypi.org/project/chki18n/)    | Python 3.10 or later | [README](packages/python/README.md)     |

The JavaScript package is the reference implementation, and the other two are held to its output rather than to a description of it. Each package keeps its own changelog and versions independently, so a release on one side is not a release on the others.

## Quick start

Check a folder from the command line — in CI, or before a commit:

```bash
# JavaScript
npx chki18n ./locales --target en
```

```bash
# Dart
dart pub global activate chki18n
chki18n ./locales --target en
```

```bash
# Python
pipx run chki18n ./locales --target en
```

Whichever one you ran:

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

It exits with `1` when something is wrong, so a CI job fails on it.

Or call it from your own code and act on the result yourself:

```javascript
import { checkTranslationFiles } from 'chki18n';

const result = await checkTranslationFiles('./locales', { target: 'en' });

result.success; // false
result.summary; // { error: 1, warn: 2, info: 0, total: 3, ... }
result.issues; // every issue, with its level, key, locale and file
```

```dart
import 'package:chki18n/chki18n.dart';

final result = await checkTranslationFiles(
  path: './locales',
  options: const Chki18nOptions(target: 'en'),
);

result.success; // false
result.summary.error; // 1
result.issues; // every issue, with its level, key, locale and file
```

```python
from chki18n import Options, check_translation_files

result = check_translation_files("./locales", Options(target="en"))

result.success  # False
result.summary.error  # 1
result.issues  # every issue, with its level, key, locale and file
```

Every issue carries the words to describe it, so a build script, a dashboard or a translation editor can render the result without hard-coding a single string. The quick start for each package has the rest: [JavaScript](packages/javascript/README.md), [Dart](packages/dart/README.md), [Python](packages/python/README.md).

## Contributing

Anyone can contribute by reporting an issue or opening a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Released under the [MIT License](LICENSE).
