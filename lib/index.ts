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
	_error(
		`Task complete. But the job was aborted due to an invalid translation file. See above issues.`
	);

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
	const listIssueItems: {
		locale: string;
		key: string;
		value: string;
		targetValue: string;
		code: string;
	}[] = [];

	/* -----------------------
	 * [CHECK:NO_KEY] Primary locale key is missing
	 * ----------------------- */
	for (const compareKey of Object.keys(localeObj[_targetLang])) {
		for (const locale of Object.keys(localeObj)) {
			if (locale !== _targetLang) {
				if (!Object.keys(localeObj[locale]).includes(compareKey)) {
					listIssueItems.push({
						locale,
						key: compareKey,
						value: localeObj[locale][compareKey],
						targetValue: localeObj[_targetLang][compareKey],
						code: CHECK_CODE.NO_KEY
					});
				}
			}
		}
	}

	/* -----------------------
	 * [CHECK:DUMMY_KEY] Not used keys
	 * ----------------------- */
	for (const locale of Object.keys(localeObj)) {
		for (const compareKey of Object.keys(localeObj[locale])) {
			if (locale !== _targetLang) {
				if (!Object.hasOwn(localeObj[_targetLang], compareKey)) {
					listIssueItems.push({
						locale,
						key: compareKey,
						value: localeObj[locale][compareKey],
						targetValue: localeObj[_targetLang][compareKey],
						code: CHECK_CODE.DUMMY_KEY
					});
				}
			}
		}
	}

	/* -----------------------
	 * [CHECK:EMPTY_VALUE] Value is empty
	 * ----------------------- */
	let objUniqueLocaleValues: AnyValueObject = {};

	// Value is empty
	for (const compareKey of Object.keys(localeObj[_targetLang])) {
		for (const locale of Object.keys(localeObj)) {
			if (locale !== _targetLang) {
				if (localeObj[locale]?.length < 1) {
					listIssueItems.push({
						locale,
						key: compareKey,
						value: localeObj[locale][compareKey],
						targetValue: localeObj[_targetLang][compareKey],
						code: CHECK_CODE.EMPTY_VALUE
					});
				}
			}
		}
	}

	/* -----------------------
	 * [CHECK:DUPLICATE_VALUE] Duplicate values
	 * ----------------------- */
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
				listIssueItems.push({
					locale,
					key: compareKey,
					value: localeObj[locale][compareKey],
					targetValue: localeObj[_targetLang][compareKey],
					code: CHECK_CODE.DUPLICATE_VALUE
				});
			}
		}
	}

	/* -----------------------
	 * [CHECK:NOT_TRANSLATED_VALUE] Not translated keys
	 * ----------------------- */
	for (const locale of Object.keys(localeObj)) {
		if (locale !== _targetLang) {
			for (const compareKey of Object.keys(localeObj[locale])) {
				if (localeObj[locale][compareKey] === localeObj[_targetLang][compareKey]) {
					listIssueItems.push({
						locale,
						key: compareKey,
						value: localeObj[locale][compareKey],
						targetValue: localeObj[_targetLang][compareKey],
						code: CHECK_CODE.NOT_TRANSLATED_VALUE
					});
				}
			}
		}
	}

	/* =====================================================
	 * Report
	 * ===================================================== */
	let issueMessage;
	let prevIssueCode;

	for (const item of listIssueItems) {
		switch (item.code) {
			case CHECK_CODE.NO_KEY:
				issueMessage = 'Some translation files did not include the following keys';
				break;
			case CHECK_CODE.DUMMY_KEY:
				issueMessage =
					'The following key does not exist in the target language. It may be an unused key';
				break;
			case CHECK_CODE.EMPTY_VALUE:
				issueMessage = 'The value for the following item is empty';
				break;
			case CHECK_CODE.DUPLICATE_VALUE:
				issueMessage = 'Some keys have duplicate values. Ignore this warning if necessary';
				break;
			case CHECK_CODE.NOT_TRANSLATED_VALUE:
				issueMessage =
					"Some translation keys have the same value as the primary language. If you don't need a translation, don't define it in the translation file, or make sure the translation is not complete. If everything is fine, ignore this error";
				break;
			default:
			case CHECK_CODE.UNKNOWN:
				issueMessage = 'Unknown error';
				break;
		}

		if (prevIssueCode !== item.code) {
			_log(`${issueMessage}:\n`, 'warn', opt);
			prevIssueCode = item.code;
		}

		console.log(` - ${item.locale} -> '${item.key}' (${_targetLang}: ${item.targetValue})})`);
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
