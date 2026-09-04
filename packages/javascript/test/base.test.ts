import assert from 'node:assert';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { CHECK_CODE, checkTranslationFiles, FILE_FORMAT } from '../dist/index.js';

const samplePath = (name: string) => join('test', 'samples', name);

describe('checkTranslationFiles', () => {
	it('passes a directory with no critical issue', async () => {
		const result = await checkTranslationFiles(samplePath('locales-no-issue'));

		assert.strictEqual(result.success, true);
		assert.strictEqual(result.summary.error, 0);
		assert.strictEqual(result.fileFormat, FILE_FORMAT.SINGLE);
		assert.deepStrictEqual([...result.locales].sort(), ['en', 'ko']);
		assert.strictEqual(result.files.length, 2);
	});

	it('reports a key the target language has and another locale does not', async () => {
		const result = await checkTranslationFiles(samplePath('locales-issue-no-key'));

		assert.strictEqual(result.success, false);
		assert.strictEqual(result.issuesByCode.NO_KEY?.length, 1);

		const [issue] = result.issuesByCode.NO_KEY!;

		assert.strictEqual(issue.locale, 'ko');
		assert.strictEqual(issue.key, 'attr.folder');
		assert.strictEqual(issue.targetValue, 'Folder');
		assert.strictEqual(issue.level, 'error');
		assert.ok(issue.file?.endsWith('ko.json'));
	});

	it('reports what the target language got wrong in its own file', async () => {
		const result = await checkTranslationFiles(samplePath('locales-target-issue'));
		const codes = result.issues
			.filter((issue) => issue.locale === 'en')
			.map((issue) => issue.code)
			.sort();

		assert.deepStrictEqual(codes, [
			CHECK_CODE.EMPTY_VALUE,
			CHECK_CODE.INVALID_VALUE_TYPE,
			CHECK_CODE.INVISIBLE_CHARACTER,
			CHECK_CODE.SURROUNDING_WHITESPACE
		]);
		// None of them is an error, so a source language nobody had checked
		// before does not start failing the build the day this arrives.
		assert.strictEqual(result.success, true);
		assert.ok(result.issues.every((issue) => issue.locale === '' || issue.locale === 'en'));
	});

	it('compares a folder per locale layout', async () => {
		const result = await checkTranslationFiles(samplePath('multiple-translate-files'));

		assert.strictEqual(result.success, true);
		assert.strictEqual(result.fileFormat, FILE_FORMAT.FOLDER);
		assert.deepStrictEqual(result.groups, ['common.json']);
	});

	it('compares a single file holding every locale', async () => {
		const result = await checkTranslationFiles(samplePath('locales-nested'));

		assert.strictEqual(result.fileFormat, FILE_FORMAT.NESTED);
		assert.deepStrictEqual(result.groups, ['translation.json']);
		assert.strictEqual(result.issuesByCode.NO_KEY?.length, 1);
		assert.strictEqual(result.issuesByCode.NO_KEY?.[0].key, 'desc.bye');
	});

	it('reports every comparison check', async () => {
		const result = await checkTranslationFiles(samplePath('locales-all-issues'));
		const reported = Object.keys(result.issuesByCode);

		assert.strictEqual(result.success, false);

		for (const code of [
			CHECK_CODE.NO_KEY,
			CHECK_CODE.DUMMY_KEY,
			CHECK_CODE.EMPTY_VALUE,
			CHECK_CODE.NO_INTERPOLATION_KEY,
			CHECK_CODE.EXTRA_INTERPOLATION_KEY,
			CHECK_CODE.NOT_TRANSLATED_VALUE,
			CHECK_CODE.DUPLICATE_VALUE,
			CHECK_CODE.SURROUNDING_WHITESPACE,
			CHECK_CODE.MISSING_NUMBER,
			CHECK_CODE.INVALID_VALUE_TYPE
		]) {
			assert.ok(reported.includes(code), `${code} was not reported`);
		}
	});

	it('summarizes issues by level, locale and code', async () => {
		const result = await checkTranslationFiles(samplePath('locales-all-issues'));

		assert.strictEqual(result.summary.total, result.issues.length);
		assert.strictEqual(
			result.summary.error + result.summary.warn + result.summary.info,
			result.summary.total
		);
		assert.strictEqual(result.summary.byCode.NO_KEY, 1);
		assert.ok(result.summary.byLocale.ko.error > 0);
	});

	it('fails when no path is given', async () => {
		const result = await checkTranslationFiles();

		assert.strictEqual(result.success, false);
		assert.strictEqual(result.issues[0].code, CHECK_CODE.INVALID_OPTIONS);
		assert.strictEqual(result.issues[0].level, 'error');
	});

	it('fails when the target language is not among the files', async () => {
		const result = await checkTranslationFiles(samplePath('locales-no-issue'), { target: 'ja' });

		assert.strictEqual(result.success, false);
		assert.strictEqual(result.issuesByCode.INVALID_OPTIONS?.[0].level, 'error');
	});

	it('fails when a forced format matches no file', async () => {
		const result = await checkTranslationFiles(samplePath('locales-no-issue'), {
			format: FILE_FORMAT.FOLDER
		});

		assert.strictEqual(result.success, false);
		assert.strictEqual(result.issuesByCode.INVALID_FILE?.length, 1);
	});

	it('fails when the directory does not exist', async () => {
		const result = await checkTranslationFiles(samplePath('does-not-exist'));

		assert.strictEqual(result.success, false);
		assert.ok(result.issuesByCode.INVALID_FILE!.length > 0);
	});

	it('only runs the checks it was asked for', async () => {
		const result = await checkTranslationFiles(samplePath('locales-all-issues'), {
			target: 'en',
			checks: [CHECK_CODE.NO_KEY]
		});

		assert.deepStrictEqual(Object.keys(result.issuesByCode), [CHECK_CODE.NO_KEY]);
	});
});
