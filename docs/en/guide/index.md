---
title: Guide
---

# Guide

chki18n reads a folder of i18n translation files, compares every language against one target language, and reports what does not line up. This section covers installing it, running it, the file layouts it understands, the checks it performs and the options that control them.

## The pages in this section

- [**Getting started**](./getting-started) — pick a package, install it, and get a first report from the command line or from code.
- [**Command line**](./cli) — every flag, the exit code, and how to wire it into CI or a pre-commit hook.
- [**Continuous integration**](./ci) — jobs to paste, for GitHub Actions and Bitbucket Pipelines.
- [**File layouts**](./file-layouts) — one file per locale, one folder per locale, or one file holding them all, and how files are grouped for comparison.
- [**Checks**](./checks) — the twenty-five things it looks for, what each one means, and how to turn one off or change how seriously it is taken.
- [**Options**](./options) — the full option set, shared by the CLI and the API.

## How it works

One language is the **target**: the one you write first and translate from. Every other language is compared against it, key by key. A key the target has and a translation does not is an error, and a value identical to the target's is a warning that the string was never actually translated. Nothing is configured beyond a path and that target language. There is no config file to write and no rule set to assemble.

## One library, three languages

chki18n ships for JavaScript, Dart and Python, and the three are one library: the same checks in the same order, the same option names, and a report that matches to the column whichever package produced it. Every page here documents all three at once. Pick yours with the switch at the top of the sidebar, and the code samples follow.

## What it does not do

It does not translate anything, and it does not edit your files. Every entry point reads and reports, and writing the fix back is yours to do. Automatic correction for some of the checks is planned but not available yet.
