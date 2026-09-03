import { resolve } from 'node:path';
import { objToPrettyStr } from 'qsu';
import { CHECK_CODE } from './constants.js';
import { collectFlatKeys } from './core/duplicate.js';
import { createIssue } from './core/issue.js';
import { createSession, type Chki18nSession } from './core/session.js';
import { scanTranslationDirectory } from './loader/scan.js';
import { findUnusedKeys } from './loader/unusedKeys.js';
import { createLogger } from './logger.js';
import { reportResult } from './reporter.js';
import { CHECK_CODE as CODES } from './constants.js';
import type { Chki18nOptions, Chki18nResult, TranslationGroups } from './_types/global.js';

export type Chki18nFileSession = Chki18nSession & {
	/** Absolute path the translations were read from. */
	readonly path: string;
	/** Files that were read but did not belong to any locale. */
	readonly skipped: string[];
	/** Read the directory again, replacing everything the session holds. */
	reload: () => Promise<void>;
};

/**
 * Read a directory of translation files once and keep them, so the same set can
 * be checked as often as needed without touching the file system again.
 *
 * Use this when this module owns the translations. When your own application
 * owns them — an editor holding the values it is editing — pass the values
 * straight to `createAnalyzer().checkEntry` instead, so there is only ever one
 * copy to keep in step.
 */
export async function loadTranslations(
	path?: string,
	options?: Chki18nOptions
): Promise<Chki18nFileSession> {
	// `path` first: an explicit `options.path` wins over the argument, which is
	// what the CLI relies on when it passes everything through as options.
	const session = createSession({}, { path, ...options, flattened: false });
	const resolvedPath = session.options.path;
	const scanPath = resolvedPath ? resolve(resolvedPath) : '';

	let skipped: string[] = [];

	/**
	 * The keys nothing in `source` refers to, or none when no source directory
	 * was given. The project's own translation files are excluded from the
	 * search: a key appears verbatim in the file that defines it, which would
	 * mark every key used.
	 */
	const unusedKeysOf = async (groups: TranslationGroups, files: { path: string }[]) => {
		if (!session.options.source || !session.options.enabledChecks.has(CODES.UNUSED_KEY)) {
			return [];
		}

		const keys = new Set<string>();

		for (const locales of Object.values(groups)) {
			for (const translations of Object.values(locales)) {
				collectFlatKeys(translations, keys);
			}
		}

		const scan = await findUnusedKeys(
			resolve(session.options.source),
			[...keys],
			session.options,
			files.map((file) => file.path)
		);

		return scan.unusedKeys;
	};

	const reload = async (): Promise<void> => {
		if (!scanPath) {
			skipped = [];
			session.reset({
				issues: [
					createIssue(CHECK_CODE.INVALID_OPTIONS, {
						level: 'error',
						message: 'No `path` argument is specified.'
					})
				]
			});
			return;
		}

		const scan = await scanTranslationDirectory(scanPath, session.options);

		skipped = scan.skipped;
		session.reset({
			groups: scan.groups,
			files: scan.files,
			issues: scan.issues,
			fileFormat: scan.fileFormat,
			unusedKeys: await unusedKeysOf(scan.groups, scan.files)
		});
	};

	await reload();

	return Object.assign(session, {
		path: scanPath,
		reload,
		get skipped() {
			return skipped;
		}
	});
}

/**
 * Read a directory of translation files and compare every language against the
 * target language, in one call.
 *
 * Nothing is printed unless `verbose` is set and the process is never exited
 * for you, so the result is the only thing a caller has to act on. Reach for
 * `loadTranslations` instead when the same directory is checked more than once.
 */
export async function checkTranslationFiles(
	path?: string,
	options?: Chki18nOptions
): Promise<Chki18nResult> {
	const startedAt = Date.now();
	const session = await loadTranslations(path, options);
	const logger = createLogger(session.options);

	logger.debug(
		`Options: ${objToPrettyStr({
			...session.options,
			enabledChecks: [...session.options.enabledChecks],
			exclude: [...session.options.exclude]
		})}`
	);

	if (!session.path) {
		logger.error('No `path` argument is specified.');
	} else {
		logger.info(`Process to check specified translation files... (Current path: ${session.path})`);
		logger.debug(`Detected file format: ${session.fileFormat}`);

		for (const file of session.skipped) {
			logger.debug(`Skipped '${file}': it does not belong to a known locale.`);
		}

		logger.info(`This comparison is based on the following language: ${session.options.target}`);
	}

	// The session times its own comparison; this call also paid for the scan.
	const result = { ...session.analyze(), elapsedMs: Date.now() - startedAt };

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

// The comparison engine is also published on its own as `chki18n/core`, for
// callers that must not pull in the Node built-ins the scanner needs.
export * from './core/index.js';
export type { Chki18nScanResult } from './loader/scan.js';
export { scanTranslationDirectory } from './loader/scan.js';
export { findUnusedKeys, leafOfKey } from './loader/unusedKeys.js';
export type { Chki18nUsageScan } from './loader/unusedKeys.js';

export default checkTranslationFiles;
