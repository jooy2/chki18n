import assert from 'assert';
import { describe, it } from 'node:test';
import { checkTranslationFiles } from '../dist';
import { joinFilePath } from 'qsu/node';
import { platform } from 'node:os';
import { join } from 'node:path';

const _isWindows = platform() === 'win32';
const _testDir = joinFilePath(_isWindows, 'test', 'samples').replace(/^\//g, '');

describe('base test', () => {
	it('all check success', async () => {
		const testPath = join(_testDir, 'locales-no-issue');
		const testResult = await checkTranslationFiles(testPath);

		assert.deepStrictEqual(testResult.success, true);
	});

	it('multiple translate files', async () => {
		const testPath = join(_testDir, 'multiple-translate-files');
		const testResult = await checkTranslationFiles(testPath);

		// TODO: support this
		assert.deepStrictEqual(testResult.success, false);
	});

	it('fail case: no key', async () => {
		const testPath = join(_testDir, 'locales-issue-no-key');
		const testResult = await checkTranslationFiles(testPath);

		assert.deepStrictEqual(testResult.success, false);
		assert.deepStrictEqual(Object.hasOwn(testResult.issues!, 'NO_KEY'), true);
		assert.deepStrictEqual(testResult.issues!.NO_KEY!.length, 1);
	});
});
