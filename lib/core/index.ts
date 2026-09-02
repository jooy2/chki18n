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
	DEFAULT_INTERPOLATION_PREFIX,
	DEFAULT_INTERPOLATION_SUFFIX,
	DEFAULT_TARGET_LOCALE,
	FILE_FORMAT
} from '../constants.js';
export { analyzeTranslations, createAnalyzer } from './analyzer.js';
export type { Chki18nAnalyzer } from './analyzer.js';
export { extractInterpolationKeys } from './interpolation.js';
export { createIssue, groupIssuesByCode, summarizeIssues } from './issue.js';
export { buildResult } from './result.js';
export { createSession } from './session.js';
export type { Chki18nSession } from './session.js';
export { isLocaleCode } from './locale.js';
export { argsToOptions, buildUsageText, OPTION_DEFINITIONS, resolveOptions } from '../options.js';
export type {
	Chki18nCheckCode,
	Chki18nEntry,
	Chki18nFileFormat,
	Chki18nInput,
	Chki18nIssue,
	Chki18nLevel,
	Chki18nLevelCount,
	Chki18nOptions,
	Chki18nResolvedOptions,
	Chki18nResult,
	Chki18nSourceFile,
	Chki18nSummary,
	TranslationGroups,
	TranslationMap
} from '../_types/global.js';
