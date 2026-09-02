import { isAbsolute } from 'node:path';
import { objToPrettyStr } from 'qsu';
import { joinFilePath } from 'qsu/node';
import { __isWindows, CHECK_CODE } from './constants.js';
import { createAnalyzer } from './core/analyzer.js';
import { createIssue, groupIssuesByCode, hasError, summarizeIssues } from './core/issue.js';
import { scanTranslationDirectory } from './loader/scan.js';
import { createLogger } from './logger.js';
import { reportResult } from './reporter.js';
import type {
	Chki18nIssue,
	Chki18nOptions,
	Chki18nResolvedOptions,
	Chki18nResult
} from './_types/global.js';

/** Assemble a result around a set of issues, deriving everything countable. */
function buildResult(
	issues: Chki18nIssue[],
	options: Chki18nResolvedOptions,
	rest: Partial<Chki18nResult> = {}
): Chki18nResult {
	return {
		success: !hasError(issues),
		issues,
		issuesByCode: groupIssuesByCode(issues),
		summary: summarizeIssues(issues),
		target: options.target,
		locales: [],
		groups: [],
		keyCount: 0,
		files: [],
		fileFormat: null,
		elapsedMs: 0,
		...rest
	};
}

/**
 * Read a directory of translation files and compare every language against the
 * target language.
 *
 * Nothing is printed unless `verbose` is set and the process never exits on its
 * own, so the result is the only thing a caller has to act on.
 */
export async function checkTranslationFiles(
	path?: string,
	options?: Chki18nOptions
): Promise<Chki18nResult> {
	const startedAt = Date.now();
	const analyzer = createAnalyzer({ path, ...options });
	const resolved = analyzer.options;
	const logger = createLogger(resolved);

	logger.debug(
		`Options: ${objToPrettyStr({
			...resolved,
			enabledChecks: [...resolved.enabledChecks],
			exclude: [...resolved.exclude]
		})}`
	);

	if (!resolved.path) {
		const message = 'No `path` argument is specified.';

		logger.error(message);

		return buildResult(
			[createIssue(CHECK_CODE.INVALID_OPTIONS, { level: 'error', message })],
			resolved,
			{ elapsedMs: Date.now() - startedAt }
		);
	}

	const scanPath = isAbsolute(resolved.path)
		? resolved.path
		: joinFilePath(__isWindows, process.cwd(), resolved.path);

	logger.info(`Process to check specified translation files... (Current path: ${scanPath})`);

	const scan = await scanTranslationDirectory(scanPath, resolved);

	logger.debug(`Detected file format: ${scan.fileFormat}`);

	for (const skipped of scan.skipped) {
		logger.debug(`Skipped '${skipped}': it does not belong to a known locale.`);
	}

	logger.info(`This comparison is based on the following language: ${resolved.target}`);

	const analyzed = analyzer.analyze({ groups: scan.groups, files: scan.files });
	// Only what the analysis alone could know is carried over: everything
	// derived from the issue list has to be recomputed over both sets, or a
	// failure found while reading the files would not fail the run.
	const result = buildResult([...scan.issues, ...analyzed.issues], resolved, {
		locales: analyzed.locales,
		groups: analyzed.groups,
		keyCount: analyzed.keyCount,
		files: analyzed.files,
		fileFormat: scan.fileFormat,
		elapsedMs: Date.now() - startedAt
	});

	reportResult(result, logger);

	if (result.success) {
		logger.pass('The scan is complete. No critical issues were found.');
	} else {
		logger.error(
			'The scan is complete. There is a critical issue with the translation file. Please review the results above.'
		);
	}

	return result;
}

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
} from './constants.js';
export { analyzeTranslations, createAnalyzer } from './core/analyzer.js';
export type { Chki18nAnalyzer } from './core/analyzer.js';
export { extractInterpolationKeys } from './core/interpolation.js';
export { groupIssuesByCode, summarizeIssues } from './core/issue.js';
export { isLocaleCode } from './core/locale.js';
export { argsToOptions, buildUsageText, OPTION_DEFINITIONS, resolveOptions } from './options.js';
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
} from './_types/global.js';

export default checkTranslationFiles;
