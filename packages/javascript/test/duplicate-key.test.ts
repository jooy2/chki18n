import assert from 'node:assert';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
	analyzeTranslations,
	CHECK_CODE,
	checkTranslationFiles,
	createAnalyzer,
	findDuplicateKeys
} from '../dist/index.js';
import { findDuplicateJsonKeys } from '../dist/loader/jsonDuplicates.js';

const samplePath = (name: string) => join('test', 'samples', name);

describe('findDuplicateKeys', () => {
	it('finds a nested key colliding with a dotted one', () => {
		assert.deepStrictEqual(findDuplicateKeys({ a: { b: 1 }, 'a.b': 2 }), ['a.b']);
	});

	it('finds an array index colliding with a dotted key', () => {
		assert.deepStrictEqual(findDuplicateKeys({ a: ['x'], 'a.0': 'y' }), ['a.0']);
	});

	it('says nothing about translations that collide with nothing', () => {
		assert.deepStrictEqual(findDuplicateKeys({ a: { b: 1 }, c: 2 }), []);
		assert.deepStrictEqual(findDuplicateKeys({ a: {}, b: [] }), []);
	});

	it('treats an empty object as a leaf, the way flattening does', () => {
		assert.deepStrictEqual(findDuplicateKeys({ a: { b: {} }, 'a.b': 1 }), ['a.b']);
	});
});

describe('findDuplicateJsonKeys', () => {
	it('finds a key written twice in one object', () => {
		assert.deepStrictEqual(findDuplicateJsonKeys('{"a": 1, "a": 2}'), [{ path: 'a', line: 1 }]);
	});

	it('reports the line the second definition is on', () => {
		const [issue] = findDuplicateJsonKeys('{\n  "a": 1,\n\n  "a": 2\n}');

		assert.strictEqual(issue.line, 4);
	});

	it('reports the path of a nested duplicate', () => {
		assert.deepStrictEqual(findDuplicateJsonKeys('{"x": {"a": 1, "a": 2}}'), [
			{ path: 'x.a', line: 1 }
		]);
	});

	it('does not confuse the same key in two different objects', () => {
		assert.deepStrictEqual(findDuplicateJsonKeys('{"x": {"a": 1}, "y": {"a": 2}}'), []);
	});

	it('ignores strings that only look like keys', () => {
		assert.deepStrictEqual(findDuplicateJsonKeys('{"a": "b", "b": "b"}'), []);
		assert.deepStrictEqual(findDuplicateJsonKeys('{"a": ["k", "k"]}'), []);
	});

	it('reads escaped quotes as part of the string', () => {
		assert.deepStrictEqual(findDuplicateJsonKeys('{"a\\"b": 1, "c": 2}'), []);
		assert.deepStrictEqual(findDuplicateJsonKeys('{"a\\"b": 1, "a\\"b": 2}').length, 1);
	});
});

describe('DUPLICATE_KEY', () => {
	it('reports both a literal duplicate and a flatten collision', async () => {
		const result = await checkTranslationFiles(samplePath('locales-duplicate-key'), {
			target: 'en'
		});
		const issues = result.issuesByCode.DUPLICATE_KEY ?? [];

		assert.strictEqual(result.success, false);
		assert.deepStrictEqual(issues.map((issue) => issue.key).sort(), ['attr.folder', 'desc.hello']);
		assert.strictEqual(issues[0].level, 'error');
		assert.strictEqual(issues[0].locale, 'en');
		assert.ok(issues.some((issue) => issue.message.includes('line 4')));
	});

	it('strips the locale prefix in a nested file', async () => {
		const result = await checkTranslationFiles(samplePath('locales-nested-duplicate'), {
			target: 'en'
		});
		const [issue] = result.issuesByCode.DUPLICATE_KEY ?? [];

		assert.strictEqual(issue.key, 'greeting');
		assert.strictEqual(issue.locale, 'en');
	});

	it('finds a collision in translations passed in directly', () => {
		const result = analyzeTranslations(
			{ locales: { en: { a: { b: 'x' }, 'a.b': 'y' }, ko: { 'a.b': 'ㄱ' } } },
			{ target: 'en' }
		);

		assert.strictEqual(result.issuesByCode.DUPLICATE_KEY?.[0].key, 'a.b');
	});

	it('has nothing to find in input that is already flattened', () => {
		const result = analyzeTranslations(
			{ locales: { en: { 'a.b': 'x' }, ko: { 'a.b': 'ㄱ' } } },
			{ target: 'en', flattened: true }
		);

		assert.strictEqual(result.issuesByCode.DUPLICATE_KEY, undefined);
	});

	it('is never reported by checkEntry, which sees one key', () => {
		const issues = createAnalyzer({ target: 'en' }).checkEntry({
			key: 'a.b',
			values: { en: 'x', ko: 'ㄱ' }
		});

		assert.ok(issues.every((issue) => issue.code !== CHECK_CODE.DUPLICATE_KEY));
	});

	it('can be switched off like any other check', async () => {
		const result = await checkTranslationFiles(samplePath('locales-duplicate-key'), {
			target: 'en',
			ignoreChecks: 'DUPLICATE_KEY'
		});

		assert.strictEqual(result.issuesByCode.DUPLICATE_KEY, undefined);
		assert.strictEqual(result.success, true);
	});
});
