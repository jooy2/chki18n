# Contributing to chki18n

Thank you for contributing. Issues and pull requests are both welcome, and this page covers what each one needs.

This project adheres to the Contributor Covenant code of conduct. Contributing means you have read that policy and agree to it. The maintainers will warn or restrict any behaviour that undermines it.

## Issues

Open an issue at https://github.com/jooy2/chki18n/issues. You can email the maintainer instead, but GitHub Issues is where progress is tracked.

When you open one, keep the following in mind:

- Pick the category that matches the issue, such as bug report or feature request.
- Check whether the same issue already exists.
- Describe what is happening and what needs to be fixed. An image or a short video often helps.
- Write a title someone else can find by searching for it.
- Write everything in English.
- Describe the environment the issue occurs in, including the package and the language version.

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
