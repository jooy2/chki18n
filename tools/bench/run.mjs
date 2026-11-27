/**
 * Times the three packages on the same generated translations.
 *
 * The parity tool proves the packages print the same report; nothing proved
 * they take a similar time to print it, and one of them fell several times
 * behind without anybody noticing. This generates one project of a given size,
 * runs every package over it in process and from its command line, and prints
 * one table so the gap is visible at a glance.
 *
 * Usage, from anywhere in the repository:
 *
 *     node tools/bench/run.mjs [--keys 5000] [--runs 10] [--only javascript,dart]
 *
 * It needs the same tools as the parity test: `node`, `dart` and a Python 3 on
 * the path, and the JavaScript package built (`npm run build` in
 * `packages/javascript`). Set `PYTHON` to pick a particular interpreter. Dart
 * is timed as the AOT executable `dart compile exe` writes, which is what the
 * release ships and what a Flutter release build runs.
 *
 * Every figure is the median of `--runs` runs after a short warm-up, in
 * milliseconds. Each step is described in the table that is printed.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const benchDir = join(rootDir, 'tools', 'bench');

const LOCALES = ['en', 'ko', 'ja', 'de', 'ru'];

/** Ten words per language, so every key can be given a phrase of its own. */
const WORDS = {
	en: [
		'save',
		'file',
		'folder',
		'open',
		'close',
		'settings',
		'user',
		'error',
		'message',
		'account'
	],
	ko: ['저장', '파일', '폴더', '열기', '닫기', '설정', '사용자', '오류', '메시지', '계정'],
	ja: [
		'保存',
		'ファイル',
		'フォルダ',
		'開く',
		'閉じる',
		'設定',
		'ユーザー',
		'エラー',
		'メッセージ',
		'アカウント'
	],
	de: [
		'Speichern',
		'Datei',
		'Ordner',
		'öffnen',
		'schließen',
		'Einstellung',
		'Benutzer',
		'Fehler',
		'Nachricht',
		'Konto'
	],
	ru: [
		'сохранить',
		'файл',
		'папка',
		'открыть',
		'закрыть',
		'настройки',
		'пользователь',
		'ошибка',
		'сообщение',
		'аккаунт'
	]
};

/** What each step of the table measures, in the order it is printed. */
const STEPS = [
	['parse', 'JSON text of every locale into objects'],
	['flatten', 'nested objects into dotted keys'],
	['analyze', 'one comparison of flat maps already in memory'],
	['format', 'the pretty report of that comparison'],
	['check', '`checkTranslationFiles` on the directory'],
	['check + source', 'the same, with `source` pointed at the sources'],
	['cli', 'one command line run, process start included']
];

function fail(message) {
	console.error(message);
	process.exit(1);
}

/**
 * A phrase unique to one key: its index spelled digit by digit in the locale's
 * words. Real translations rarely repeat themselves, and a phrase shared by
 * every key would turn the run into a test of `DUPLICATE_VALUE` alone.
 */
function phraseOf(locale, index) {
	const words = WORDS[locale];
	const digits = String(index).split('');

	return [words[index % 7], ...digits.map((digit) => words[Number(digit)])].join(' ');
}

/**
 * Writes `locales/<locale>.json` and `src/*.js` under `dir`.
 *
 * Most values are correct, as they are in a real project, and a fixed share of
 * them carries one of the mistakes the checks look for, so every check has
 * something to report and the report has something to render.
 */
function generate(dir, keyCount) {
	const data = Object.fromEntries(LOCALES.map((locale) => [locale, {}]));
	const sources = [];

	for (let index = 0; index < keyCount; index += 1) {
		const section = `section${index % 40}`;
		const group = `group${Math.floor(index / 40) % 25}`;
		const isPlural = index % 97 === 0;
		const leaf = isPlural ? `item${index}_other` : `key${index}`;

		for (const locale of LOCALES) {
			const isTarget = locale === 'en';

			if (!isTarget && index % 401 === 7) {
				continue;
			}

			let value = phraseOf(isTarget || index % 211 !== 3 ? locale : 'en', index);

			if (index % 3 === 0 && !(locale === 'ko' && index % 307 === 0)) {
				value += ' {name}';
			}

			if (index % 11 === 0) {
				value += ' {count} / {count}';
			}

			if (index % 7 === 0) {
				value += ` ${index % 1000}`;
			}

			if (index % 5 === 0) {
				value = `<b>${value}</b>`;
			}

			if (locale === 'de' && index % 503 === 0) {
				value += ' ';
			}

			const node = ((data[locale][section] ??= {})[group] ??= {});

			node[leaf] = value;

			if (isPlural) {
				node[`item${index}_one`] = value;
			}
		}

		// One key in ten is never asked for, and so is reported as unused.
		if (index % 10 !== 9) {
			sources.push(`\tt('${section}.${group}.${isPlural ? `item${index}` : leaf}');`);
		}
	}

	mkdirSync(join(dir, 'locales'), { recursive: true });
	mkdirSync(join(dir, 'src'), { recursive: true });

	for (const locale of LOCALES) {
		writeFileSync(
			join(dir, 'locales', `${locale}.json`),
			`${JSON.stringify(data[locale], null, 2)}\n`
		);
	}

	// Ten calls to a file, and one file in fifty asks for a key nobody defines.
	for (let start = 0, file = 0; start < sources.length; start += 10, file += 1) {
		const missing = file % 50 === 0 ? [`\tt('missing.key${file}');`] : [];
		const body = [...sources.slice(start, start + 10), ...missing].join('\n');

		writeFileSync(
			join(dir, 'src', `view${file}.js`),
			`export function view${file}(t) {\n${body}\n}\n`
		);
	}
}

/** The newest modification time under a directory. */
function newestUnder(dir) {
	return readdirSync(dir, { withFileTypes: true }).reduce((latest, entry) => {
		const path = join(dir, entry.name);

		return Math.max(latest, entry.isDirectory() ? newestUnder(path) : statSync(path).mtimeMs);
	}, 0);
}

function pythonCommand() {
	for (const candidate of [process.env.PYTHON, 'python3', 'python'].filter(Boolean)) {
		const found = spawnSync(candidate, ['--version'], { encoding: 'utf8' });

		if (!found.error && found.status === 0) {
			return candidate;
		}
	}

	fail('No Python 3 found. Set `PYTHON` to one.');
}

/**
 * How to run each package, in process and from its command line. Dart is
 * compiled once into `workDir`, the benchmark and the command line both.
 */
function runnersFor(workDir) {
	return {
		javascript() {
			const built = join(rootDir, 'packages/javascript/dist/cli.js');
			let builtAt = 0;

			try {
				builtAt = statSync(built).mtimeMs;
			} catch {
				fail('packages/javascript/dist/cli.js is not there. Run `npm run build` in that package.');
			}

			if (newestUnder(join(rootDir, 'packages/javascript/lib')) > builtAt) {
				fail('packages/javascript/dist is older than lib. Run `npm run build` in that package.');
			}

			return {
				bench: [process.execPath, join(benchDir, 'javascript.mjs')],
				cli: [process.execPath, built]
			};
		},
		dart() {
			const packages = join(rootDir, 'packages/dart/.dart_tool/package_config.json');
			const suffix = process.platform === 'win32' ? '.exe' : '';
			const compile = (source, output) => {
				const built = spawnSync(
					'dart',
					[
						'compile',
						'exe',
						`--packages=${packages}`,
						source,
						'-o',
						output,
						'--verbosity',
						'error'
					],
					{ cwd: join(rootDir, 'packages/dart'), encoding: 'utf8' }
				);

				if (built.error) {
					fail(`Could not run \`dart\`: ${built.error.message}`);
				}

				if (built.status !== 0) {
					fail(`\`dart compile exe\` failed:\n${built.stderr || built.stdout}`);
				}

				return output;
			};

			try {
				statSync(packages);
			} catch {
				fail('Run `dart pub get` in packages/dart first.');
			}

			return {
				bench: [compile(join(benchDir, 'dart.dart'), join(workDir, `bench${suffix}`))],
				cli: [compile('bin/chki18n.dart', join(workDir, `chki18n${suffix}`))]
			};
		},
		python() {
			const python = pythonCommand();

			return {
				bench: [python, join(benchDir, 'python.py')],
				cli: [python, '-c', 'import sys; from chki18n.cli import main; sys.exit(main())'],
				env: { PYTHONPATH: join(rootDir, 'packages/python/src') }
			};
		}
	};
}

/** Median wall time of a command line, after one run to warm the disk cache. */
function timeCommand([command, ...prefix], args, env, runs) {
	const options = { stdio: 'ignore', env: { ...process.env, ...env } };
	const times = [];

	spawnSync(command, [...prefix, ...args], options);

	for (let run = 0; run < runs; run += 1) {
		const startedAt = performance.now();

		spawnSync(command, [...prefix, ...args], options);
		times.push(performance.now() - startedAt);
	}

	times.sort((a, b) => a - b);

	return times[Math.floor(times.length / 2)];
}

function format(ms) {
	if (ms === undefined) {
		return '-';
	}

	return ms >= 100 ? `${Math.round(ms)}` : ms.toFixed(1);
}

const { values: flags } = parseArgs({
	options: {
		keys: { type: 'string', default: '5000' },
		runs: { type: 'string', default: '10' },
		only: { type: 'string', default: 'javascript,dart,python' }
	}
});
const keyCount = Number(flags.keys);
const runs = Number(flags.runs);
const names = flags.only.split(',').map((name) => name.trim());
const workDir = mkdtempSync(join(tmpdir(), 'chki18n-bench-'));

try {
	const dataDir = join(workDir, 'data');
	const runners = runnersFor(workDir);
	const results = {};

	generate(dataDir, keyCount);
	console.log(
		`${keyCount} keys across ${LOCALES.length} locales, median of ${runs} runs, in ms.\n`
	);

	for (const name of names) {
		if (!runners[name]) {
			fail(`\`${name}\` is not a package. Use javascript, dart or python.`);
		}

		const runner = runners[name]();
		const [command, ...prefix] = runner.bench;
		const bench = spawnSync(command, [...prefix, dataDir, String(runs)], {
			encoding: 'utf8',
			env: { ...process.env, ...runner.env },
			maxBuffer: 64 * 1024 * 1024
		});

		if (bench.status !== 0) {
			fail(`The ${name} benchmark failed:\n${bench.stderr || bench.stdout}`);
		}

		results[name] = JSON.parse(bench.stdout.trim().split('\n').pop());
		results[name].cli = timeCommand(
			runner.cli,
			[join(dataDir, 'locales'), '--target', 'en', '--no-color', '--source', join(dataDir, 'src')],
			runner.env,
			runs
		);
	}

	const header = ['step', ...names, 'measures'];
	const rows = STEPS.map(([step, description]) => [
		step,
		...names.map((name) => {
			const ms = results[name][step];
			const reference = results.javascript?.[step];

			return name === 'javascript' || !reference || ms === undefined
				? format(ms)
				: `${format(ms)} (${(ms / reference).toFixed(1)}x)`;
		}),
		description
	]);
	const widths = header.map((_, column) =>
		Math.max(...[header, ...rows].map((row) => row[column].length))
	);
	const line = (row) => `| ${row.map((cell, column) => cell.padEnd(widths[column])).join(' | ')} |`;

	console.log(line(header));
	console.log(`| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`);
	rows.forEach((row) => console.log(line(row)));

	// The same data must give the same findings, or the times compare two
	// different amounts of work.
	const counts = names.map((name) => `${name} ${results[name].issues}`);

	console.log(`\nIssues found: ${counts.join(', ')}`);

	if (new Set(names.map((name) => results[name].issues)).size > 1) {
		fail('The packages disagree on the number of issues. Run `node tools/parity/run.mjs`.');
	}
} finally {
	rmSync(workDir, { recursive: true, force: true });
}
