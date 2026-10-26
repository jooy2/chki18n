/**
 * The body of a GitHub release, cut out of one package's `CHANGELOG.md`.
 *
 *   node .github/scripts/release-notes.mjs javascript-v1.3.0 > notes.md
 *   node .github/scripts/release-notes.mjs --tag javascript
 *
 * Each package versions on its own, so a tag names the package as well as the
 * version: `javascript-v1.3.0`, `dart-v1.3.0` or `python-v1.3.0`. The first
 * form writes the notes for such a tag; the second prints the tag the
 * package's files say comes next, which is what the release workflow tags.
 *
 * Either way nothing is written for a version the package was not cut for.
 * Every file that carries the version has to name the same one, and the
 * changelog section for it has to be dated and not empty. A tag pushed onto the
 * wrong commit, or a version raised in one file and not in the next, stops here
 * rather than publishing a release that describes something else.
 */
import { readFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY_URL = 'https://github.com/jooy2/chki18n';

// GitHub cuts a release body off at this many characters, in the middle of
// whatever entry it reaches.
const BODY_LIMIT = 125000;

const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

const readMatch = (pattern) => (text) => [text.match(pattern)?.[1]];

/**
 * Every package, by the name its tags start with. `versions` maps each file
 * that carries the version, relative to `dir`, to a reader that returns every
 * version written in it.
 */
const PACKAGES = {
	javascript: {
		dir: 'packages/javascript',
		versions: {
			'package.json': (text) => [JSON.parse(text).version],
			// The lock file names the version twice: its own and the root package's.
			'package-lock.json': (text) => {
				const lock = JSON.parse(text);

				return [lock.version, lock.packages?.['']?.version];
			}
		}
	},
	dart: {
		dir: 'packages/dart',
		versions: {
			'pubspec.yaml': readMatch(/^version:\s*(\S+)/m),
			'lib/src/version.dart': readMatch(/packageVersion\s*=\s*'([^']+)'/)
		}
	},
	python: {
		dir: 'packages/python',
		versions: {
			'pyproject.toml': readMatch(/^version\s*=\s*"([^"]+)"/m),
			'src/chki18n/_version.py': readMatch(/^PACKAGE_VERSION\s*=\s*"([^"]+)"/m)
		}
	}
};

const fail = (message) => {
	process.stderr.write(`release-notes: ${message}\n`);
	process.exit(1);
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

/** The one version every file of a package names, or a failure naming the file that disagrees. */
function versionOf(name) {
	const { dir, versions } = PACKAGES[name];
	let found = null;

	for (const [file, readVersions] of Object.entries(versions)) {
		const path = posix.join(dir, file);

		for (const version of readVersions(read(path))) {
			if (!version) {
				fail(`${path} names no version`);
			}

			found ??= version;

			if (version !== found) {
				fail(`${path} names ${version} where another file names ${found}`);
			}
		}
	}

	if (!VERSION_PATTERN.test(found)) {
		fail(`${found} is not a version such as 1.3.0`);
	}

	return found;
}

/** The changelog section of a version, without its heading. */
function sectionOf(name, version) {
	const changelogPath = posix.join(PACKAGES[name].dir, 'CHANGELOG.md');
	const lines = read(changelogPath).split(/\r?\n/);
	const start = lines.findIndex(
		(line) => line === `## ${version}` || line.startsWith(`## ${version} `)
	);

	if (start === -1) {
		fail(`${changelogPath} has no "## ${version}" section. Is it still called vNext?`);
	}

	if (!/^## \S+ \(\d{4}-\d{2}-\d{2}\)$/.test(lines[start])) {
		fail(`"${lines[start]}" in ${changelogPath} is not dated as "## ${version} (YYYY-MM-DD)"`);
	}

	const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
	const section = lines
		.slice(start + 1, end === -1 ? undefined : end)
		.join('\n')
		.trim();

	if (section === '') {
		fail(`the ${version} section of ${changelogPath} is empty`);
	}

	return { changelogPath, section };
}

const isPackage = (name) => Object.hasOwn(PACKAGES, name ?? '');

if (process.argv[2] === '--tag') {
	const name = process.argv[3];

	if (!isPackage(name)) {
		fail(`"${name ?? ''}" is not one of ${Object.keys(PACKAGES).join(', ')}`);
	}

	const version = versionOf(name);

	// Checked here too, so a version with no notes is not tagged at all.
	sectionOf(name, version);
	process.stdout.write(`${name}-v${version}\n`);
	process.exit(0);
}

const tag = process.argv[2] ?? '';
const [, name, version] = tag.match(/^([a-z]+)-v(.+)$/) ?? [];

if (!isPackage(name) || !VERSION_PATTERN.test(version)) {
	const examples = Object.keys(PACKAGES).map((key) => `${key}-v1.3.0`);

	fail(`"${tag}" is not a tag such as ${examples.join(', ')}`);
}

const cut = versionOf(name);

if (cut !== version) {
	fail(
		`${PACKAGES[name].dir} names ${cut} where the tag names ${version}. Tag the commit that cut ${tag}.`
	);
}

const { changelogPath, section } = sectionOf(name, version);
const changelogLink = `[\`${changelogPath}\`](${REPOSITORY_URL}/blob/${tag}/${changelogPath})`;
const pointer = `Every release of this package is described in ${changelogLink}.`;
const body = `${section}\n\n---\n\n${pointer}\n`;

process.stdout.write(
	body.length <= BODY_LIMIT
		? body
		: `The list of changes is too long for a release page. ${pointer}\n`
);
