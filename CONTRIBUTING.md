# Contributing to chki18n

Thank you for contributing. Issues and pull requests are both welcome, and this page covers what each one needs.

This project adheres to version 2.1 of the Contributor Covenant, which is reproduced in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Contributing means you have read that policy and agree to it. The maintainers will warn or restrict any behaviour that undermines it.

## Issues

Open an issue at https://github.com/jooy2/chki18n/issues. You can reach the maintainers at https://cdget.com/contact instead, but GitHub Issues is where progress is tracked.

When you open one, keep the following in mind:

- Pick the category that matches the issue, such as bug report or feature request.
- Check whether the same issue already exists.
- Describe what is happening and what needs to be fixed. An image or a short video often helps.
- Write a title someone else can find by searching for it.
- Write everything in English.
- Describe the environment the issue occurs in, including the package and the language version.

A security vulnerability is the exception. Report one through [SECURITY.md](SECURITY.md) rather than as a public issue.

## How to contribute (Pull Requests)

### Making the change

The process is:

1. Clone the repository, or rebase onto the latest commit on `main`.
2. Install the dependencies of the package you are changing.
3. Set up the linter and formatter for that package in your editor. Each package brings its own, and CI checks the result.
4. Write the change.
5. Update the documentation, or add a page if none covers it. `docs/` ships in English and Korean, so update both. Write the content in your own language rather than leaving a page out; a translation can follow later.
6. Add or change tests where the code has them, and confirm the existing tests still pass.

### Keep the three packages in step

The JavaScript, Dart and Python packages are one library, and the documentation promises they print the same report. Each package's own suite only knows its own expected output, so a change to one of them can drift from the others and still pass everywhere. Compare them directly:

```bash
node tools/parity/run.mjs
```

It runs the three command lines over the same samples, with every reporter and every grouping, and fails on the first line that differs. It needs `node`, `dart` and a Python 3, and the JavaScript package built (`npm run build` in `packages/javascript`). CI runs it on every pull request to `main`.

### Write a commit message

There are no strict rules for commit messages, but follow these where you can:

- Write in English.
- Wrap the names of functions, variables, folders and files in backticks.
- Use the format `tag: message (fixes #1)`. The part in parentheses is optional.
- Summarise what changed.
- Split unrelated changes into separate commits.

Because this repository holds three packages, name the one you changed in square brackets before the tag: `[javascript] fix: …`, `[dart]`, `[python]`, or `[common]` for a change that covers all of them. Leave the prefix off when the change belongs to no single package.

The tags follow the [Udacity Git Commit Message Style Guide](https://udacity.github.io/git-styleguide). Tags outside this list are fine for situations it does not cover.

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Changes to documentation
- `style`: Formatting, missing semicolons, etc.; no code change
- `refactor`: Refactoring production code
- `test`: Adding tests, refactoring test; no production code change
- `chore`: Updating build tasks, package manager configs, etc.; no production code change

Informal tags:

- `package`: Modifications to package settings, modules, or GitHub projects
- `typo`: Fix typos

### Create a pull request

When creating a pull request, keep the following in mind:

- Describe what the change is, why it is needed, and how it works.
- Check whether an open pull request already does the same thing.
- Write everything in English.

A maintainer reviews and tests the change before merging it. That takes some time, and they may ask for edits or for more detail in the comments.

## Releasing

This part is for maintainers. Each package is released on its own, under a tag such as `javascript-v1.3.0`, `dart-v1.3.0` or `python-v1.3.0`, by the `release` workflow in `.github/workflows/release.yml`.

1. Raise the version in every file of the package that carries it, and give its changelog section the version and the date in place of `vNext`, as `## 1.3.0 (2026-10-26)`.

   | Package      | Files that carry the version                |
   | ------------ | ------------------------------------------- |
   | `javascript` | `package.json`, `package-lock.json`         |
   | `dart`       | `pubspec.yaml`, `lib/src/version.dart`      |
   | `python`     | `pyproject.toml`, `src/chki18n/_version.py` |

1. Push that commit to `main`.
1. Run the `release` workflow from the Actions tab, or with `gh workflow run release.yml -f package=javascript`. It checks the version files and the changelog, tags the commit, runs the tests, publishes the package and creates the GitHub release with the changelog section, the build and the package's source.

A failed release is run again by choosing its tag under "Use workflow from". A step that already succeeded, such as the upload to the registry, is skipped.

No registry token is stored in the repository. Each registry trusts the `release` workflow in the `release` environment, which only deploys from a release tag, and this is set up once per registry:

| Registry | Where | Values |
| --- | --- | --- |
| npm | The package's settings, "Trusted Publisher" | Organization or user `jooy2`, repository `chki18n`, workflow filename `release.yml`, environment name `release`, and `npm publish` allowed besides `npm stage publish` |
| pub.dev | The package's admin page, "Automated publishing" | Repository `jooy2/chki18n`, tag pattern `dart-v{{version}}`, publishing from `push` and from `workflow_dispatch` events enabled, GitHub Actions environment `release` required |
| PyPI | The project's publishing settings, "GitHub" | Owner `jooy2`, repository name `chki18n`, workflow name `release.yml`, environment name `release` |
