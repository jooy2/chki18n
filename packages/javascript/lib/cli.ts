#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import minimist from 'minimist';
import { capitalizeFirst } from 'qsu';
import { DEFAULT_REPORTER, REPORTER } from './constants.js';
import { checkTranslationFiles } from './index.js';
import { argsToOptions, buildUsageText, OPTION_DEFINITIONS } from './options.js';

const BIN_NAME = 'chki18n';

// Read at runtime rather than imported, so the compiled output stays inside
// `dist` and the package manifest is not bundled into it.
const packageJson = JSON.parse(
	await readFile(new URL('../package.json', import.meta.url), { encoding: 'utf-8' })
);

const args = minimist(process.argv.slice(2), {
	string: OPTION_DEFINITIONS.filter((option) => option.type !== 'boolean').map(
		(option) => option.flag
	),
	boolean: ['help', 'version']
});

if (args.help) {
	console.log(buildUsageText(BIN_NAME));
	process.exit(0);
}

if (args.version) {
	console.log(packageJson.version);
	process.exit(0);
}

const options = argsToOptions(args);

// The banner belongs to the report a person reads. Anything that gets piped
// into another program has to start with its own first line.
if (
	options.info !== false &&
	String(options.reporter ?? DEFAULT_REPORTER).toLowerCase() === REPORTER.PRETTY
) {
	console.log(`${capitalizeFirst(packageJson.name)} ${packageJson.version}\n`);
}

const result = await checkTranslationFiles(undefined, { ...options, verbose: true });

process.exit(result.success ? 0 : 1);
