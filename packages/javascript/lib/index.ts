import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { objToPrettyStr } from 'qsu';
import { CHECK_CODE, MAX_MEASURED_REPORT_WIDTH } from './constants.js';
import { collectFlatKeys } from './core/duplicate.js';
import { createIssue } from './core/issue.js';
import { buildResult } from './core/result.js';
import { createSession, type Chki18nSession } from './core/session.js';
import { scanTranslationDirectory } from './loader/scan.js';
import { findUnusedKeys } from './loader/unusedKeys.js';
import { createLogger } from './logger.js';
import { formatResult } from './reporter/index.js';
import { CHECK_CODE as CODES } from './constants.js';
import type {
	Chki18nIssue,
	Chki18nOptions,
	Chki18nResolvedOptions,
	Chki18nResult,
	TranslationGroups
} from './_types/global.js';

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
	 * What the source tree says about the keys: the ones nothing refers to, and
	 * the ones it asks for that nothing defines. Empty when no source directory
	 * was given. The project's own translation files are excluded from the
	 * search: a key appears verbatim in the file that defines it, which would
	 * mark every key used.
	 */
	const usageOf = async (groups: TranslationGroups, files: { path: string }[]) => {
		const wanted =
			session.options.enabledChecks.has(CODES.UNUSED_KEY) ||
			session.options.enabledChecks.has(CODES.UNDEFINED_KEY);

		if (!session.options.source || !wanted) {
			return { unusedKeys: [], undefinedKeys: [] };
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

		return { unusedKeys: scan.unusedKeys, undefinedKeys: scan.undefinedKeys };
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
		const usage = await usageOf(scan.groups, scan.files);

		skipped = scan.skipped;
		session.reset({
			groups: scan.groups,
			files: scan.files,
			issues: scan.issues,
			fileFormat: scan.fileFormat,
			unusedKeys: usage.unusedKeys,
			undefinedKeys: usage.undefinedKeys
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
 * Columns the console report lays itself out to: what `width` asked for, else
 * the terminal's own width, else what `COLUMNS` says — a CI runner often sets
 * that where there is no terminal to measure. A measured width is capped, since
 * a very wide terminal would put the counts too far from the labels for the two
 * to read as one line. `undefined` leaves the reporter on its own default.
 */
function consoleWidth(options: Chki18nResolvedOptions): number | undefined {
	if (options.width) {
		return options.width;
	}

	const measured = process.stdout.columns || Number(process.env.COLUMNS);

	return Number.isFinite(measured) && measured > 0
		? Math.min(measured, MAX_MEASURED_REPORT_WIDTH)
		: undefined;
}

/**
 * Write the report to the file `output` names, creating the directory it sits
 * in when it is not there yet. A write that fails comes back as an issue rather
 * than as an exception, so a report that never reached the disk cannot be
 * mistaken for one that did.
 */
async function writeReport(
	result: Chki18nResult,
	options: Chki18nResolvedOptions
): Promise<Chki18nIssue | null> {
	if (!options.output || !options.outputReporter) {
		return null;
	}

	const file = resolve(options.output);
	// A saved report is read later, by someone who no longer has the terminal
	// that produced it: no escape codes, and a fixed width.
	const text = formatResult(result, options, {
		reporter: options.outputReporter,
		color: false,
		// Not the terminal's width: the same run has to produce the same file
		// wherever it is run from.
		width: options.width ?? undefined,
		cwd: process.cwd()
	});

	try {
		await mkdir(dirname(file), { recursive: true });
		await writeFile(file, `${text}\n`, { encoding: 'utf-8' });
	} catch (error) {
		return createIssue(CHECK_CODE.INVALID_OPTIONS, {
			level: 'error',
			message: `The report could not be written to \`${options.output}\`: ${(error as Error).message}`
		});
	}

	return null;
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
			exclude: [...session.options.exclude],
			excludeFiles: [...session.options.excludeFiles]
		})}`
	);
	logger.debug(`Detected file format: ${session.fileFormat}`);

	for (const file of session.skipped) {
		logger.debug(`Skipped '${file}': it does not belong to a known locale.`);
	}

	// The session times its own comparison; this call also paid for the scan.
	const analysis = { ...session.analyze(), elapsedMs: Date.now() - startedAt };
	const failedWrite = await writeReport(analysis, session.options);
	// A report that could not be saved is a failure of the run, so it joins the
	// issues instead of being mentioned once and forgotten.
	const result = failedWrite
		? buildResult([...analysis.issues, failedWrite], session.options, analysis)
		: analysis;

	if (session.options.verbose) {
		console.log(
			formatResult(result, session.options, {
				width: consoleWidth(session.options),
				cwd: process.cwd()
			})
		);
	}

	return result;
}

// The comparison engine is also published on its own as `chki18n/core`, for
// callers that must not pull in the Node built-ins the scanner needs.
export * from './core/index.js';
// The reporters, so an application can render a result the way the CLI does
// without reimplementing the grouping and the wording.
export { displayWidth, formatResult, groupIssues, padTo, truncate } from './reporter/index.js';
export type {
	Chki18nIssueGroup,
	Chki18nReportContext,
	Chki18nReportInit
} from './reporter/index.js';
export type { Chki18nScanResult } from './loader/scan.js';
export { scanTranslationDirectory } from './loader/scan.js';
export { findUnusedKeys, leafOfKey } from './loader/unusedKeys.js';
export type { Chki18nUsageScan } from './loader/unusedKeys.js';

export default checkTranslationFiles;
