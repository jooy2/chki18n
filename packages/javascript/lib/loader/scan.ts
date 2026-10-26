import { readFile } from 'node:fs/promises';
import { CHECK_CODE, FILE_FORMAT, SUPPORTED_EXTENSIONS } from '../constants.js';
import { createFileExcluder, createPathExcluder } from '../core/exclude.js';
import {
	detectInterpolationDelimiters,
	INTERPOLATION_DELIMITERS,
	type Chki18nDelimiters
} from '../core/interpolation.js';
import { createIssue } from '../core/issue.js';
import { isLocaleCode } from '../core/locale.js';
import { findDuplicateJsonKeys, type JsonDuplicateKey } from './jsonDuplicates.js';
import { extensionOf, walkFiles, type WalkedFile } from './walk.js';
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
	/**
	 * Interpolation delimiters the files appear to be written with, or `null`
	 * when nothing in them looks like one. A guess to offer a user setting a
	 * project up; the run itself uses `interpolationPrefix` either way.
	 */
	detectedInterpolation: Chki18nDelimiters | null;
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
	/** Delimiters this file's own text looks like it is written with. */
	interpolation: Chki18nDelimiters | null;
};

const stemOf = (fileName: string): string => fileName.replace(/\.[^.]+$/, '');

/**
 * The text without the byte order mark a Windows editor often writes first.
 * `JSON.parse` refuses one, so a file saved that way would not be read at all.
 */
const withoutByteOrderMark = (text: string): string =>
	text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

const isPlainObject = (value: unknown): boolean =>
	value !== null && typeof value === 'object' && !Array.isArray(value);

/** Top level keys of a file that name a locale, as the `nested` layout does. */
const nestedLocaleKeys = (json: unknown): string[] =>
	isPlainObject(json) ? Object.keys(json as object).filter(isLocaleCode) : [];

/**
 * The layout the files' paths say they are in, or `null` when no path names a
 * locale. The path shape alone is ambiguous (`a/ko.json` and `ko/common.json`
 * both have two segments), so the decision is made by which segment is a real
 * locale code: a locale named file means `single`, a locale named folder means
 * `folder`. Only a file that could be read decides.
 */
function fileFormatOfPaths(files: ScannedFile[]): Chki18nFileFormat | null {
	for (const { segments } of files) {
		if (isNamedForLocale(segments)) {
			return FILE_FORMAT.SINGLE;
		}

		if (isInLocaleFolder(segments)) {
			return FILE_FORMAT.FOLDER;
		}
	}

	return null;
}

/** A file the scan found and did not read, because its path names no locale. */
type UnreadFile = { path: string; relativePath: string; segments: string[]; json?: undefined };

/** A place in the walk: a file found there, or a directory it could not list. */
type Slot = { issue: Chki18nIssue } | { file: WalkedFile; read?: ScannedFile | Chki18nIssue };

/**
 * How many files are read at once. Enough to keep the disk busy, few enough
 * that a large tree does not run out of file handles.
 */
const READ_CONCURRENCY = 16;

/** Whether a file's own name is a locale, as the `single` layout names them. */
const isNamedForLocale = (segments: string[]): boolean =>
	isLocaleCode(stemOf(segments[segments.length - 1]));

/** Whether a file sits in a folder named for a locale, as `folder` puts them. */
const isInLocaleFolder = (segments: string[]): boolean =>
	isLocaleCode(segments[segments.length - 2] ?? '');

/**
 * Whether a file has to be read in a layout. Every layout but `nested` names its
 * locales in the path, so a file whose path names none can hold no locale's
 * translations, and reading it would only parse a fixture or a data file of the
 * application the scan was pointed at.
 */
function mayHoldLocale(segments: string[], format: Chki18nFileFormat): boolean {
	if (format === FILE_FORMAT.SINGLE) {
		return isNamedForLocale(segments);
	}

	if (format === FILE_FORMAT.FOLDER) {
		return isInLocaleFolder(segments);
	}

	return format === FILE_FORMAT.NESTED || isNamedForLocale(segments) || isInLocaleFolder(segments);
}

/** Every supported file below `root` and every directory that could not be listed, in walk order. */
async function walkTranslationTree(root: string, options: Chki18nResolvedOptions): Promise<Slot[]> {
	const slots: Slot[] = [];
	const isExcludedFile = createFileExcluder(options.excludeFiles);
	const walk = walkFiles(root, {
		isExcludedDirectory: createPathExcluder(options.exclude),
		isWanted: ({ segments }) => {
			const name = segments[segments.length - 1];

			return SUPPORTED_EXTENSIONS.includes(extensionOf(name)) && !isExcludedFile(name);
		},
		onUnreadable: (directory) =>
			slots.push({
				issue: createIssue(CHECK_CODE.INVALID_FILE, {
					file: directory,
					message: `Failed to read the directory '${directory}'. It may not exist or read access may be denied.`
				})
			})
	});

	for await (const file of walk) {
		slots.push({ file });
	}

	return slots;
}

/** One file read and parsed, or the reason it could not be. */
async function readTranslationFile(
	{ path, segments }: WalkedFile,
	options: Chki18nResolvedOptions
): Promise<ScannedFile | Chki18nIssue> {
	const relativePath = segments.join('/');
	const readError = `Failed to read file '${relativePath}': `;
	let content: string;

	try {
		content = withoutByteOrderMark(await readFile(path, { encoding: 'utf-8' }));
	} catch {
		return createIssue(CHECK_CODE.INVALID_FILE, {
			file: path,
			message: `${readError}May be read access denied or invalid file format.`
		});
	}

	if (content.trim().length < 1) {
		return createIssue(CHECK_CODE.INVALID_FILE, {
			file: path,
			message: `${readError}File content is empty.`
		});
	}

	let json;

	try {
		json = JSON.parse(content);
	} catch {
		return createIssue(CHECK_CODE.INVALID_FILE, {
			file: path,
			message: `${readError}Content is not json format or parse failed due to an invalid character.`
		});
	}

	return {
		path,
		relativePath,
		segments,
		json,
		// Read off the text, because `JSON.parse` has already discarded it.
		duplicateKeys: options.enabledChecks.has(CHECK_CODE.DUPLICATE_KEY)
			? findDuplicateJsonKeys(content)
			: [],
		interpolation: detectInterpolationDelimiters(content)
	};
}

/**
 * Read the files of `slots` that `isWanted` asks for, several at a time. Each
 * result lands in its own slot, so whatever reads the slots afterwards meets
 * them in walk order, however the reads finished.
 */
async function readSlots(
	slots: Slot[],
	isWanted: (file: WalkedFile) => boolean,
	options: Chki18nResolvedOptions
): Promise<void> {
	const pending = slots.filter(
		(slot): slot is Extract<Slot, { file: WalkedFile }> =>
			'file' in slot && slot.read === undefined && isWanted(slot.file)
	);
	let next = 0;

	const worker = async (): Promise<void> => {
		while (next < pending.length) {
			const slot = pending[next];

			next += 1;
			slot.read = await readTranslationFile(slot.file, options);
		}
	};

	await Promise.all(Array.from({ length: Math.min(READ_CONCURRENCY, pending.length) }, worker));
}

const isRead = (file: ScannedFile | UnreadFile): file is ScannedFile => file.json !== undefined;

const isScanned = (read: ScannedFile | Chki18nIssue | undefined): read is ScannedFile =>
	read !== undefined && 'json' in read;

/**
 * Sort the files into comparable groups. A group is one set of files that hold
 * the same keys in different languages, so a project with several translation
 * files (`common.json`, `errors.json`) is compared file by file rather than as
 * one flat pile of keys.
 */
function buildGroups(
	files: (ScannedFile | UnreadFile)[],
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

		// Left unread because its path names no locale, so it belongs to none.
		if (!isRead(file)) {
			skipped.push(file.relativePath);
			continue;
		}

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
 * The delimiters the whole tree looks like it is written with.
 *
 * The files are read as one text rather than voted on: a project writing
 * `{{name}}` anywhere is a project whose delimiters are `{{` and `}}`, however
 * many of its other files happen to hold no placeholder at all. Files that
 * belong to no locale are left out — they are not this project's translations.
 */
function detectedInterpolationOf(
	files: ScannedFile[],
	skipped: string[]
): Chki18nDelimiters | null {
	const ignored = new Set(skipped);
	const seen = new Set<string>();

	for (const file of files) {
		if (file.interpolation && !ignored.has(file.relativePath)) {
			seen.add(file.interpolation.prefix);
		}
	}

	return INTERPOLATION_DELIMITERS.find((candidate) => seen.has(candidate.prefix)) ?? null;
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
	const slots = await walkTranslationTree(path, options);

	await readSlots(slots, ({ segments }) => mayHoldLocale(segments, options.format), options);

	const scannedOf = (): ScannedFile[] =>
		slots.flatMap((slot) => ('file' in slot && isScanned(slot.read) ? [slot.read] : []));
	let fileFormat =
		options.format === FILE_FORMAT.AUTO ? fileFormatOfPaths(scannedOf()) : options.format;

	if (fileFormat === null) {
		// No path names a locale, so only the files' content can tell whether
		// their top level keys do, as the `nested` layout writes them.
		await readSlots(slots, () => true, options);

		fileFormat = scannedOf().some((file) => nestedLocaleKeys(file.json).length > 0)
			? FILE_FORMAT.NESTED
			: FILE_FORMAT.SINGLE;
	}

	// The issues go out in walk order, whatever order the reads finished in.
	const entries: (ScannedFile | UnreadFile)[] = [];

	for (const slot of slots) {
		if ('issue' in slot) {
			issues.push(slot.issue);
		} else if (slot.read === undefined) {
			entries.push({
				path: slot.file.path,
				relativePath: slot.file.segments.join('/'),
				segments: slot.file.segments
			});
		} else if (isScanned(slot.read)) {
			entries.push(slot.read);
		} else {
			issues.push(slot.read);
		}
	}

	const built = buildGroups(entries, fileFormat, issues);

	if (built.files.length < 1) {
		issues.push(
			createIssue(CHECK_CODE.INVALID_FILE, {
				file: path,
				message: entries.length
					? `No translation file matching the \`${fileFormat}\` format was found in '${path}'. Check the \`format\` option.`
					: `No translation file was found in '${path}'.`
			})
		);
	}

	return {
		fileFormat,
		...built,
		detectedInterpolation: detectedInterpolationOf(entries.filter(isRead), built.skipped),
		issues
	};
}
