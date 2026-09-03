<img src="https://raw.githubusercontent.com/jooy2/chki18n/main/docs/public/128x128.png" alt="chki18n" width="96" height="96" />

# chki18n for Python

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/jooy2/chki18n/blob/main/LICENSE) [![PyPI](https://img.shields.io/pypi/v/chki18n.svg)](https://pypi.org/project/chki18n/) [![Python versions](https://img.shields.io/pypi/pyversions/chki18n.svg)](https://pypi.org/project/chki18n/)

### 📘 [**chki18n.cdget.com**](https://chki18n.cdget.com)

Every check, every option and every example. This README is just the quick start.

---

**chki18n** checks that your i18n translation files agree with each other. Point it at a folder of JSON, name the language everything is compared against, and it reports what is missing, what was never translated and what quietly broke.

- **Twenty-five checks** — missing keys, a language file nobody created, keys defined twice, empty values, untranslated strings, mismatched interpolation placeholders, dropped markup, changed numbers, invisible characters, drifting terminology, missing plural forms, and — pointed at your sources — keys nothing references and keys nothing defines.
- **Every layout** — one file per locale, one folder per locale, or one file holding them all.
- **CLI and library** share one set of checks and one set of options.
- **A report you can act on** — grouped by language, check, file or nothing; rendered for a terminal, for `grep`, as JSON, as Markdown or as GitHub Actions annotations; saved to a file on request.
- **No dependencies**, fully typed, and `chki18n.core` reaches no file system at all.

## Install

```bash
pip install chki18n
```

Requires **Python 3.10 or newer**.

## From the command line

```bash
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

Exits with `1` when an error level issue was found, so a CI job fails on it. `chki18n --help` lists every flag. Without installing it, `pipx run chki18n ./locales --target en` does the same thing.

`--group-by` decides what a section is (`locale`, `code`, `group`, `file` or `none`), `--reporter` decides the shape (`pretty`, `list`, `json`, `markdown` or `github`), and `--output` keeps a copy:

```bash
chki18n ./locales --target en --reporter json > report.json
chki18n ./locales --target en --output translation-report.md
```

## From Python

Four entry points, depending on who owns the translations:

```python
from chki18n import (
    Entry,
    Input,
    Options,
    analyze_translations,
    check_translation_files,
    create_analyzer,
    load_translations,
)

# Check a directory once — the same thing the CLI does.
result = check_translation_files("./locales", Options(target="en"))

result.success  # False
result.issues  # every issue, with its level, key, locale and file

# Check data you already have, with no file system work at all.
analyze_translations(Input(locales={"en": en, "ko": ko}), Options(target="en"))

# Read a directory once, then check it as often as you like.
session = load_translations("./locales", Options(target="en"))
session.set("ko", "desc.hello", "안녕하세요")  # the issues for that key

# Or let your own application own the values and ask only for a verdict.
create_analyzer(Options(target="en")).check_entry(
    Entry(key="desc.hello", values={"en": "Hello {name}", "ko": "안녕하세요"})
)
# [Issue(code='NO_INTERPOLATION_KEY', level='error', locale='ko', ...)]
```

The last two do no file system work and are also importable as `chki18n.core`, which reaches no file system at all.

Every option is one keyword-only object, so a flag and its Python counterpart are the same thing. The loose forms a command line writes are accepted here too:

```python
Options(
    target="en",
    ignore_checks=["SUSPICIOUS_LENGTH"],  # or "SUSPICIOUS_LENGTH"
    levels={"EMPTY_VALUE": "error"},  # or "EMPTY_VALUE=error"
    key_case="kebab",
    reporter="markdown",
)
```

[**The documentation site**](https://chki18n.cdget.com) covers every check, every option and how to render a result.

## Contributing

Anyone can contribute by reporting an issue or opening a pull request. See [CONTRIBUTING.md](https://github.com/jooy2/chki18n/blob/main/CONTRIBUTING.md).

## License

Released under the [MIT License](https://github.com/jooy2/chki18n/blob/main/LICENSE).
