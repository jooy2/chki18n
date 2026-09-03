import assert from 'node:assert';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
	analyzeTranslations,
	CHECK_CODE,
	checkTranslationFiles,
	findUnusedKeys,
	resolveOptions
} from '../dist/index.js';

const localesPath = join('test', 'samples', 'undefined-key', 'locales');

const sourcePath = join('test', 'samples', 'undefined-key', 'src');

const KEYS = ['desc.hello', 'attr.folder', 'item_one', 'item_other'];

const scan = (options = {}) =>
	findUnusedKeys(sourcePath, KEYS, resolveOptions({ target: 'en', ...options }).options);

describe('findUnusedKeys, on the keys the source asks for', () => {
	it('reports a key no language file defines', async () => {
		const { undefinedKeys } = await scan();

		assert.deepStrictEqual(
			undefinedKeys.map((usage) => usage.key),
			['attr.missing']
		);
		assert.ok(undefinedKeys[0].file?.endsWith('app.ts'));
	});

	it('reads a key through the namespace written in front of it', async () => {
		const { undefinedKeys } = await scan();

		// `t('common:desc.hello')` names a namespace and a key that does exist.
		assert.strictEqual(
			undefinedKeys.some((usage) => usage.key.includes('common')),
			false
		);
	});

	it('leaves a key built at run time alone', async () => {
		const { undefinedKeys } = await scan();

		assert.strictEqual(
			undefinedKeys.some((usage) => usage.key.startsWith('error.')),
			false
		);
	});

	it('counts a key reached through a prefix as defined', async () => {
		const { undefinedKeys } = await scan();

		// `t('folder')` resolves to `attr.folder` through a bound prefix.
		assert.strictEqual(
			undefinedKeys.some((usage) => usage.key === 'folder'),
			false
		);
	});

	it('counts a plural key asked for by its base as defined', async () => {
		const { undefinedKeys, unusedKeys } = await scan();

		// The source writes `t('item')`; the runtime picks `item_one`.
		assert.strictEqual(
			undefinedKeys.some((usage) => usage.key === 'item'),
			false
		);
		assert.deepStrictEqual(unusedKeys, []);
	});

	it('reads the call names the project actually uses', async () => {
		const { undefinedKeys } = await scan({ translateFunctions: ['nothing'] });

		assert.deepStrictEqual(undefinedKeys, []);
	});

	it('does the work only for the check that needs it', async () => {
		const { undefinedKeys } = await scan({ ignoreChecks: [CHECK_CODE.UNDEFINED_KEY] });

		assert.deepStrictEqual(undefinedKeys, []);
	});
});

describe('UNDEFINED_KEY', () => {
	it('reports what the source asks for and the files do not have', async () => {
		const result = await checkTranslationFiles(localesPath, {
			target: 'en',
			source: sourcePath,
			checks: [CHECK_CODE.UNDEFINED_KEY]
		});

		assert.strictEqual(result.issuesByCode.UNDEFINED_KEY?.length, 1);
		assert.strictEqual(result.issuesByCode.UNDEFINED_KEY?.[0].key, 'attr.missing');
		// Not a locale's fault: no language file defines it.
		assert.strictEqual(result.issuesByCode.UNDEFINED_KEY?.[0].locale, '');
	});

	it('reports nothing without a source directory to read', async () => {
		const result = await checkTranslationFiles(localesPath, {
			target: 'en',
			checks: [CHECK_CODE.UNDEFINED_KEY]
		});

		assert.strictEqual(result.issues.length, 0);
	});

	it('accepts an answer worked out elsewhere', () => {
		const result = analyzeTranslations(
			{ locales: { en: { a: 'A' } }, undefinedKeys: [{ key: 'b.c', file: 'app.ts' }] },
			{ target: 'en', checks: [CHECK_CODE.UNDEFINED_KEY] }
		);

		assert.strictEqual(result.issuesByCode.UNDEFINED_KEY?.[0].key, 'b.c');
		assert.strictEqual(result.issuesByCode.UNDEFINED_KEY?.[0].file, 'app.ts');
	});

	it('never fails a run on its own', async () => {
		const result = await checkTranslationFiles(localesPath, {
			target: 'en',
			source: sourcePath,
			checks: [CHECK_CODE.UNDEFINED_KEY]
		});

		assert.strictEqual(result.success, true);
		assert.strictEqual(result.summary.warn, 1);
	});
});
