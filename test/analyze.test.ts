import assert from 'node:assert';
import { describe, it } from 'node:test';
import { analyzeTranslations, CHECK_CODE, createAnalyzer } from '../dist/index.js';

describe('analyzeTranslations', () => {
	it('flattens nested translations before comparing them', () => {
		const result = analyzeTranslations(
			{
				locales: {
					en: { desc: { hello: 'Hello', bye: 'Goodbye' } },
					ko: { desc: { hello: '안녕하세요' } }
				}
			},
			{ target: 'en' }
		);

		assert.strictEqual(result.keyCount, 2);
		assert.strictEqual(result.success, false);
		assert.strictEqual(result.issuesByCode.NO_KEY?.[0].key, 'desc.bye');
	});

	it('uses already flattened translations as they are', () => {
		const result = analyzeTranslations(
			{ locales: { en: { 'a.b': 'Hi' }, ko: { 'a.b': '' } } },
			{ target: 'en', flattened: true }
		);

		assert.strictEqual(result.keyCount, 1);
		assert.strictEqual(result.issuesByCode.EMPTY_VALUE?.length, 1);
	});

	it('does no file system work, so it reports no files', () => {
		const result = analyzeTranslations(
			{ locales: { en: { a: 'A' }, ko: { a: 'ㄱ' } } },
			{ target: 'en' }
		);

		assert.deepStrictEqual(result.files, []);
		assert.strictEqual(result.fileFormat, null);
	});

	it('compares each group on its own', () => {
		const result = analyzeTranslations(
			{
				groups: {
					'common.json': { en: { a: 'A' }, ko: { a: 'ㄱ' } },
					'errors.json': { en: { b: 'B' }, ko: {} }
				}
			},
			{ target: 'en' }
		);

		assert.deepStrictEqual(result.groups, ['common.json', 'errors.json']);
		assert.strictEqual(result.issuesByCode.NO_KEY?.length, 1);
		assert.strictEqual(result.issuesByCode.NO_KEY?.[0].group, 'errors.json');
	});

	it('honours custom interpolation delimiters', () => {
		const input = { locales: { en: { a: 'Hello {{name}}' }, ko: { a: '안녕하세요' } } };

		assert.strictEqual(
			analyzeTranslations(input, {
				target: 'en',
				interpolationPrefix: '{{',
				interpolationSuffix: '}}'
			}).issuesByCode.NO_INTERPOLATION_KEY?.length,
			1
		);

		// The default single-brace delimiters do not recognise `{{name}}`, so the
		// missing placeholder goes unnoticed.
		assert.strictEqual(
			analyzeTranslations(input, { target: 'en' }).issuesByCode.NO_INTERPOLATION_KEY,
			undefined
		);
	});

	it('skips the checks named by ignoreChecks', () => {
		const input = { locales: { en: { a: 'Same' }, ko: { a: 'Same' } } };

		assert.strictEqual(
			analyzeTranslations(input, { target: 'en' }).issuesByCode.NOT_TRANSLATED_VALUE?.length,
			1
		);
		assert.strictEqual(
			analyzeTranslations(input, {
				target: 'en',
				ignoreChecks: 'NOT_TRANSLATED_VALUE'
			}).issuesByCode.NOT_TRANSLATED_VALUE,
			undefined
		);
	});

	it('reports an unusable locale as an invalid file', () => {
		const result = analyzeTranslations(
			{ locales: { en: { a: 'A' }, ko: null as any } },
			{ target: 'en' }
		);

		assert.strictEqual(result.issuesByCode.INVALID_FILE?.length, 1);
	});
});

describe('createAnalyzer().checkEntry', () => {
	const analyzer = createAnalyzer({ target: 'en' });

	it('checks a single key across locales', () => {
		const issues = analyzer.checkEntry({
			key: 'greeting',
			values: { en: 'Hello {name}', ko: '안녕하세요' }
		});

		assert.strictEqual(issues.length, 1);
		assert.strictEqual(issues[0].code, CHECK_CODE.NO_INTERPOLATION_KEY);
		assert.strictEqual(issues[0].interpolation, 'name');
		assert.strictEqual(issues[0].key, 'greeting');
	});

	it('returns nothing for a key with no problem', () => {
		assert.deepStrictEqual(
			analyzer.checkEntry({ key: 'a', values: { en: 'Hello', ko: '안녕' } }),
			[]
		);
	});

	it('reports a missing locale when told which locales exist', () => {
		const issues = analyzer.checkEntry({
			key: 'a',
			values: { en: 'Hello' },
			locales: ['en', 'ko']
		});

		assert.strictEqual(issues.length, 1);
		assert.strictEqual(issues[0].code, CHECK_CODE.NO_KEY);
		assert.strictEqual(issues[0].locale, 'ko');
	});

	it('never reports checks that need more than one key', () => {
		const issues = analyzer.checkEntry({
			key: 'a',
			values: { en: 'Same', ko: 'Same' }
		});

		assert.ok(issues.every((issue) => issue.code !== CHECK_CODE.DUPLICATE_VALUE));
	});

	it('carries the group through to the issue', () => {
		const issues = analyzer.checkEntry({
			key: 'a',
			values: { en: 'Hello', ko: '' },
			group: 'common.json'
		});

		assert.strictEqual(issues[0].group, 'common.json');
	});

	it('agrees with a full analysis of the same data', () => {
		const locales: Record<string, Record<string, string>> = {
			en: { a: 'Hello {name}', b: 'Bye' },
			ko: { a: '안녕하세요', b: '' }
		};
		const analyzed = analyzeTranslations({ locales }, { target: 'en', flattened: true });
		const incremental = Object.keys(locales.en).flatMap((key) =>
			analyzer.checkEntry({ key, values: { en: locales.en[key], ko: locales.ko[key] } })
		);

		assert.deepStrictEqual(
			incremental.map((issue) => `${issue.code}:${issue.key}`),
			analyzed.issues.map((issue) => `${issue.code}:${issue.key}`)
		);
	});
});
