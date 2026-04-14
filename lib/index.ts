#!/usr/bin/env node
import minimist from 'minimist';
import { readdir, readFile } from 'fs/promises';
import { flatten } from 'flat';
import { objToPrettyStr, safeJSONParse } from 'qsu';
import { joinFilePath } from 'qsu/node';
import { isAbsolute } from 'node:path';
import packageJson from '../package.json' with { type: 'json' };
import { _debugLog, _error, _log } from './logger.js';
import { __isCliMode, __isWindows } from './constants.js';
import type { AnyValueObject } from './_types/global';

function _errorAndExit(message: string) {
	_error(message);
	_error(`The job was aborted due to an invalid translation file. See above issues.`);

	setTimeout(() => process.exit(1), 1000);

	return {
		success: false
	};
}

export const checkTranslationFiles = async (
	path: string,
	options?: { path?: string; target?: string; info?: boolean; warn?: boolean }
) => {
	/* =====================================================
	 * Initialize & Validate option
	 * ===================================================== */
	const args = minimist(process.argv.slice(2));
	const opt = args || options;

	console.log(opt);

	_debugLog(`Options: ${objToPrettyStr(opt)}`, opt);

	let _path = args._?.[0] || opt?.path || path;
	const _noWarn = opt?.warn === false;
	const _targetLang = opt?.target ?? 'en';

	if (!_path) {
		return _errorAndExit('No `path` argument is specified.');
	}

	if (!isAbsolute(_path)) {
		_path = joinFilePath(__isWindows, process.cwd(), _path);
	}

	_log(`Chki18n ${packageJson.version} (Check-and-verify-your-i18n-files)\n`, 'info', opt);
	_log(`Process to check specified translation files... (Current path: ${_path})`, 'info', opt);
	_log(`This comparison is based on the following language: ${_targetLang}\n\n`, 'info', opt);

	const localeObj: AnyValueObject = {};
	let targetFiles;

	// Get files from locale directory
	try {
		targetFiles = await readdir(_path);
	} catch {
		_errorAndExit('Failed to fetch translate file lists from locale directory');
		return;
	}

	// Get translation strings from file
	for (const file of targetFiles) {
		const filePath = joinFilePath(__isWindows, _path, file);

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

	/* =====================================================
	 * Validate i18n locales
	 * ===================================================== */

	/* -----------------------
	 * [CHECK] Empty keys
	 * ----------------------- */
	const listDoesNotHaveKeys = [];

	let objUniqueLocaleValues: any = {};

	// Search key is missing
	for (const compareKey of Object.keys(localeObj[_targetLang])) {
		for (const locale of Object.keys(localeObj)) {
			if (locale !== _targetLang) {
				if (!Object.keys(localeObj[locale]).includes(compareKey)) {
					listDoesNotHaveKeys.push(
						` - ${locale} -> '${compareKey}' (${_targetLang}: ${localeObj[_targetLang][compareKey]})`
					);
				}
			}
		}
	}

	if (listDoesNotHaveKeys.length > 0) {
		_errorAndExit(
			`Some translation files did not include the following keys:\n\n${listDoesNotHaveKeys.join('\n')}\n`
		);
		return;
	}

	/* -----------------------
	 * [CHECK] Duplicate values
	 * ----------------------- */
	const listDuplicatedValues = [];

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

	if (listDuplicatedValues.length > 0 && !_noWarn) {
		_log(
			`Some keys have duplicate values. Ignore this warning if necessary:\n\n${listDuplicatedValues.join('\n')}\n`,
			'warn',
			opt
		);
	}

	/* -----------------------
	 * [CHECK] Not translated keys
	 * ----------------------- */
	const listNotTranslatedKeys = [];

	// Search not translated key
	for (const locale of Object.keys(localeObj)) {
		if (locale !== _targetLang) {
			for (const notTranslateCheckKey of Object.keys(localeObj[locale])) {
				if (
					localeObj[locale][notTranslateCheckKey] === localeObj[_targetLang][notTranslateCheckKey]
				) {
					listNotTranslatedKeys.push(
						` - ${locale} -> '${notTranslateCheckKey}' (${_targetLang}: ${localeObj[locale][notTranslateCheckKey]?.replace(/\n/g, '\\n')})`
					);
				}
			}
		}
	}

	if (listNotTranslatedKeys.length > 0 && !_noWarn) {
		_log(
			`Some translation keys have the same value as the primary language. If you don't need a translation, don't define it in the translation file, or make sure the translation is not complete. If everything is fine, ignore this error:\n\n${listNotTranslatedKeys.join('\n')}\n`,
			'warn',
			opt
		);
	}

	/* =====================================================
	 * End
	 * ===================================================== */
	_log('Done!\n', 'info', opt);

	return {
		success: true
	};
};

if (__isCliMode) {
	(async () => {
		await checkTranslationFiles('');
	})();
}

export default checkTranslationFiles;
