#!/usr/bin/env node
import minimist from 'minimist';
import { readdir, readFile } from 'fs/promises';
import { flatten } from 'flat';
import { capitalizeFirst, getGroupKeys, objToPrettyStr } from 'qsu';
import { getFileExtension, getFileName, joinFilePath } from 'qsu/node';
import { isAbsolute } from 'node:path';
import packageJson from '../package.json' with { type: 'json' };
import { _debugLog, _error, _log, _pass } from './logger.js';
import { __isCliMode, __isWindows, CHECK_CODE } from './constants.js';
import type { AnyValueObject, Chki18nOptions, Chki18nResult, ListIssueItem } from './_types/global';

function _exitWithException(
	resultIssueItems?: Partial<Record<string, ListIssueItem[]>>
): Chki18nResult {
	_error(
		`The scan is complete. There is a critical issue with the translation file. Please review the results at the top of the page.`
	);

	const resultData = {
		success: false,
		issues: resultIssueItems
	};

	if (__isCliMode) {
		setTimeout(() => {
			process.exit(1);
		}, 1000);
	}

	return resultData;
}

function _warnButContinue(message: string, code: string, opt: any) {
	_log(`[${code}] ${message}`, 'warn', opt);
}

function _passAndContinue(code: string) {
	_pass(`[${code}] Verification passed.`);
}

export const checkTranslationFiles = async (
	path?: string,
	options?: Chki18nOptions
): Promise<Chki18nResult> => {
	/* =====================================================
	 * Initialize & Validate option
	 * ===================================================== */
	const args: AnyValueObject = __isCliMode ? minimist(process.argv.slice(2)) : {};
	const opt: AnyValueObject = __isCliMode ? args : (options as AnyValueObject);
	let singleFileMode: boolean = false;

	_log(
		`${capitalizeFirst(packageJson.name)} ${packageJson.version} (Check-and-verify-your-i18n-files)\n`,
		'info',
		opt
	);
	_debugLog(`Options: ${objToPrettyStr(opt)}`, opt);

	let _path = opt?.path || path || (__isCliMode ? args._?.[0] : null);
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
		_error('No `path` argument is specified.');
		return _exitWithException();
	}

	if (!isAbsolute(_path)) {
		_path = joinFilePath(__isWindows, process.cwd(), _path);
	}

	_log(`Process to check specified translation files... (Current path: ${_path})`, 'info', opt);

	const localeObj: AnyValueObject = {};
	let targetFiles;

	// Get files from locale directory
	try {
		targetFiles = await readdir(_path, { withFileTypes: true });

		singleFileMode = targetFiles.findIndex((x) => x.isDirectory()) === -1;
		_debugLog(singleFileMode.toString(), opt);
	} catch {
		_error('Failed to fetch translate file lists from locale directory');
		return _exitWithException();
	}

	if (!singleFileMode) {
		_error(
			'Currently, this tool supports only single translation files. However, we plan to add support for multiple files soon! (Example of a single file: ko.json/en.json...)'
		);
		return _exitWithException();
	}

	// Get translation strings from file
	for (const dirent of targetFiles) {
		const filePath = joinFilePath(__isWindows, _path, dirent.name);
		const fileName = getFileName(filePath, false);
		// const locale = fileName;
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
				_error(`[${CHECK_CODE.INVALID_FILE}] ${commonReadError}File content is empty`);
				return _exitWithException();
			}
		} catch {
			_error(
				`[${CHECK_CODE.INVALID_FILE}] ${commonReadError}May be read access denied or invalid file format`
			);
			return _exitWithException();
		}

		try {
			parseToJSONContent = JSON.parse(fileContent);
		} catch {
			_error(
				`[${CHECK_CODE.INVALID_FILE}] ${commonReadError}Content is not json format or parse failed due to invalid character detected`
			);
			return _exitWithException();
		}

		try {
			localeObj[fileName] = flatten(parseToJSONContent);
		} catch {
			_error(`[${CHECK_CODE.INVALID_FILE}] ${commonReadError}Invalid translate key or i18n format`);
			return _exitWithException();
		}
	}

	_passAndContinue(CHECK_CODE.INVALID_FILE);

	/* =====================================================
	 * Validate i18n locales
	 * ===================================================== */
	const listIssueItems: ListIssueItem[] = [];
	const interpolationPrefix: string = '{';
	const interpolationSuffix: string = '}';

	for (const key of Object.keys(localeObj[_targetLang])) {
		for (const locale of Object.keys(localeObj)) {
			if (locale !== _targetLang) {
				const value: string = localeObj[locale][key];
				const targetValue: string = localeObj[_targetLang][key];
				const currentInterpolationList: string[] = getGroupKeys(
					value,
					interpolationPrefix,
					interpolationSuffix
				);
				const targetInterpolationList = getGroupKeys(
					targetValue,
					interpolationPrefix,
					interpolationSuffix
				);

				// [CHECK: NO_INTERPOLATION_KEY] Interpolation key is incorrect
				for (const interpolation of targetInterpolationList) {
					if (!currentInterpolationList.includes(interpolation)) {
						listIssueItems.push({
							locale,
							key,
							value,
							targetValue,
							interpolation,
							level: 'error',
							code: CHECK_CODE.NO_INTERPOLATION_KEY
						});
					}
				}

				// [CHECK: NO_KEY] Primary locale key is missing
				if (!Object.keys(localeObj[locale]).includes(key)) {
					listIssueItems.push({
						locale,
						key,
						value,
						targetValue,
						level: 'error',
						code: CHECK_CODE.NO_KEY
					});
				}
				// [CHECK: EMPTY_VALUE] Value is empty
				if (localeObj[locale]?.length < 1) {
					listIssueItems.push({
						locale,
						key,
						value,
						targetValue,
						level: 'warn',
						code: CHECK_CODE.EMPTY_VALUE
					});
				}
				// [CHECK: NOT_TRANSLATED_VALUE] Not translated keys
				if (localeObj[locale][key] === localeObj[_targetLang][key]) {
					listIssueItems.push({
						locale,
						key,
						value,
						targetValue,
						level: 'warn',
						code: CHECK_CODE.NOT_TRANSLATED_VALUE
					});
				}
				// [CHECK: DUMMY_KEY] Not used keys
				if (!Object.hasOwn(localeObj[_targetLang], key)) {
					listIssueItems.push({
						locale,
						key,
						value,
						targetValue,
						level: 'warn',
						code: CHECK_CODE.DUMMY_KEY
					});
				}
			}
		}
	}

	/* -----------------------
	 * [CHECK:DUPLICATE_VALUE] Duplicate values
	 * ----------------------- */
	let objUniqueLocaleValues: AnyValueObject = {};

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
					level: 'warn',
					code: CHECK_CODE.DUPLICATE_VALUE
				});
			}
		}
	}

	/* =====================================================
	 * Report
	 * ===================================================== */
	let issueMessage: string;
	let exitWithError: boolean = false;

	if (listIssueItems.findIndex((x) => x.level === 'error') !== -1) {
		exitWithError = true;
	}

	const listResultIssueItems: Partial<Record<string, ListIssueItem[]>> = Object.groupBy(
		listIssueItems,
		({ code }) => code
	);

	for (const issueCode of Object.keys(listResultIssueItems)) {
		if (!listResultIssueItems[issueCode]) {
			continue;
		}

		switch (issueCode) {
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
			case CHECK_CODE.NO_INTERPOLATION_KEY:
				issueMessage = 'The interpolation key does not match the primary locale';
				break;
			default:
			case CHECK_CODE.UNKNOWN:
				issueMessage = 'Unknown error';
				break;
		}

		_log('\n');
		_log(`[${issueCode}] ${issueMessage}:\n`, 'warn', opt);

		for (const item of listResultIssueItems[issueCode]) {
			_log(` - ${item.locale} -> '${item.key}' (${_targetLang}: ${item.targetValue})`);
		}
	}

	/* =====================================================
	 * End
	 * ===================================================== */
	_log('\n');

	if (exitWithError) {
		return _exitWithException(listResultIssueItems);
	} else {
		_log('The scan is complete. No critical issues were found.\n', 'info', opt);
	}

	return {
		success: true
	};
};

if (__isCliMode) {
	(async () => {
		await checkTranslationFiles();
	})();
}

export default checkTranslationFiles;
