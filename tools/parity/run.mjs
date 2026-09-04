/**
 * Runs the three command lines over the same files and diffs what they print.
 *
 * The documentation says the packages are one library rather than three: the
 * same checks in the same order, and a report that matches to the column
 * whichever one produced it. That claim is only worth making if it is tested,
 * and no single package's suite can test it — each one only knows its own
 * expected output.
 *
 * The JavaScript package is the reference. Dart and Python are compared against
 * it, over every sample directory, every reporter and every grouping. Two
 * things are normalised before comparing, because neither carries meaning:
 * the elapsed time, which differs run to run, and the key order of a JSON
 * report, which the three write in the order their own types declare.
 *
 * Usage, from anywhere in the repository:
 *
 *     node tools/parity/run.mjs
 *
 * It needs `node`, `dart` and a Python 3 on the path, and the JavaScript
 * package built (`npm run build` in `packages/javascript`). Set `PYTHON` to
 * pick a particular interpreter.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The sample tree every package's own suite reads. */
const SAMPLES = 'packages/javascript/test/samples';

/** The same tree, as the other two packages keep it. */
const MIRRORS = ['packages/dart/test/samples', 'packages/python/tests/samples'];

/**
 * What to run each sample with.
 *
 * Every reporter at the default grouping, then every grouping at the default
 * reporter. The full cross product would multiply the runs by five and answer
 * nothing more: a reporter renders the groups it is handed, and the grouping
 * does not know which reporter will render it.
 */
const OPTION_SETS = [
	['--reporter', 'pretty'],
	['--reporter', 'list'],
	['--reporter', 'json'],
	['--reporter', 'markdown'],
	['--reporter', 'github'],
	['--group-by', 'code'],
	['--group-by', 'group'],
	['--group-by', 'file'],
	['--group-by', 'none']
];

/** Fixed so a terminal's width and colour support cannot enter the comparison. */
const COMMON = ['--target', 'en', '--no-color', '--width', '100'];

function fail(message) {
	console.error(message);
	process.exit(1);
}

/** The tree of files under a directory, as a path to content map. */
function treeOf(dir) {
	const tree = new Map();

	const walk = (current) => {
		for (const entry of readdirSync(current, { withFileTypes: true }).sort()) {
			const path = join(current, entry.name);

			if (entry.isDirectory()) walk(path);
			else tree.set(relative(dir, path), readFileSync(path, 'utf8'));
		}
	};

	walk(dir);

	return tree;
}

/**
 * Confirms the three packages are reading the same fixtures.
 *
 * A sample that drifted would make the suites disagree about what correct
 * looks like, which is the same failure this tool exists to catch, one level
 * further up.
 */
function checkSamples() {
	const reference = treeOf(resolve(rootDir, SAMPLES));

	for (const mirror of MIRRORS) {
		const other = treeOf(resolve(rootDir, mirror));

		for (const [path, content] of reference) {
			if (!other.has(path)) fail(`${mirror} is missing ${path}, which ${SAMPLES} has.`);
			if (other.get(path) !== content) fail(`${mirror}/${path} differs from ${SAMPLES}/${path}.`);
		}

		for (const path of other.keys()) {
			if (!reference.has(path)) fail(`${mirror} holds ${path}, which ${SAMPLES} does not.`);
		}
	}

	return reference;
}

/** Every sample directory, with the arguments that make sense for it. */
function casesFrom() {
	const dir = resolve(rootDir, SAMPLES);
	const cases = [];

	for (const entry of readdirSync(dir, { withFileTypes: true }).sort()) {
		if (!entry.isDirectory()) continue;

		const sample = `${SAMPLES}/${entry.name}`;
		const hasSource = readdirSync(join(dir, entry.name)).includes('src');

		// A sample carrying its own sources is there for `UNUSED_KEY` and
		// `UNDEFINED_KEY`, which report nothing until they are pointed at them.
		cases.push(
			hasSource
				? { name: entry.name, args: [`${sample}/locales`, '--source', `${sample}/src`] }
				: { name: entry.name, args: [sample] }
		);
	}

	return cases;
}

/** The JavaScript command, once its build is confirmed to be current. */
function javascriptRunner() {
	const built = resolve(rootDir, 'packages/javascript/dist/cli.js');
	const source = resolve(rootDir, 'packages/javascript/lib');

	let builtAt;

	try {
		builtAt = statSync(built).mtimeMs;
	} catch {
		fail('packages/javascript/dist/cli.js is not there. Run `npm run build` in that package.');
	}

	const newest = (dir) =>
		readdirSync(dir, { withFileTypes: true }).reduce((latest, entry) => {
			const path = join(dir, entry.name);

			return Math.max(latest, entry.isDirectory() ? newest(path) : statSync(path).mtimeMs);
		}, 0);

	if (newest(source) > builtAt) {
		fail('packages/javascript/dist is older than lib. Run `npm run build` in that package.');
	}

	return { name: 'javascript', command: process.execPath, prefix: [built] };
}

/**
 * The Dart command, compiled once.
 *
 * `dart run` would rebuild the kernel on every one of the hundreds of calls
 * below; compiling once turns the whole run from minutes into seconds.
 */
function dartRunner(workDir) {
	const exe = join(workDir, process.platform === 'win32' ? 'chki18n.exe' : 'chki18n');
	const built = spawnSync(
		'dart',
		['compile', 'exe', 'bin/chki18n.dart', '-o', exe, '--verbosity', 'error'],
		{ cwd: resolve(rootDir, 'packages/dart'), encoding: 'utf8' }
	);

	if (built.error) fail(`Could not run \`dart\`: ${built.error.message}`);
	if (built.status !== 0) fail(`\`dart compile exe\` failed:\n${built.stderr || built.stdout}`);

	return { name: 'dart', command: exe, prefix: [] };
}

/** The Python command, run from the source tree rather than an install. */
function pythonRunner() {
	const candidates = [process.env.PYTHON, 'python3', 'python'].filter(Boolean);

	for (const candidate of candidates) {
		const found = spawnSync(candidate, ['--version'], { encoding: 'utf8' });

		if (!found.error && found.status === 0) {
			return {
				name: 'python',
				command: candidate,
				prefix: ['-c', 'import sys; from chki18n.cli import main; sys.exit(main())'],
				env: { PYTHONPATH: resolve(rootDir, 'packages/python/src') }
			};
		}
	}

	return fail(`No Python found. Tried ${candidates.join(', ')}. Set PYTHON to choose one.`);
}

/** One run, as its exit code and its output with the timing taken out. */
function run(runner, args) {
	const result = spawnSync(runner.command, [...runner.prefix, ...args], {
		cwd: rootDir,
		encoding: 'utf8',
		env: { ...process.env, ...runner.env, NO_COLOR: '1' }
	});

	if (result.error) fail(`Could not run ${runner.name}: ${result.error.message}`);

	return { code: result.status, output: normalise(result.stdout), stderr: result.stderr };
}

/** The output with what cannot be compared removed. */
function normalise(output) {
	const trimmed = output.trimEnd();

	if (!trimmed.startsWith('{')) return trimmed.replace(/\(\d+ms\)/g, '(elapsed)');

	try {
		const report = JSON.parse(trimmed);

		report.elapsedMs = 0;

		return stableJson(report);
	} catch {
		// Not the JSON reporter after all, or a report that did not parse. Either
		// way the text comparison will say so.
		return trimmed;
	}
}

/** JSON with its object keys in a fixed order. */
function stableJson(value) {
	return JSON.stringify(
		value,
		(_, held) =>
			held === null || typeof held !== 'object' || Array.isArray(held)
				? held
				: Object.fromEntries(Object.entries(held).sort(([a], [b]) => (a < b ? -1 : 1))),
		2
	);
}

/** Where two outputs first differ, as a few lines a reader can act on. */
function firstDifference(expected, actual) {
	const left = expected.split('\n');
	const right = actual.split('\n');
	const at = left.findIndex((line, index) => line !== right[index]);
	const index = at === -1 ? Math.min(left.length, right.length) : at;

	return [
		`  line ${index + 1}`,
		`    javascript: ${JSON.stringify(left[index] ?? '(no line)')}`,
		`    other:      ${JSON.stringify(right[index] ?? '(no line)')}`
	].join('\n');
}

function main() {
	checkSamples();

	const cases = casesFrom();
	const workDir = mkdtempSync(join(tmpdir(), 'chki18n-parity-'));

	try {
		const reference = javascriptRunner();
		const others = [dartRunner(workDir), pythonRunner()];
		const failures = [];
		let comparisons = 0;

		for (const testCase of cases) {
			for (const options of OPTION_SETS) {
				const args = [...testCase.args, ...COMMON, ...options];
				const expected = run(reference, args);

				for (const runner of others) {
					const actual = run(runner, args);

					comparisons += 1;

					if (actual.code === expected.code && actual.output === expected.output) continue;

					failures.push(
						[
							`${runner.name} differs on ${testCase.name} ${options.join(' ')}`,
							`  ${runner.name === 'dart' ? 'dart' : 'python'} exit ${actual.code}, javascript exit ${expected.code}`,
							firstDifference(expected.output, actual.output),
							actual.stderr.trim() ? `  stderr: ${actual.stderr.trim()}` : ''
						]
							.filter(Boolean)
							.join('\n')
					);
				}
			}
		}

		console.log(
			`${cases.length} samples × ${OPTION_SETS.length} option sets × 2 packages = ${comparisons} comparisons.`
		);

		if (failures.length > 0) {
			console.error(`\n${failures.join('\n\n')}`);
			console.error(`\n${failures.length} of ${comparisons} comparisons differ.`);
			process.exitCode = 1;

			return;
		}

		console.log('Dart and Python both match the JavaScript output exactly.');
	} finally {
		rmSync(workDir, { recursive: true, force: true });
	}
}

main();
