#!/usr/bin/env node
import chalk from 'chalk';
import { join, resolve } from 'path';
import { readdir, readFile } from 'fs/promises';
import { flatten } from 'flat';
import { safeJSONParse } from 'qsu';

const __primaryLocale = 'ko';
const __header = chalk.bgGreenBright.whiteBright(' Translation ');
const __tagError = chalk.bgRedBright.whiteBright(' ERROR ');
const __tagWarning = chalk.bgYellowBright.whiteBright(' WARN ');
const __tagInfo = chalk.bgGrey.whiteBright(' INFO ');

function errorAndExit(message: string) {
	console.error(`${__header}${__tagError} ${message}`);
	console.info(
		`${__header}${__tagError} The job was aborted due to an invalid translation file. See above issues.`
	);
	process.exit(1);
}

const checkValidTranslation = async (targetDirectory: string) => {
	if (!targetDirectory) {
		errorAndExit('`targetDirectory` is required.');
		return;
	}

	console.info(`${__header}${__tagInfo} Process to check valid translation...`);

	const localeObj: any = {};
	let targetFiles;

	// Get files from locale directory
	try {
		targetFiles = await readdir(targetDirectory);
	} catch {
		errorAndExit('Failed to fetch translate file lists from locale directory');
		return;
	}

	// Get translation strings from file
	for (const file of targetFiles) {
		const filePath = join(targetDirectory, file);

		if (filePath.endsWith('.json')) {
			try {
				const fileContent = await readFile(filePath, { encoding: 'utf-8' });

				if (fileContent) {
					localeObj[file.replace('.json', '')] = flatten(safeJSONParse(fileContent, {}));
				}
			} catch {
				errorAndExit(`Failed to read translate file: '${filePath}'`);
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
		console.warn(
			`${__header}${__tagWarning} Some keys have duplicate values. Ignore this warning if necessary:\n\n${listDuplicatedValues.join('\n')}\n`
		);
	}

	if (listNotTranslatedKeys.length > 0) {
		console.warn(
			`${__header}${__tagWarning} Some translation keys have the same value as the primary language. If you don't need a translation, don't define it in the translation file, or make sure the translation is not complete. If everything is fine, ignore this error:\n\n${listNotTranslatedKeys.join('\n')}\n`
		);
	}

	// Exit with error
	if (listDoesNotHaveKeys.length > 0) {
		errorAndExit(
			`Some translation files did not include the following keys:\n\n${listDoesNotHaveKeys.join('\n')}\n`
		);
		return;
	}

	console.info(`${__header}${__tagInfo} Done!`);
};

(async () => {
	const targetDirectory = process?.argv?.[2];

	if (!targetDirectory) {
		errorAndExit('`targetDirectory` is required');
		return;
	}

	await checkValidTranslation(resolve(targetDirectory));
})();
