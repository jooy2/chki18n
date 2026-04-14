# chki18n

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/jooy2/chki18n/blob/main/LICENSE) ![Commit Count](https://img.shields.io/github/commit-activity/y/jooy2/chki18n) [![Followers](https://img.shields.io/github/followers/jooy2?style=social)](https://github.com/jooy2) ![Stars](https://img.shields.io/github/stars/jooy2/chki18n?style=social)

**chki18n** is a command-line tool that validates multilingual translation files against i18n (Internationalization) standards.

It automatically detects common mistakes that can occur when managing multilingual files and suggests ways to improve them. With this tool, you can validate files in advance within CI environments or other automated workflows.

Currently, only the `json` format and single translation files (`ko.json`, `en.json`, etc.) are supported.

- Analysis of i18n translation files in `json` format
- File validation and scanning for various issues

This tool does not provide automatic text translation. It only performs checks.

## How-to-use

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

## Options

```shell
Usage: `chki18n [options]` or `chki18n [options] <targetDirectory>`

Options:
	--path	The directory where the files to be scanned are located
```

## Contributing

Anyone can contribute to the project by reporting new issues or submitting a pull request. For more information, please see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Please see the [LICENSE](LICENSE) file for more information about project owners, usage rights, and more.
