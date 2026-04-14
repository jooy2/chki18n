import assert from 'assert';
import { describe, it } from 'node:test';
import { checkTranslationFiles } from '../dist';

describe('Chki18n: base', () => {
	it('check', async () => {
		assert.deepStrictEqual(await checkTranslationFiles('test/locales', {}), { success: true });
	});
});
