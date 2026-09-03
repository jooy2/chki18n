import assert from 'node:assert';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
	analyzeTranslations,
	checkTranslationFiles,
	findUnusedKeys,
	leafOfKey,
	loadTranslations,
	resolveOptions
} from '../dist/index.js';

const localesPath = join('test', 'samples', 'unused-key', 'locales');
const sourcePath = join('test', 'samples', 'unused-key', 'src');

describe('leafOfKey', () => {
	it('takes the last segment', () => {
		assert.strictEqual(leafOfKey('desc.hello'), 'hello');
		assert.strictEqual(leafOfKey('hello'), 'hello');
		assert.strictEqual(leafOfKey(''), '');
	});
});

describe('findUnusedKeys', () => {
	const { options } = resolveOptions({ target: 'en' });

	it('finds the key no source file mentions', async () => {
		const scan = await findUnusedKeys(
			sourcePath,
			['desc.hello', 'desc.orphan', 'attr.folder'],
			options
		);

		assert.deepStrictEqual(scan.unusedKeys, ['desc.orphan']);
		assert.strictEqual(scan.scannedFileCount, 1);
	});

	it('counts a key referenced by its leaf alone as used', async () => {
		// The source calls `t('folder')`, not `t('attr.folder')`.
		const scan = await findUnusedKeys(sourcePath, ['attr.folder'], options);

		assert.deepStrictEqual(scan.unusedKeys, []);
	});

	it('reports every key that shares an unreferenced leaf', async () => {
		const scan = await findUnusedKeys(sourcePath, ['a.orphan', 'b.orphan'], options);

		assert.deepStrictEqual(scan.unusedKeys.sort(), ['a.orphan', 'b.orphan']);
	});

	it('does not read the files it was told to skip', async () => {
		const scan = await findUnusedKeys(sourcePath, ['desc.hello'], options, [
			join(process.cwd(), sourcePath, 'app.ts')
		]);

		assert.deepStrictEqual(scan.unusedKeys, ['desc.hello']);
		assert.strictEqual(scan.scannedFileCount, 0);
	});

	it('returns nothing rather than failing on a missing directory', async () => {
		const scan = await findUnusedKeys(join(sourcePath, 'nope'), ['a'], options);

		assert.deepStrictEqual(scan.unusedKeys, ['a']);
		assert.strictEqual(scan.scannedFileCount, 0);
	});
});

describe('UNUSED_KEY', () => {
	it('reports a key nothing in the source refers to', async () => {
		const result = await checkTranslationFiles(localesPath, {
			target: 'en',
			source: sourcePath
		});
		const issues = result.issuesByCode.UNUSED_KEY ?? [];

		assert.strictEqual(issues.length, 1);
		assert.strictEqual(issues[0].key, 'desc.orphan');
		assert.strictEqual(issues[0].level, 'info');
		// A fact about the source tree, not about one language's translation.
		assert.strictEqual(issues[0].locale, '');
	});

	it('never fails a run on its own', async () => {
		const result = await checkTranslationFiles(localesPath, {
			target: 'en',
			source: sourcePath
		});

		assert.strictEqual(result.success, true);
		assert.strictEqual(result.summary.info > 0, true);
	});

	it('reports nothing without a source directory', async () => {
		const result = await checkTranslationFiles(localesPath, { target: 'en' });

		assert.strictEqual(result.issuesByCode.UNUSED_KEY, undefined);
	});

	it('does not count the translation files themselves as usages', async () => {
		// Every key appears verbatim in the file that defines it, so a scan that
		// read them would report nothing at all.
		const result = await checkTranslationFiles(localesPath, {
			target: 'en',
			source: join('test', 'samples', 'unused-key')
		});

		assert.strictEqual(result.issuesByCode.UNUSED_KEY?.length, 1);
	});

	it('accepts an answer worked out elsewhere', () => {
		const result = analyzeTranslations(
			{
				locales: { en: { a: 'A', b: 'B' }, ko: { a: 'ㄱ', b: 'ㄴ' } },
				unusedKeys: ['b']
			},
			{ target: 'en' }
		);

		assert.strictEqual(result.issuesByCode.UNUSED_KEY?.length, 1);
		assert.strictEqual(result.issuesByCode.UNUSED_KEY?.[0].key, 'b');
	});

	it('survives a session reload', async () => {
		const session = await loadTranslations(localesPath, {
			target: 'en',
			source: sourcePath
		});

		assert.strictEqual(session.analyze().issuesByCode.UNUSED_KEY?.length, 1);

		await session.reload();

		assert.strictEqual(session.analyze().issuesByCode.UNUSED_KEY?.length, 1);
	});

	it('can be switched off like any other check', async () => {
		const result = await checkTranslationFiles(localesPath, {
			target: 'en',
			source: sourcePath,
			ignoreChecks: 'UNUSED_KEY'
		});

		assert.strictEqual(result.issuesByCode.UNUSED_KEY, undefined);
	});
});
