<img src="https://raw.githubusercontent.com/jooy2/chki18n/main/docs/public/128x128.png" alt="chki18n" width="96" height="96" />

# chki18n for JavaScript

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/jooy2/chki18n/blob/main/LICENSE) [![npm latest package](https://img.shields.io/npm/v/chki18n/latest.svg)](https://www.npmjs.com/package/chki18n) [![npm downloads](https://img.shields.io/npm/dm/chki18n.svg)](https://www.npmjs.com/package/chki18n)

### 📘 [**chki18n.cdget.com**](https://chki18n.cdget.com)

Every check, every option and every example. This README is just the quick start.

---

**chki18n** checks that your i18n translation files agree with each other. Point it at a folder of JSON, name the language everything is compared against, and it reports what is missing, what was never translated and what quietly broke.

- **Thirteen checks** — missing keys, keys defined twice, empty values, untranslated strings, mismatched interpolation placeholders, stray whitespace, and keys nothing in your source references.
- **Every layout** — one file per locale, one folder per locale, or one file holding them all.
- **CLI and library** share one set of checks and one set of options.
- **ESM, typed, and fast** — an in-memory comparison of 5,000 keys across 5 locales takes about 17ms.

## Install

```bash
npm install chki18n
```

Requires **Node.js 18 or newer**.

## From the command line

```bash
npx chki18n ./locales --target en
```

```text
 Chki18n  ERROR  [NO_KEY] Some translation files did not include the following keys (1):
 - ko -> 'attr.folder' (en: "Folder")

 Chki18n  INFO  Compared 10 keys across 2 locales in 1 group. (3ms)
```

Exits with `1` when an error level issue was found, so a CI job fails on it. `npx chki18n --help` lists every flag.

## From JavaScript

Four entry points, depending on who owns the translations:

```javascript
import {
	analyzeTranslations,
	checkTranslationFiles,
	createAnalyzer,
	loadTranslations
} from 'chki18n';

// Check a directory once — the same thing the CLI does.
const result = await checkTranslationFiles('./locales', { target: 'en' });
result.success; // false
result.issues; // every issue, with its level, key, locale and file

// Check data you already have, with no file system work at all.
analyzeTranslations({ locales: { en, ko } }, { target: 'en' });

// Read a directory once, then check it as often as you like.
const session = await loadTranslations('./locales', { target: 'en' });
session.set('ko', 'desc.hello', '안녕하세요'); // → the issues for that key

// Or let your own application own the values and ask only for a verdict.
createAnalyzer({ target: 'en' }).checkEntry({
	key: 'desc.hello',
	values: { en: 'Hello {name}', ko: '안녕하세요' }
});
// [{ code: 'NO_INTERPOLATION_KEY', level: 'error', locale: 'ko', ... }]
```

The last two do no file system work and are also published as `chki18n/core`, which imports no Node built-in and bundles for a browser or an editor's renderer process.

[**The documentation site**](https://chki18n.cdget.com) covers every check, every option and how to render a result.

## Contributing

Anyone can contribute by reporting an issue or opening a pull request. See [CONTRIBUTING.md](https://github.com/jooy2/chki18n/blob/main/CONTRIBUTING.md).

## License

Released under the [MIT License](https://github.com/jooy2/chki18n/blob/main/LICENSE).
