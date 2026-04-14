# chki18n

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/jooy2/chki18n/blob/main/LICENSE) ![Commit Count](https://img.shields.io/github/commit-activity/y/jooy2/chki18n) [![Followers](https://img.shields.io/github/followers/jooy2?style=social)](https://github.com/jooy2) ![Stars](https://img.shields.io/github/stars/jooy2/chki18n?style=social)

**chki18n** is a command-line tool that validates multilingual translation files against i18n (Internationalization) standards.

It automatically detects common mistakes that can occur when managing multilingual files and suggests ways to improve them. With this tool, you can validate files in advance within CI environments or other automated workflows.

Currently, only the `json` format and single translation files (`ko.json`, `en.json`, etc.) are supported.

- Analysis of i18n translation files in `json` format
- File validation and scanning for various issues

This tool does not provide automatic text translation. It only performs checks.

## Verification List

| Level   | Name                | Example                                      |
| ------- | ------------------- | -------------------------------------------- |
| Error   | File Validation     | Missing files, parsing failure...            |
| Warning | Empty locale key    |                                              |
| Warning | Duplicate values    | They use different keys but the same value   |
| Warning | Useless translation | The English and Chinese phrases are the same |

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
