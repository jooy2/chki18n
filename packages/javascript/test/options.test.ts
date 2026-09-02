import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
	ANALYZE_CHECK_CODES,
	argsToOptions,
	buildUsageText,
	CHECK_CODE,
	DEFAULT_TARGET_LOCALE,
	FILE_FORMAT,
	OPTION_DEFINITIONS,
	resolveOptions
} from '../dist/index.js';

describe('resolveOptions', () => {
	it('fills in the defaults', () => {
		const { options } = resolveOptions();

		assert.strictEqual(options.target, DEFAULT_TARGET_LOCALE);
		assert.strictEqual(options.format, FILE_FORMAT.AUTO);
		assert.strictEqual(options.interpolationPrefix, '{');
		assert.strictEqual(options.enabledChecks.size, ANALYZE_CHECK_CODES.length);
	});

	it('does not treat a missing target as a fault', () => {
		const { issues } = resolveOptions();

		assert.strictEqual(issues.length, 1);
		assert.strictEqual(issues[0].level, 'info');
	});

	it('accepts a comma separated list of check codes', () => {
		const { options } = resolveOptions({ checks: 'NO_KEY, EMPTY_VALUE' });

		assert.deepStrictEqual([...options.enabledChecks], [CHECK_CODE.NO_KEY, CHECK_CODE.EMPTY_VALUE]);
	});

	it('removes the ignored checks from the full set', () => {
		const { options } = resolveOptions({ ignoreChecks: ['DUPLICATE_VALUE'] });

		assert.strictEqual(options.enabledChecks.has(CHECK_CODE.DUPLICATE_VALUE), false);
		assert.strictEqual(options.enabledChecks.size, ANALYZE_CHECK_CODES.length - 1);
	});

	it('reports an unknown check code and keeps going', () => {
		const { options, issues } = resolveOptions({ checks: 'NO_KEY,NOPE' });

		assert.deepStrictEqual([...options.enabledChecks], [CHECK_CODE.NO_KEY]);
		assert.ok(issues.some((issue) => issue.message.includes('NOPE')));
	});

	it('refuses to combine checks with ignoreChecks', () => {
		const { options, issues } = resolveOptions({
			checks: 'NO_KEY',
			ignoreChecks: 'EMPTY_VALUE'
		});

		assert.deepStrictEqual([...options.enabledChecks], [CHECK_CODE.NO_KEY]);
		assert.ok(issues.some((issue) => issue.message.includes('ignoreChecks')));
	});

	it('falls back to auto for an unknown format', () => {
		const { options, issues } = resolveOptions({ format: 'nope' as never });

		assert.strictEqual(options.format, FILE_FORMAT.AUTO);
		assert.ok(issues.some((issue) => issue.message.includes('nope')));
	});
});

describe('argsToOptions', () => {
	it('maps every CLI flag onto its option', () => {
		const options = argsToOptions({
			_: [],
			path: 'locales',
			target: 'ko',
			format: 'folder',
			'ignore-checks': 'NO_KEY',
			'interpolation-prefix': '{{',
			'interpolation-suffix': '}}',
			exclude: 'tmp',
			warn: false,
			debug: true
		});

		assert.deepStrictEqual(options, {
			path: 'locales',
			target: 'ko',
			format: 'folder',
			ignoreChecks: 'NO_KEY',
			interpolationPrefix: '{{',
			interpolationSuffix: '}}',
			exclude: 'tmp',
			warn: false,
			debug: true
		});
	});

	it('reads a bare positional argument as the path', () => {
		assert.strictEqual(argsToOptions({ _: ['locales'] }).path, 'locales');
	});

	it('prefers an explicit path over the positional argument', () => {
		assert.strictEqual(argsToOptions({ _: ['ignored'], path: 'locales' }).path, 'locales');
	});

	it('resolves the CLI form of an option exactly like the API form', () => {
		const fromCli = resolveOptions(
			argsToOptions({ _: [], target: 'ko', 'ignore-checks': 'NO_KEY' })
		);
		const fromApi = resolveOptions({ target: 'ko', ignoreChecks: ['NO_KEY'] });

		assert.deepStrictEqual(fromCli.options, fromApi.options);
	});
});

describe('buildUsageText', () => {
	it('documents every option', () => {
		const usage = buildUsageText('chki18n');

		for (const definition of OPTION_DEFINITIONS) {
			assert.ok(usage.includes(`--${definition.flag}`), `${definition.flag} is undocumented`);
		}
	});
});
