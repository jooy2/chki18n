# chki18n

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/jooy2/chki18n/blob/main/LICENSE) ![Commit Count](https://img.shields.io/github/commit-activity/y/jooy2/chki18n) [![Followers](https://img.shields.io/github/followers/jooy2?style=social)](https://github.com/jooy2) ![Stars](https://img.shields.io/github/stars/jooy2/chki18n?style=social)

> Check and verify your i18n translation files

**chki18n** is a command-line tool that validates multilingual translation files against i18n (Internationalization) standards.

It automatically detects common mistakes that can occur when managing multilingual files and suggests ways to improve them. With this tool, you can validate files in advance within CI environments or other automated workflows.

Currently, only the `json` format and single translation files (`ko.json`, `en.json`, etc.) are supported.

## Features

- [x] Analysis of i18n translation files in `json` format
- [x] File validation and scanning for various issues
- [x] CI & CLI & Node.js support
- [x] TypeScript & Modern ESM Module
- [ ] Support for more i18n file types
- [ ] Language detection during parsing
- [ ] More detailed and clear error messages (e.g. bulleted list)
- [ ] Check for more languages
- [ ] Add unit tests
- [ ] Single Test (Test Function by Item)
- [ ] Performance Improvements
- [ ] Generate Report File
- [ ] Automatic correction for certain tests

This tool does not provide automatic text translation. It only performs checks.

## Verification List

| Level | Check code | Reason |
| --- | --- | --- |
| Error | INVALID_FILE | Missing files, parsing failure... |
| Warning | NO_KEY | The 'a' key, which exists in Language A, is missing in Language B |
| Warning | EMPTY_VALUE | The key is defined, but its value is empty. |
| Warning | DUPLICATE_VALUE | They use different keys but the same value |
| Warning | NOT_TRANSLATED_VALUE | This is the same as the text in the target language. It appears that the translation has not been completed. |
| Warning | DUMMY_KEY | This key does not exist in the target language and is therefore not used. |

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
$ npx chki18n {targetDirectory}
# With options
$ npx chki18n --path {targetDirectory}
```

The output will then appear in the terminal as follows. If a validity issue occurs, the process will generate an error and terminate abruptly.

```shell
 Translation  INFO  Process to check valid translation...
 Translation  ERROR  Some translation files did not include the following keys:

 Translation  ERROR  The job was aborted due to an invalid translation file. See above issues.
```

## How-to-use (via JavaScript/Node.js)

This module can be installed and used directly via JavaScript code as well as through the CLI!

Install the module using the command below:

```shell
# using npm
$ npm install chki18n
# or using pnpm
$ pnpm install chki18n
# or using yarn
$ yarn add chki18n
```

```javascript
import { checkTranslationFiles } from 'chki18n';

const result = checkTranslationFiles('/Your/locale/path', {
	/* Options here */
});

console.log(result);
```

## Options

```shell
Usage: `chki18n [options]` or `chki18n [options] <targetDirectory>`

Options:
	--path	The directory where the files to be scanned are located (Required)
	--target	The contents of the language file are compared with the language specified here. Typically, language codes such as `ko`, `en`, `zh-Hans`, `zh-Hant`, `zh`, and `ja` are used. (Default: `en`)
	--no-warn	Do not show warning messages
	--debug	Show debug messages
```

## Contributing

Anyone can contribute to the project by reporting new issues or submitting a pull request. For more information, please see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Please see the [LICENSE](LICENSE) file for more information about project owners, usage rights, and more.
