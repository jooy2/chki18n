<img src="docs/public/128x128.png" alt="chki18n" width="96" height="96" />

# chki18n

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/jooy2/chki18n/blob/main/LICENSE) [![npm latest package](https://img.shields.io/npm/v/chki18n/latest.svg)](https://www.npmjs.com/package/chki18n) [![npm downloads](https://img.shields.io/npm/dm/chki18n.svg)](https://www.npmjs.com/package/chki18n) ![Commit Count](https://img.shields.io/github/commit-activity/y/jooy2/chki18n) ![Stars](https://img.shields.io/github/stars/jooy2/chki18n?style=social)

### 📘 [**chki18n.cdget.com**](https://chki18n.cdget.com)

Every check, every option and every example. This README is the map; each package has a quick start of its own.

---

**chki18n** checks that your translation files agree with each other. Point it at a folder of i18n JSON, name the language everything is compared against, and it reports what is missing, what was never translated and what quietly broke.

- **Thirteen checks.** Missing keys, keys defined twice, empty values, untranslated strings, interpolation placeholders that do not match, duplicate values, stray whitespace, numbers dropped in translation, and — pointed at your sources — keys nothing references.
- **Every layout.** One file per locale (`en.json`), one folder per locale (`en/common.json`), or one file holding them all. Files that share keys are compared as a group, so a key missing from `errors.json` is never confused with one missing from `common.json`.
- **From the command line or from code.** The same checks and the same options either way — a CLI flag and its API option are one definition, so the two can never disagree.
- **Fast enough to run on every keystroke.** Comparing 5,000 keys across 5 locales takes about 17ms, and re-checking a single edited key takes about 2µs. An editor can lint as the user types.
- **No configuration file.** Nothing to set up: a path and a target language are the whole contract.

## Packages

| Package                                      | Registry                                               | Requires             | Quick start                             |
| -------------------------------------------- | ------------------------------------------------------ | -------------------- | --------------------------------------- |
| [`packages/javascript`](packages/javascript) | [npm: `chki18n`](https://www.npmjs.com/package/chki18n) | Node.js 18 or later  | [README](packages/javascript/README.md) |

More languages are planned. Each package keeps its own changelog and versions independently, so a release on one side is not a release on the others.

## Install

### JavaScript / TypeScript

Check a folder from the command line — in CI, or before a commit:

```bash
npx chki18n ./locales --target en
```

```text
 Chki18n  ERROR  [NO_KEY] Some translation files did not include the following keys (1):
 - ko -> 'attr.folder' (en: "Folder")

 Chki18n  INFO  Compared 10 keys across 2 locales in 1 group. (3ms)
```

It exits with `1` when something is wrong, so a CI job fails on it.

Or call it from your own code and act on the result yourself:

```bash
npm install chki18n
```

```javascript
import { checkTranslationFiles } from 'chki18n';

const result = await checkTranslationFiles('./locales', { target: 'en' });

result.success; // false
result.summary; // { error: 1, warn: 2, info: 0, total: 3, ... }
result.issues; // every issue, with its level, key, locale and file
```

Every issue carries the words to describe it, so a build script, a dashboard or a translation editor can render the result without hard-coding a single string. [**The JavaScript quick start**](packages/javascript/README.md) has the rest.

## Contributing

Anyone can contribute by reporting an issue or opening a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Released under the [MIT License](LICENSE).
