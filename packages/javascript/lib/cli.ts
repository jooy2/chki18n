#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import minimist from 'minimist';
import { capitalizeFirst } from 'qsu';
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

if (options.info !== false) {
	console.log(
		`${capitalizeFirst(packageJson.name)} ${packageJson.version} (Check-and-verify-your-i18n-files)\n`
	);
}

const result = await checkTranslationFiles(undefined, { ...options, verbose: true });

process.exit(result.success ? 0 : 1);
