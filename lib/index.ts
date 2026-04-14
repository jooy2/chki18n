#!/usr/bin/env node
import chalk from 'chalk';
import minimist from 'minimist';
import { readdir, readFile } from 'fs/promises';
import { flatten } from 'flat';
import { safeJSONParse } from 'qsu';
import { joinFilePath } from 'qsu/node';
import { platform } from 'node:os';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const __primaryLocale = 'ko';
const __isCliMode = process.argv[1] === fileURLToPath(import.meta.url);
const __header = chalk.bgBlueBright.whiteBright(' Chki18n ');
const __tagError = chalk.bgRedBright.whiteBright(' ERROR ');
const __tagWarning = chalk.bgYellowBright.whiteBright(' WARN ');
const __tagInfo = chalk.bgGrey.whiteBright(' INFO ');

const __isWindows = platform() === 'win32';

function _errorAndExit(message: string) {
	process.stderr.write(`${__header}${__tagError} ${message}`);
	process.stderr.write(
		`${__header}${__tagError} The job was aborted due to an invalid translation file. See above issues.`
	);
	process.exit(1);
}

function _log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
	let tag: string;

	switch (level) {
		case 'warn':
			tag = __tagWarning;
			break;
		case 'error':
			tag = __tagError;
			break;
		case 'info':
		default:
			tag = __tagInfo;
			break;
	}

	process.stdout.write(`${__header}${tag} ${message}\n`);
}

export const check = async (path: string, options?: { path?: string }) => {
	const args = minimist(process.argv.slice(2));
	const opt = args || options;

	let targetDirectory = args._?.[0] || opt?.path || path;

	if (!targetDirectory) {
		_errorAndExit('`targetDirectory` is required.');
		return;
	}

	if (!isAbsolute(targetDirectory)) {
		targetDirectory = joinFilePath(__isWindows, process.cwd(), targetDirectory);
	}

	_log(`Process to check valid translation... (Path: ${targetDirectory})`);

	const localeObj: any = {};
	let targetFiles;

	// Get files from locale directory
	try {
		targetFiles = await readdir(targetDirectory);
	} catch {
		_errorAndExit('Failed to fetch translate file lists from locale directory');
		return;
	}

	// Get translation strings from file
	for (const file of targetFiles) {
		const filePath = joinFilePath(__isWindows, targetDirectory, file);

		if (filePath.endsWith('.json')) {
			try {
				const fileContent = await readFile(filePath, { encoding: 'utf-8' });

				if (fileContent) {
					localeObj[file.replace('.json', '')] = flatten(safeJSONParse(fileContent, {}));
				}
			} catch {
				_errorAndExit(`Failed to read translate file: '${filePath}'`);
				return;
			}
		}
	}

	const listDoesNotHaveKeys = [];
	const listNotTranslatedKeys = [];
	const listDuplicatedValues = [];

	let objUniqueLocaleValues: any = {};

	// Search key is missing
	for (const compareKey of Object.keys(localeObj[__primaryLocale])) {
		for (const locale of Object.keys(localeObj)) {
			if (locale !== __primaryLocale) {
				if (!Object.keys(localeObj[locale]).includes(compareKey)) {
					listDoesNotHaveKeys.push(
						` - ${locale} -> '${compareKey}' (${__primaryLocale}: ${localeObj[__primaryLocale][compareKey]})`
					);
				}
			}
		}
	}

	// Search duplicate value
	for (const locale of Object.keys(localeObj)) {
		objUniqueLocaleValues = {};

		for (const compareKey of Object.keys(localeObj[locale])) {
			const searchValue = localeObj[locale][compareKey];

			let duplicatedKeyName = null;

			for (const dupCheckKey of Object.keys(objUniqueLocaleValues)) {
				if (objUniqueLocaleValues[dupCheckKey] === searchValue) {
					duplicatedKeyName = dupCheckKey;
					break;
				}
			}

			if (!duplicatedKeyName) {
				objUniqueLocaleValues[compareKey] = searchValue;
			} else {
				listDuplicatedValues.push(
					` - ${locale} -> '${compareKey}' and '${duplicatedKeyName}' (${searchValue?.replace(/\n/g, '\\n')})`
				);
			}
		}
	}

	// Search not translated key
	for (const locale of Object.keys(localeObj)) {
		if (locale !== __primaryLocale) {
			for (const notTranslateCheckKey of Object.keys(localeObj[locale])) {
				if (
					localeObj[locale][notTranslateCheckKey] ===
					localeObj[__primaryLocale][notTranslateCheckKey]
				) {
					listNotTranslatedKeys.push(
						` - ${locale} -> '${notTranslateCheckKey}' (${__primaryLocale}: ${localeObj[locale][notTranslateCheckKey]?.replace(/\n/g, '\\n')})`
					);
				}
			}
		}
	}

	if (listDuplicatedValues.length > 0) {
		_log(
			`Some keys have duplicate values. Ignore this warning if necessary:\n\n${listDuplicatedValues.join('\n')}\n`,
			'warn'
		);
	}

	if (listNotTranslatedKeys.length > 0) {
		_log(
			`Some translation keys have the same value as the primary language. If you don't need a translation, don't define it in the translation file, or make sure the translation is not complete. If everything is fine, ignore this error:\n\n${listNotTranslatedKeys.join('\n')}\n`,
			'warn'
		);
	}

	// Exit with error
	if (listDoesNotHaveKeys.length > 0) {
		_errorAndExit(
			`Some translation files did not include the following keys:\n\n${listDoesNotHaveKeys.join('\n')}\n`
		);
		return;
	}

	_log('Done!');

	return {
		success: true
	};
};

if (__isCliMode) {
	(async () => {
		await check('');
	})();
}

export default check;
