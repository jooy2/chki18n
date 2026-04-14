#!/usr/bin/env node
import minimist from 'minimist';
import { readdir, readFile } from 'fs/promises';
import { flatten } from 'flat';
import { capitalizeFirst, objToPrettyStr } from 'qsu';
import { getFileExtension, getFileName, joinFilePath } from 'qsu/node';
import { isAbsolute } from 'node:path';
import packageJson from '../package.json' with { type: 'json' };
import { _debugLog, _error, _log, _pass } from './logger.js';
import { __isCliMode, __isWindows, CHECK_CODE } from './constants.js';
import type { AnyValueObject } from './_types/global';

function _errorAndExit(message: string, code?: string) {
	_error(code ? `[${code}] ${message}` : message);
	_error(`The job was aborted due to an invalid translation file. See above issues.`);

	setTimeout(() => process.exit(1), 1000);

	return {
		success: false,
		code: code ?? CHECK_CODE.UNKNOWN
	};
}

function _warnButContinue(message: string, code: string, opt: any) {
	_log(`[${code}] ${message}`, 'warn', opt);
}

function _passAndContinue(code: string) {
	_pass(`[${code}] Verification passed.`);
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

	_log(
		`${capitalizeFirst(packageJson.name)} ${packageJson.version} (Check-and-verify-your-i18n-files)\n`,
		'info',
		opt
	);
	_debugLog(`Options: ${objToPrettyStr(opt)}`, opt);

	let _path = args._?.[0] || opt?.path || path;
	let _targetLang = opt?.target;

	if (!_targetLang) {
		_warnButContinue(
			'No target language is specified. Defaulting to `en`.',
			CHECK_CODE.INVALID_OPTIONS,
			opt
		);
		_targetLang = 'en';
	} else {
		_log(`This comparison is based on the following language: ${_targetLang}\n`, 'info', opt);
	}

	if (!_path) {
		return _errorAndExit('No `path` argument is specified.');
	}

	if (!isAbsolute(_path)) {
		_path = joinFilePath(__isWindows, process.cwd(), _path);
	}

	_log(`Process to check specified translation files... (Current path: ${_path})`, 'info', opt);

	const localeObj: AnyValueObject = {};
	let targetFiles;

	// Get files from locale directory
	try {
		targetFiles = await readdir(_path);
	} catch {
		return _errorAndExit('Failed to fetch translate file lists from locale directory');
	}

	// Get translation strings from file
	for (const file of targetFiles) {
		const filePath = joinFilePath(__isWindows, _path, file);
		const fileName = getFileName(filePath, false);
		const fileExt = getFileExtension(filePath);

		if (fileExt !== 'json') {
			continue;
		}

		const commonReadError = `Failed to read file '${filePath}': `;
		let fileContent;
		let parseToJSONContent;

		try {
			fileContent = await readFile(filePath, { encoding: 'utf-8' });

			if (!fileContent) {
				return _errorAndExit(`${commonReadError}File content is empty`, CHECK_CODE.INVALID_FILE);
			}
		} catch {
			return _errorAndExit(
				`${commonReadError}May be read access denied or invalid file format`,
				CHECK_CODE.INVALID_FILE
			);
		}

		try {
			parseToJSONContent = JSON.parse(fileContent);
		} catch {
			return _errorAndExit(
				`${commonReadError}Content is not json format or parse failed due to invalid character detected`,
				CHECK_CODE.INVALID_FILE
			);
		}

		try {
			localeObj[fileName] = flatten(parseToJSONContent);
		} catch {
			return _errorAndExit(
				`${commonReadError}Invalid translate key or i18n format`,
				CHECK_CODE.INVALID_FILE
			);
		}
	}

	_passAndContinue(CHECK_CODE.INVALID_FILE);

	/* =====================================================
	 * Validate i18n locales
	 * ===================================================== */

	/* -----------------------
	 * [CHECK] Key is missing
	 * ----------------------- */
	const listDoesNotHaveKeys = [];

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
		return _errorAndExit(
			`Some translation files did not include the following keys:\n\n${listDoesNotHaveKeys.join('\n')}\n`,
			CHECK_CODE.NO_KEY
		);
	} else {
		_passAndContinue(CHECK_CODE.NO_KEY);
	}

	/* -----------------------
	 * [CHECK] Not used keys
	 * ----------------------- */
	const listNotUsedKeys = [];

	// Not used keys
	for (const locale of Object.keys(localeObj)) {
		for (const compareKey of Object.keys(localeObj[locale])) {
			if (locale !== _targetLang) {
				if (!Object.hasOwn(localeObj[_targetLang], compareKey)) {
					listNotUsedKeys.push(` - ${locale} -> '${compareKey}'`);
				}
			}
		}
	}

	if (listNotUsedKeys.length > 0) {
		return _warnButContinue(
			`The following key does not exist in the target language. It may be an unused key:\n\n${listNotUsedKeys.join('\n')}\n`,
			CHECK_CODE.DUMMY_KEY,
			opt
		);
	} else {
		_passAndContinue(CHECK_CODE.DUMMY_KEY);
	}

	/* -----------------------
	 * [CHECK] Value is empty
	 * ----------------------- */
	const listEmptyValues = [];

	let objUniqueLocaleValues: AnyValueObject = {};

	// Value is empty
	for (const compareKey of Object.keys(localeObj[_targetLang])) {
		for (const locale of Object.keys(localeObj)) {
			if (locale !== _targetLang) {
				if (localeObj[locale]?.length < 1) {
					listEmptyValues.push(` - ${locale} -> '${compareKey}'`);
				}
			}
		}
	}

	if (listEmptyValues.length > 0) {
		return _errorAndExit(
			`The value for the following item is empty:\n\n${listEmptyValues.join('\n')}\n`,
			CHECK_CODE.EMPTY_VALUE
		);
	} else {
		_passAndContinue(CHECK_CODE.EMPTY_VALUE);
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

	if (listDuplicatedValues.length > 0) {
		_warnButContinue(
			`Some keys have duplicate values. Ignore this warning if necessary:\n\n${listDuplicatedValues.join('\n')}\n`,
			CHECK_CODE.DUPLICATE_VALUE,
			opt
		);
	} else {
		_passAndContinue(CHECK_CODE.DUPLICATE_VALUE);
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

	if (listNotTranslatedKeys.length > 0) {
		_warnButContinue(
			`Some translation keys have the same value as the primary language. If you don't need a translation, don't define it in the translation file, or make sure the translation is not complete. If everything is fine, ignore this error:\n\n${listNotTranslatedKeys.join('\n')}\n`,
			CHECK_CODE.NOT_TRANSLATED_VALUE,
			opt
		);
	} else {
		_passAndContinue(CHECK_CODE.NOT_TRANSLATED_VALUE);
	}

	/* =====================================================
	 * End
	 * ===================================================== */
	_log('The task is complete.\n', 'info', opt);

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
