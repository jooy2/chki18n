# chki18n

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/jooy2/chki18n/blob/main/LICENSE) ![Commit Count](https://img.shields.io/github/commit-activity/y/jooy2/chki18n) [![npm downloads](https://img.shields.io/npm/dm/chki18n.svg)](https://www.npmjs.com/package/chki18n) [![npm latest package](https://img.shields.io/npm/v/chki18n/latest.svg)](https://www.npmjs.com/package/chki18n) ![npm bundle size](https://img.shields.io/bundlephobia/min/chki18n) [![Followers](https://img.shields.io/github/followers/jooy2?style=social)](https://github.com/jooy2) ![Stars](https://img.shields.io/github/stars/jooy2/chki18n?style=social)

> Check and verify your i18n translation files

**chki18n** validates multilingual translation files against i18n (Internationalization) standards.

It automatically detects common mistakes that can occur when managing multilingual files and suggests ways to improve them. Use it from the command line to validate files in a CI environment, or call it from JavaScript to check translations your own application already has in memory.

Currently only the `json` format is supported.

## Features

- [x] Analysis of i18n translation files in `json` format
- [x] File validation and scanning for various issues
- [x] CI & CLI & Node.js support
- [x] TypeScript & Modern ESM Module
- [x] One file per locale, one folder per locale, and one file per project
- [x] Analysis of translations already held in memory, with no file system work
- [x] Re-checking a single key, for editors that validate as the user types
- [ ] Support for more i18n file types
- [ ] Language detection during parsing
- [ ] Check for more languages
- [ ] Generate Report File
- [ ] Automatic correction for certain tests

This tool does not provide automatic text translation. It only performs checks.

## Verification List

| Level | Check code | Reason |
| --- | --- | --- |
| Error | INVALID_FILE | Missing files, parsing failure... |
| Error | NO_KEY | The 'a' key, which exists in Language A, is missing in Language B |
| Error | NO_INTERPOLATION_KEY | An interpolation key of the target language is missing from the value |
| Error | EXTRA_INTERPOLATION_KEY | The value uses an interpolation key the target language does not define |
| Warning | INVALID_VALUE_TYPE | The value is not a string, so it cannot be compared or translated |
| Warning | EMPTY_VALUE | The key is defined, but its value is empty |
| Warning | DUPLICATE_VALUE | They use different keys but the same value |
| Warning | NOT_TRANSLATED_VALUE | This is the same as the text in the target language. It appears that the translation has not been completed |
| Warning | DUMMY_KEY | This key does not exist in the target language and is therefore not used |
| Warning | SURROUNDING_WHITESPACE | The value begins or ends with whitespace |
| Warning | MISSING_NUMBER | The target language value contains digits but the translation does not |

Every check except `INVALID_FILE` and `INVALID_OPTIONS` can be turned on or off with the `checks` / `ignoreChecks` options.

## Supported file layouts

The layout is detected from the scanned paths, or can be forced with `--format`.

```text
# single: one file per locale
locales/en.json
locales/ko.json

# folder: one folder per locale
locales/en/common.json
locales/ko/common.json

# nested: one file holding every locale
locales/translation.json   -> { "en": { ... }, "ko": { ... } }
```

Files that hold the same keys in different languages form a **group**, and each group is compared on its own. With the `folder` layout above, `common.json` is one group; adding `errors.json` would add a second, so a key missing from `errors.json` is never confused with one missing from `common.json`.

Sub-folders are supported in every layout and become their own groups.

## How-to-use (CLI)

Below are examples of scannable files:

```text
# ko.json
{
  "desc": {
    "hello": "안녕하세요"
  }
}

# en.json
{
  "desc": {
    "hello": "Hello"
  }
}
```

You can verify the validity of these files using the command below:

```shell
npx chki18n {targetDirectory}
```

```shell
npx chki18n --path {targetDirectory} --target en
```

The output will then appear in the terminal as follows. The command exits with code `1` when an error level issue was found, so a CI job fails on it.

```text
 Chki18n  INFO  Process to check specified translation files... (Current path: /project/locales)
 Chki18n  INFO  This comparison is based on the following language: en

 Chki18n  ERROR  [NO_KEY] Some translation files did not include the following keys (1):
 - ko -> 'attr.folder' (en: "Folder")

 Chki18n  INFO  Compared 10 keys across 2 locales in 1 group. (3ms)
 Chki18n  INFO  Found 1 error and 0 warnings.
 Chki18n  ERROR  The scan is complete. There is a critical issue with the translation file. Please review the results above.
```

## How-to-use (via JavaScript/Node.js)

This module can be installed and used directly via JavaScript code as well as through the CLI.

Install the module using the command below:

```shell
npm install chki18n
```

### Checking a directory

`checkTranslationFiles` does what the CLI does. Nothing is printed unless you ask for it, and the process is never terminated for you: the returned result is the only thing to act on.

```javascript
import { checkTranslationFiles } from 'chki18n';

const result = await checkTranslationFiles('/your/locale/directory', {
	target: 'en'
});

if (!result.success) {
	console.log(result.summary); // { error: 1, warn: 2, info: 0, total: 3, ... }
	console.log(result.issues);
	/*
	[
	  {
	    code: 'NO_KEY',
	    level: 'error',
	    locale: 'ko',
	    key: 'attr.folder',
	    group: '',
	    targetValue: 'Folder',
	    file: '/your/locale/directory/ko.json',
	    message: 'The key exists in the target language but is missing here.'
	  }
	]
	*/
}
```

### Checking translations already in memory

`analyzeTranslations` compares data you already hold, doing no file system work at all. Pass `flattened: true` when your keys are already flat (`'desc.hello'`) to skip the flatten pass entirely.

```javascript
import { analyzeTranslations } from 'chki18n';

const result = analyzeTranslations(
	{
		locales: {
			en: { desc: { hello: 'Hello {name}' } },
			ko: { desc: { hello: '안녕하세요' } }
		}
	},
	{ target: 'en' }
);
```

Use `groups` instead of `locales` when your project has several translation files, so each is compared on its own:

```javascript
analyzeTranslations({
	groups: {
		'common.json': { en: { ok: 'OK' }, ko: { ok: '확인' } },
		'errors.json': { en: { failed: 'Failed' }, ko: {} }
	}
});
```

### Re-checking one key

`createAnalyzer` resolves the options once and hands back a reusable analyzer. Its `checkEntry` compares a single key across locales, which is what an editor needs after every keystroke — re-running a whole analysis for one edited value is unnecessary.

```javascript
import { createAnalyzer } from 'chki18n';

const analyzer = createAnalyzer({ target: 'en' });

const issues = analyzer.checkEntry({
	key: 'desc.hello',
	values: { en: 'Hello {name}', ko: '안녕하세요' }
});
// [{ code: 'NO_INTERPOLATION_KEY', level: 'error', locale: 'ko', interpolation: 'name', ... }]
```

Pass `locales` when a language that owns no value still has to be reported as missing:

```javascript
analyzer.checkEntry({ key: 'a', values: { en: 'Hello' }, locales: ['en', 'ko'] });
// [{ code: 'NO_KEY', locale: 'ko', ... }]
```

`checkEntry` only runs checks that can be decided from one key. `DUPLICATE_VALUE` needs to see a whole locale at once and is therefore reported by `analyzeTranslations` only; the codes it covers are listed in `CROSS_KEY_CHECK_CODES`.

For reference, comparing 5,000 keys across 5 locales takes about 17ms with `analyzeTranslations` on flattened input, and a single `checkEntry` call takes about 2µs.

### Rendering the result

Each issue carries its own `level` and a human readable `message`, and `CHECK_META` describes every check, so a user interface never has to hard-code strings:

```javascript
import { CHECK_META, groupIssuesByCode, summarizeIssues } from 'chki18n';

CHECK_META.NO_KEY;
// { level: 'error', summary: 'Some translation files did not include the following keys', description: '...' }

// Results already carry `issuesByCode` and `summary`; these helpers regroup a
// filtered subset, e.g. after hiding a locale.
const visible = result.issues.filter((issue) => issue.locale !== 'ja');

groupIssuesByCode(visible);
summarizeIssues(visible); // { error, warn, info, total, byCode, byLocale, byGroup }
```

## Options

The CLI and the JavaScript API share one option system: every flag below is the same option, in kebab-case for the CLI and camelCase for JavaScript.

```text
Usage: `chki18n [options]` or `chki18n [options] <targetDirectory>`

Options:
  --path <dir>                    The directory where the files to be scanned are located (required)
  --target <locale>               The language every other language is compared against (default: `en`)
  --format <format>               Layout of the translation files: `auto`, `single`, `folder` or `nested`
  --checks <codes>                Run only these comma separated check codes
  --ignore-checks <codes>         Run every check except these comma separated check codes
  --interpolation-prefix <str>    Opening delimiter of an interpolation key (default: `{`)
  --interpolation-suffix <str>    Closing delimiter of an interpolation key (default: `}`)
  --exclude <dirs>                Comma separated directory names to skip while scanning
  --no-info                       Do not show info messages
  --no-warn                       Do not show warning messages
  --debug                         Show debug messages
  --help                          Show this message
  --version                       Show the installed version
```

Options the JavaScript API adds:

| Option      | Description                                                    |
| ----------- | -------------------------------------------------------------- |
| `flattened` | Treat the input as already flattened and skip the flatten pass |
| `verbose`   | Print progress and results to the console (the CLI sets this)  |

## Contributing

Anyone can contribute to the project by reporting new issues or submitting a pull request. For more information, please see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Please see the [LICENSE](LICENSE) file for more information about project owners, usage rights, and more.
