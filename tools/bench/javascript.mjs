/**
 * The JavaScript side of `run.mjs`: times each step over the generated data and
 * prints the medians as one line of JSON.
 *
 *     node tools/bench/javascript.mjs <data dir> <runs>
 *
 * The package is timed from its build, as the parity test reads it.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { checkTranslationFiles, createAnalyzer, flattenTranslations, formatResult } = await import(
	pathToFileURL(join(rootDir, 'packages/javascript/dist/index.js')).href
);

const LOCALES = ['en', 'ko', 'ja', 'de', 'ru'];
const [dataDir, runText] = process.argv.slice(2);
const runs = Number(runText);
const localesDir = join(dataDir, 'locales');
const sourceDir = join(dataDir, 'src');

async function median(step) {
	const times = [];

	for (let run = 0; run < 3; run += 1) {
		await step();
	}

	for (let run = 0; run < runs; run += 1) {
		const startedAt = performance.now();

		await step();
		times.push(performance.now() - startedAt);
	}

	times.sort((a, b) => a - b);

	return times[Math.floor(times.length / 2)];
}

const texts = LOCALES.map((locale) => readFileSync(join(localesDir, `${locale}.json`), 'utf8'));
const nested = texts.map((text) => JSON.parse(text));
const flat = Object.fromEntries(
	LOCALES.map((locale, index) => [locale, flattenTranslations(nested[index])])
);
const analyzer = createAnalyzer({ target: 'en', flattened: true });
const result = analyzer.analyze({ locales: flat });

const times = {
	parse: await median(() => texts.map((text) => JSON.parse(text))),
	flatten: await median(() => nested.map((map) => flattenTranslations(map))),
	analyze: await median(() => analyzer.analyze({ locales: flat })),
	format: await median(() => formatResult(result, analyzer.options, { color: false, width: 100 })),
	check: await median(() => checkTranslationFiles(localesDir, { target: 'en' })),
	'check + source': await median(() =>
		checkTranslationFiles(localesDir, { target: 'en', source: sourceDir })
	)
};

console.log(JSON.stringify({ issues: result.issues.length, ...times }));
