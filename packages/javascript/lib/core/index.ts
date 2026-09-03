/**
 * The comparison engine on its own, without the file system.
 *
 * Published as `chki18n/core` so it can be imported anywhere JavaScript runs,
 * including a browser or an editor's renderer process, where the Node built-ins
 * the directory scanner needs are not available. Everything here is exported
 * from the package root as well; reach for this entry point when the bundle
 * must not pull in `node:fs` and friends.
 */
export {
	ANALYZE_CHECK_CODES,
	CHECK_CODE,
	CHECK_META,
	CROSS_KEY_CHECK_CODES,
	DEFAULT_EXCLUDE_DIRS,
	DEFAULT_GROUP_BY,
	DEFAULT_INTERPOLATION_PREFIX,
	DEFAULT_INTERPOLATION_SUFFIX,
	DEFAULT_REPORT_WIDTH,
	DEFAULT_REPORTER,
	DEFAULT_TARGET_LOCALE,
	FILE_FORMAT,
	GROUP_BY,
	REPORTER,
	REPORTER_BY_EXTENSION
} from '../constants.js';
export { analyzeTranslations, createAnalyzer } from './analyzer.js';
export type { Chki18nAnalyzer } from './analyzer.js';
export { collectFlatKeys, findDuplicateKeys } from './duplicate.js';
export { extractInterpolationKeys } from './interpolation.js';
export { createIssue, groupIssuesByCode, summarizeIssues } from './issue.js';
export { buildResult } from './result.js';
export { createSession } from './session.js';
export type { Chki18nSession } from './session.js';
export { isLocaleCode } from './locale.js';
export {
	argsToOptions,
	buildUsageText,
	OPTION_DEFINITIONS,
	reporterOfFileName,
	resolveOptions
} from '../options.js';
export type {
	Chki18nCheckCode,
	Chki18nEntry,
	Chki18nFileFormat,
	Chki18nGroupBy,
	Chki18nInput,
	Chki18nIssue,
	Chki18nLevel,
	Chki18nLevelCount,
	Chki18nOptions,
	Chki18nReporter,
	Chki18nResolvedOptions,
	Chki18nResult,
	Chki18nSourceFile,
	Chki18nSummary,
	TranslationGroups,
	TranslationMap
} from '../_types/global.js';
