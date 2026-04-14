import assert from 'assert';
import { describe, it } from 'node:test';
import { check } from '../dist';

describe('Chki18n: base', () => {
	it('check', async () => {
		assert.deepStrictEqual(await check('test/locales', {}), { success: true });
	});
});
