import assert from 'node:assert';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { CHECK_CODE, createSession, FILE_FORMAT, loadTranslations } from '../dist/index.js';

const samplePath = (name: string) => join('test', 'samples', name);

describe('loadTranslations', () => {
	it('scans once and holds what it read', async () => {
		const session = await loadTranslations(samplePath('locales-all-issues'), { target: 'en' });

		assert.deepStrictEqual([...session.locales].sort(), ['en', 'ko']);
		assert.deepStrictEqual(session.groups, ['']);
		assert.strictEqual(session.fileFormat, FILE_FORMAT.SINGLE);
		assert.strictEqual(session.files.length, 2);
		assert.strictEqual(session.get('en', 'greeting'), 'Hello {name}');
	});

	it('flattens on load, so keys are read in their dotted form', async () => {
		const session = await loadTranslations(samplePath('locales-no-issue'), { target: 'en' });

		assert.strictEqual(session.get('ko', 'attr.folder'), '폴더');
		assert.ok(session.keys().includes('desc.hello'));
	});

	it('analyses without reading the files again', async () => {
		const session = await loadTranslations(samplePath('locales-all-issues'), { target: 'en' });
		const first = session.analyze();
		const second = session.analyze();

		assert.strictEqual(first.success, false);
		assert.strictEqual(first.issues.length, second.issues.length);
		assert.strictEqual(first.fileFormat, FILE_FORMAT.SINGLE);
	});

	it('re-checks only the edited key and reports the new state', async () => {
		const session = await loadTranslations(samplePath('locales-all-issues'), { target: 'en' });

		assert.deepStrictEqual(
			session.checkKey('greeting').map((issue) => issue.code),
			[CHECK_CODE.NO_INTERPOLATION_KEY]
		);
		assert.deepStrictEqual(session.set('ko', 'greeting', '{name}님 안녕하세요'), []);
		assert.strictEqual(session.get('ko', 'greeting'), '{name}님 안녕하세요');
	});

	it('carries an edit into the next full analysis', async () => {
		const session = await loadTranslations(samplePath('locales-issue-no-key'), { target: 'en' });

		assert.strictEqual(session.analyze().issuesByCode.NO_KEY?.length, 1);

		session.set('ko', 'attr.folder', '폴더');

		assert.strictEqual(session.analyze().issuesByCode.NO_KEY, undefined);
	});

	it('drops a key from one locale or from all of them', async () => {
		const session = await loadTranslations(samplePath('locales-no-issue'), { target: 'en' });

		assert.deepStrictEqual(
			session.remove('attr.folder', { locale: 'ko' }).map((issue) => issue.code),
			[CHECK_CODE.NO_KEY]
		);

		session.remove('attr.folder');

		assert.strictEqual(session.get('en', 'attr.folder'), undefined);
		assert.deepStrictEqual(session.checkKey('attr.folder'), []);
	});

	it('reload throws away the edits and reads the directory again', async () => {
		const session = await loadTranslations(samplePath('locales-no-issue'), { target: 'en' });

		session.set('ko', 'attr.folder', 'edited');
		assert.strictEqual(session.get('ko', 'attr.folder'), 'edited');

		await session.reload();

		assert.strictEqual(session.get('ko', 'attr.folder'), '폴더');
	});

	it('reports a missing path instead of throwing', async () => {
		const session = await loadTranslations();

		assert.strictEqual(session.path, '');
		assert.strictEqual(session.analyze().success, false);
		assert.strictEqual(session.analyze().issues[0].code, CHECK_CODE.INVALID_OPTIONS);
	});
});

describe('createSession', () => {
	const groups = {
		'common.json': { en: { ok: 'OK' }, ko: { ok: '확인' } },
		'errors.json': { en: { failed: 'Failed' }, ko: {} }
	};

	it('takes translations that are already in memory', () => {
		const session = createSession({ groups }, { target: 'en' });

		assert.deepStrictEqual(session.groups, ['common.json', 'errors.json']);
		assert.strictEqual(session.analyze().issuesByCode.NO_KEY?.length, 1);
	});

	it('finds the group a key lives in, so simple calls need no group', () => {
		const session = createSession({ groups }, { target: 'en' });

		assert.strictEqual(session.get('ko', 'ok'), '확인');
		assert.strictEqual(session.get('en', 'failed'), 'Failed');
		assert.strictEqual(session.checkKey('failed')[0].group, 'errors.json');
	});

	it('writes into the named group', () => {
		const session = createSession({ groups: structuredClone(groups) }, { target: 'en' });

		session.set('ko', 'failed', '실패');

		assert.strictEqual(session.get('ko', 'failed'), '실패');
		assert.strictEqual(session.translations('errors.json').ko.failed, '실패');
		assert.strictEqual(session.analyze().issuesByCode.NO_KEY, undefined);
	});

	it('adds a locale that was not there before', () => {
		const session = createSession({ groups: structuredClone(groups) }, { target: 'en' });

		session.set('ja', 'ok', 'OK', 'common.json');

		assert.ok(session.locales.includes('ja'));
		assert.strictEqual(
			session.checkKey('ok', 'common.json')[0].code,
			CHECK_CODE.NOT_TRANSLATED_VALUE
		);
	});

	it('reset replaces the data but keeps the options', () => {
		const session = createSession({ groups }, { target: 'ko' });

		session.reset({ locales: { ko: { a: '가' }, en: { a: '가' } } });

		assert.deepStrictEqual(session.groups, ['']);
		assert.strictEqual(session.options.target, 'ko');
		assert.strictEqual(session.analyze().issuesByCode.NOT_TRANSLATED_VALUE?.length, 1);
	});
});
