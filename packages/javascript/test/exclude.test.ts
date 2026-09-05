import assert from 'node:assert';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
	createFileExcluder,
	createPathExcluder,
	DEFAULT_EXCLUDE_FILES,
	findUnusedKeys,
	matchesNamePattern,
	pathSegments,
	resolveOptions,
	scanTranslationDirectory
} from '../dist/index.js';

const samplePath = join('test', 'samples', 'excluded-files');

const scan = (options?: Parameters<typeof resolveOptions>[0]) =>
	scanTranslationDirectory(samplePath, resolveOptions({ target: 'en', ...options }).options);

describe('pathSegments', () => {
	it('reads a path written either way', () => {
		assert.deepStrictEqual(pathSegments('src/legacy'), ['src', 'legacy']);
		assert.deepStrictEqual(pathSegments('src\\legacy'), ['src', 'legacy']);
	});

	it('drops what carries no meaning', () => {
		assert.deepStrictEqual(pathSegments('./src//legacy/'), ['src', 'legacy']);
		assert.deepStrictEqual(pathSegments(''), []);
	});
});

describe('matchesNamePattern', () => {
	it('matches a name with no wildcard exactly', () => {
		assert.strictEqual(matchesNamePattern('package.json', 'package.json'), true);
		assert.strictEqual(matchesNamePattern('my-package.json', 'package.json'), false);
	});

	it('lets `*` stand for any run of characters', () => {
		assert.strictEqual(matchesNamePattern('pnpm-lock.json', '*-lock.json'), true);
		assert.strictEqual(matchesNamePattern('tsconfig.build.json', 'tsconfig.*.json'), true);
		assert.strictEqual(matchesNamePattern('tsconfig.json', 'tsconfig.*.json'), false);
	});

	it('ignores case, the way the file systems these names come from do', () => {
		assert.strictEqual(matchesNamePattern('Package.json', 'package.json'), true);
	});

	it('does not let the ends of a pattern claim the same characters twice', () => {
		assert.strictEqual(matchesNamePattern('ab', 'a*b'), true);
		assert.strictEqual(matchesNamePattern('ab', 'a*b*b'), false);
	});
});

describe('createPathExcluder', () => {
	it('reads one segment as a name at any depth', () => {
		const excluded = createPathExcluder(['node_modules']);

		assert.strictEqual(excluded(['node_modules']), true);
		assert.strictEqual(excluded(['src', 'node_modules']), true);
		assert.strictEqual(excluded(['src']), false);
	});

	it('reads two segments as a path from the root', () => {
		const excluded = createPathExcluder(['src/legacy']);

		assert.strictEqual(excluded(['src', 'legacy']), true);
		assert.strictEqual(excluded(['src', 'legacy', 'ui']), true);
		assert.strictEqual(excluded(['legacy']), false);
		assert.strictEqual(excluded(['app', 'src', 'legacy']), false);
	});
});

describe('createFileExcluder', () => {
	it('answers for the default list', () => {
		const excluded = createFileExcluder(DEFAULT_EXCLUDE_FILES);

		assert.strictEqual(excluded('package-lock.json'), true);
		assert.strictEqual(excluded('tsconfig.base.json'), true);
		assert.strictEqual(excluded('vite.config.json'), true);
		assert.strictEqual(excluded('en.json'), false);
		assert.strictEqual(excluded('common.json'), false);
	});
});

describe('excludeFiles', () => {
	it('leaves a configuration file out of the scan entirely', async () => {
		const result = await scan();

		assert.deepStrictEqual(result.groups && Object.keys(result.groups), [
			'admin/common.json',
			'common.json'
		]);
		// Not merely skipped: an excluded file is never read, which is the point.
		assert.deepStrictEqual(result.skipped, []);
		assert.deepStrictEqual(result.issues, []);
	});

	it('reads what it was told to instead of the default list', async () => {
		const result = await scan({ excludeFiles: 'nothing-matches-this' });

		assert.ok(result.files.some((file) => file.relativePath === 'en/app.config.json'));
		assert.deepStrictEqual(result.skipped, ['package-lock.json', 'tsconfig.json']);
	});

	it('is reported on the resolved options', () => {
		const { options } = resolveOptions({ excludeFiles: '*.tmp.json, notes.json' });

		assert.deepStrictEqual([...options.excludeFiles], ['*.tmp.json', 'notes.json']);
	});
});

describe('exclude by path', () => {
	const filesOf = async (exclude: string[]) =>
		(await scan({ exclude })).files.map((file) => file.relativePath);

	it('skips one directory named by its path', async () => {
		assert.deepStrictEqual(await filesOf(['admin/ko']), [
			'admin/en/common.json',
			'en/common.json',
			'ko/common.json'
		]);
	});

	it('still skips a bare name wherever it appears', async () => {
		assert.deepStrictEqual(await filesOf(['ko']), ['admin/en/common.json', 'en/common.json']);
	});

	it('applies to the source scan as well', async () => {
		// A key nothing holds, so the walk cannot stop early and the count is the
		// number of files the excludes actually left it.
		const readOf = async (exclude: string[]) =>
			(
				await findUnusedKeys(
					samplePath,
					['nothing.at.all'],
					resolveOptions({ target: 'en', exclude }).options
				)
			).scannedFileCount;

		// Four translation files; the lock file, the `tsconfig.json` and the
		// `app.config.json` are excluded by name.
		assert.strictEqual(await readOf(['node_modules']), 4);
		assert.strictEqual(await readOf(['node_modules', 'admin/ko']), 3);
		assert.strictEqual(await readOf(['node_modules', 'ko']), 2);
	});
});
