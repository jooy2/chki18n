import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { analyzeTranslations, CHECK_CODE, createAnalyzer } from '../dist/core/index.js';

const IMPORT_PATTERN = /(?:from|import)\s*["']([^"']+)["']/g;

const NODE_BUILTINS = ['assert', 'fs', 'os', 'path', 'url', 'util', 'process'];

/** Every module reachable from `entry` by following its relative imports. */
async function collectImports(
	entry: string,
	external: Set<string> = new Set()
): Promise<Set<string>> {
	const seen = new Set<string>();

	const walk = async (file: string): Promise<void> => {
		if (seen.has(file)) {
			return;
		}

		seen.add(file);

		const source = await readFile(file, { encoding: 'utf-8' });

		for (const [, specifier] of source.matchAll(IMPORT_PATTERN)) {
			if (specifier.startsWith('.')) {
				await walk(resolve(dirname(file), specifier));
				continue;
			}

			external.add(specifier);
		}
	};

	await walk(entry);

	return external;
}

describe('chki18n/core', () => {
	it('reaches no Node built-in, so it can run outside Node', async () => {
		const external = await collectImports('dist/core/index.js');

		for (const specifier of external) {
			assert.ok(
				!specifier.startsWith('node:') && !NODE_BUILTINS.includes(specifier),
				`the core entry imports \`${specifier}\``
			);
		}
	});

	it('exports the analysis API', () => {
		const result = analyzeTranslations(
			{ locales: { en: { a: 'Hello {name}' }, ko: { a: '안녕하세요' } } },
			{ target: 'en' }
		);

		assert.strictEqual(result.issuesByCode.NO_INTERPOLATION_KEY?.length, 1);
		assert.strictEqual(
			createAnalyzer({ target: 'en' }).checkEntry({
				key: 'a',
				values: { en: 'Hello', ko: '' }
			})[0].code,
			CHECK_CODE.EMPTY_VALUE
		);
	});
});

describe('level overrides', () => {
	it('re-grades a check and changes whether the run passes', () => {
		const input = { locales: { en: { a: 'Hello' }, ko: { a: '' } } };

		assert.strictEqual(analyzeTranslations(input, { target: 'en' }).success, true);
		assert.strictEqual(
			analyzeTranslations(input, { target: 'en', levels: { EMPTY_VALUE: 'error' } }).success,
			false
		);
	});

	it('accepts the CLI form of the same override', () => {
		const input = { locales: { en: { a: 'Hello' }, ko: { a: '' } } };
		const result = analyzeTranslations(input, { target: 'en', levels: 'EMPTY_VALUE=error' });

		assert.strictEqual(result.issuesByCode.EMPTY_VALUE?.[0].level, 'error');
	});

	it('applies to a single key check as well', () => {
		const analyzer = createAnalyzer({ target: 'en', levels: { EMPTY_VALUE: 'info' } });

		assert.strictEqual(
			analyzer.checkEntry({ key: 'a', values: { en: 'Hello', ko: '' } })[0].level,
			'info'
		);
	});

	it('refuses to re-grade a check that reports how the run went', () => {
		const { options, optionIssues } = createAnalyzer({ levels: { INVALID_FILE: 'info' } });

		assert.strictEqual(options.levels, null);
		assert.ok(optionIssues.some((issue) => issue.message.includes('INVALID_FILE')));
	});
});
