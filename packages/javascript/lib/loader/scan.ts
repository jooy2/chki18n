import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CHECK_CODE, FILE_FORMAT, SUPPORTED_EXTENSIONS } from '../constants.js';
import { createFileExcluder, createPathExcluder } from '../core/exclude.js';
import { createIssue } from '../core/issue.js';
import { isLocaleCode } from '../core/locale.js';
import { findDuplicateJsonKeys, type JsonDuplicateKey } from './jsonDuplicates.js';
import type {
	Chki18nFileFormat,
	Chki18nIssue,
	Chki18nResolvedOptions,
	Chki18nSourceFile,
	TranslationGroups
} from '../_types/global.js';

export type Chki18nScanResult = {
	/** Layout the files were read as, whether detected or forced. */
	fileFormat: Chki18nFileFormat;
	/** Parsed translations, ready to hand to the analyzer. */
	groups: TranslationGroups;
	files: Chki18nSourceFile[];
	/** Files that were read but did not belong to any locale. */
	skipped: string[];
	issues: Chki18nIssue[];
};

type ScannedFile = {
	path: string;
	relativePath: string;
	/** Path segments relative to the scan root, file name last. */
	segments: string[];
	json: any;
	/** Keys written twice in the text, which parsing has since collapsed. */
	duplicateKeys: JsonDuplicateKey[];
};

const stemOf = (fileName: string): string => fileName.replace(/\.[^.]+$/, '');

const isPlainObject = (value: unknown): boolean =>
	value !== null && typeof value === 'object' && !Array.isArray(value);

/** Top level keys of a file that name a locale, as the `nested` layout does. */
const nestedLocaleKeys = (json: unknown): string[] =>
	isPlainObject(json) ? Object.keys(json as object).filter(isLocaleCode) : [];

/** Read every supported file below `root`, parsed and in a stable order. */
async function collectFiles(
	root: string,
	options: Chki18nResolvedOptions,
	issues: Chki18nIssue[]
): Promise<ScannedFile[]> {
	const files: ScannedFile[] = [];
	const isExcludedDirectory = createPathExcluder(options.exclude);
	const isExcludedFile = createFileExcluder(options.excludeFiles);

	const walk = async (directory: string, segments: string[]): Promise<void> => {
		let entries;

		try {
			entries = await readdir(directory, { withFileTypes: true });
		} catch {
			issues.push(
				createIssue(CHECK_CODE.INVALID_FILE, {
					file: directory,
					message: `Failed to read the directory '${directory}'. It may not exist or read access may be denied.`
				})
			);
			return;
		}

		// `readdir` order is filesystem dependent; sort so a scan of the same
		// tree always reports its issues in the same order.
		entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

		for (const entry of entries) {
			// Hidden entries are tooling state, never translations.
			if (entry.name.startsWith('.')) {
				continue;
			}

			const path = join(directory, entry.name);

			if (entry.isDirectory()) {
				if (!isExcludedDirectory([...segments, entry.name])) {
					await walk(path, [...segments, entry.name]);
				}

				continue;
			}

			const extension = entry.name.split('.').pop()?.toLowerCase() ?? '';

			if (!SUPPORTED_EXTENSIONS.includes(extension) || isExcludedFile(entry.name)) {
				continue;
			}

			const relativePath = [...segments, entry.name].join('/');
			const readError = `Failed to read file '${relativePath}': `;
			let content: string;

			try {
				content = await readFile(path, { encoding: 'utf-8' });
			} catch {
				issues.push(
					createIssue(CHECK_CODE.INVALID_FILE, {
						file: path,
						message: `${readError}May be read access denied or invalid file format.`
					})
				);
				continue;
			}

			if (content.trim().length < 1) {
				issues.push(
					createIssue(CHECK_CODE.INVALID_FILE, {
						file: path,
						message: `${readError}File content is empty.`
					})
				);
				continue;
			}

			let json;

			try {
				json = JSON.parse(content);
			} catch {
				issues.push(
					createIssue(CHECK_CODE.INVALID_FILE, {
						file: path,
						message: `${readError}Content is not json format or parse failed due to an invalid character.`
					})
				);
				continue;
			}

			files.push({
				path,
				relativePath,
				segments: [...segments, entry.name],
				json,
				// Read off the text, because `JSON.parse` has already discarded it.
				duplicateKeys: options.enabledChecks.has(CHECK_CODE.DUPLICATE_KEY)
					? findDuplicateJsonKeys(content)
					: []
			});
		}
	};

	await walk(root, []);

	return files;
}

/**
 * Work out how the files are laid out. The path shape alone is ambiguous
 * (`a/ko.json` and `ko/common.json` both have two segments), so the decision is
 * made by which segment is a real locale code: a locale named file means
 * `single`, a locale named folder means `folder`. When no path segment is a
 * locale, a file whose top level keys are locales means `nested`.
 */
function detectFileFormat(files: ScannedFile[]): Chki18nFileFormat {
	for (const file of files) {
		if (isLocaleCode(stemOf(file.segments[file.segments.length - 1]))) {
			return FILE_FORMAT.SINGLE;
		}

		if (isLocaleCode(file.segments[file.segments.length - 2] ?? '')) {
			return FILE_FORMAT.FOLDER;
		}
	}

	for (const file of files) {
		if (nestedLocaleKeys(file.json).length > 0) {
			return FILE_FORMAT.NESTED;
		}
	}

	return FILE_FORMAT.SINGLE;
}

/**
 * Sort the files into comparable groups. A group is one set of files that hold
 * the same keys in different languages, so a project with several translation
 * files (`common.json`, `errors.json`) is compared file by file rather than as
 * one flat pile of keys.
 */
function buildGroups(
	files: ScannedFile[],
	fileFormat: Chki18nFileFormat,
	issues: Chki18nIssue[]
): Pick<Chki18nScanResult, 'groups' | 'files' | 'skipped'> {
	const groups: TranslationGroups = {};
	const sources: Chki18nSourceFile[] = [];
	const skipped: string[] = [];

	const add = (group: string, locale: string, translations: any, file: ScannedFile) => {
		(groups[group] ??= {})[locale] = translations;
		sources.push({ path: file.path, relativePath: file.relativePath, group, locale });

		// A `nested` file's paths start with the locale that owns them; every
		// other layout's are already relative to the locale's own root.
		const prefix = fileFormat === FILE_FORMAT.NESTED ? `${locale}.` : '';

		for (const duplicate of file.duplicateKeys) {
			if (prefix && !duplicate.path.startsWith(prefix)) {
				continue;
			}

			issues.push(
				createIssue(CHECK_CODE.DUPLICATE_KEY, {
					locale,
					group,
					key: duplicate.path.slice(prefix.length),
					file: file.path,
					message: `The key is written twice in '${file.relativePath}' (line ${duplicate.line}), so one of its values is lost.`
				})
			);
		}
	};

	for (const file of files) {
		const segments = file.segments;
		const fileName = segments[segments.length - 1];

		if (fileFormat === FILE_FORMAT.NESTED) {
			const locales = nestedLocaleKeys(file.json);

			if (locales.length < 1) {
				skipped.push(file.relativePath);
				continue;
			}

			for (const locale of locales) {
				add(file.relativePath, locale, file.json[locale], file);
			}

			continue;
		}

		if (fileFormat === FILE_FORMAT.FOLDER) {
			const locale = segments[segments.length - 2] ?? '';

			if (!isLocaleCode(locale)) {
				skipped.push(file.relativePath);
				continue;
			}

			const directory = segments.slice(0, -2).join('/');

			add(directory ? `${directory}/${fileName}` : fileName, locale, file.json, file);
			continue;
		}

		const locale = stemOf(fileName);

		if (!isLocaleCode(locale)) {
			skipped.push(file.relativePath);
			continue;
		}

		add(segments.slice(0, -1).join('/'), locale, file.json, file);
	}

	return { groups, files: sources, skipped };
}

/**
 * Read a directory of translation files into the shape the analyzer compares.
 * This is the only part of the library that touches the file system.
 */
export async function scanTranslationDirectory(
	path: string,
	options: Chki18nResolvedOptions
): Promise<Chki18nScanResult> {
	const issues: Chki18nIssue[] = [];
	const files = await collectFiles(path, options, issues);
	const fileFormat = options.format === FILE_FORMAT.AUTO ? detectFileFormat(files) : options.format;
	const built = buildGroups(files, fileFormat, issues);

	if (built.files.length < 1) {
		issues.push(
			createIssue(CHECK_CODE.INVALID_FILE, {
				file: path,
				message: files.length
					? `No translation file matching the \`${fileFormat}\` format was found in '${path}'. Check the \`format\` option.`
					: `No translation file was found in '${path}'.`
			})
		);
	}

	return { fileFormat, ...built, issues };
}
