<img src="https://raw.githubusercontent.com/jooy2/chki18n/main/docs/public/128x128.png" alt="chki18n" width="96" height="96" />

# chki18n for Rust

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/jooy2/chki18n/blob/main/LICENSE)

### [chki18n.cdget.com](https://chki18n.cdget.com)

The documentation site has every check, every option and every example. This README is the quick start.

---

**chki18n** checks that your i18n translation files agree with each other. Point it at a folder of JSON, name the language everything is compared against, and it reports what is missing, what was never translated and what broke without anyone noticing.

- **Twenty-five checks**: missing keys, empty values, strings nobody translated, mismatched interpolation placeholders, drifting terminology, and, pointed at your sources, keys nothing references and keys nothing defines. [The full list](https://chki18n.cdget.com/guide/checks) is on the documentation site.
- **Every layout**: one file per locale, one folder per locale, or one file holding them all.
- **The same report as the JavaScript, Dart and Python packages**, character for character. A parity test in CI compares the four command lines on every pull request.
- **One binary** with no runtime to install, for a CI job or a machine without Node.js.

## Install

```bash
cargo install chki18n
```

Or add the library to a project:

```bash
cargo add chki18n
```

Requires **Rust 1.85 or newer**.

## From the command line

```bash
chki18n ./locales --target en
```

It prints the same report as the other packages and exits with `1` when an error level issue was found, so a CI job fails on it. `chki18n --help` lists every flag.

`--group-by` decides what a section is (`locale`, `code`, `group`, `file` or `none`), `--reporter` decides the shape (`pretty`, `list`, `json`, `markdown` or `github`), and `--output` keeps a copy:

```bash
chki18n ./locales --target en --reporter json > report.json
chki18n ./locales --target en --output translation-report.md
```

## From Rust

```rust
use chki18n::{analyze_translations, check_translation_files, Input, Options};
use serde_json::json;

let options = Options { target: Some("en".into()), ..Options::default() };

// Check a directory once, the same thing the command line does.
let result = check_translation_files(Some("./locales"), &options);

result.success; // false
result.issues; // every issue, with its level, key, locale and file

// Check data you already have, with no file system work at all.
let en = json!({ "desc": { "hello": "Hello {name}" } });
let ko = json!({ "desc": { "hello": "\u{c548}\u{b155}\u{d558}\u{c138}\u{c694}" } });
let input = Input {
    locales: Some(
        [("en", en), ("ko", ko)]
            .into_iter()
            .map(|(locale, value)| (locale.to_string(), value.as_object().unwrap().clone()))
            .collect(),
    ),
    ..Input::default()
};

analyze_translations(&input, &options);
```

`load_translations` reads a directory once and keeps it, so a value can be changed with `set` and checked again without reading the files. `create_analyzer` returns an analyzer whose `check_entry` compares one key at a time.

Options are taken as the text a person would write on the command line, so a value that cannot be used is reported in the same words by every package:

```rust
use chki18n::Options;

Options {
    target: Some("en".into()),
    ignore_checks: Some(vec!["SUSPICIOUS_LENGTH".into()]),
    levels: Some(vec!["EMPTY_VALUE=error".into()]),
    key_case: Some("kebab".into()),
    reporter: Some("markdown".into()),
    ..Options::default()
};
```

[**The documentation site**](https://chki18n.cdget.com) covers every check, every option and how to render a result.

## Contributing

Anyone can contribute by reporting an issue or opening a pull request. See [CONTRIBUTING.md](https://github.com/jooy2/chki18n/blob/main/CONTRIBUTING.md).

## License

Released under the [MIT License](https://github.com/jooy2/chki18n/blob/main/LICENSE).
