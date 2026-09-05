import assert from 'node:assert';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
	detectInterpolationDelimiters,
	INTERPOLATION_DELIMITERS,
	loadTranslations
} from '../dist/index.js';

describe('detectInterpolationDelimiters', () => {
	it('reads each pair it knows', () => {
		assert.deepStrictEqual(detectInterpolationDelimiters('Hello {name}'), {
			prefix: '{',
			suffix: '}'
		});
		assert.deepStrictEqual(detectInterpolationDelimiters('Hello [[name]]'), {
			prefix: '[[',
			suffix: ']]'
		});
		assert.deepStrictEqual(detectInterpolationDelimiters('Hello ((name))'), {
			prefix: '((',
			suffix: '))'
		});
		assert.deepStrictEqual(detectInterpolationDelimiters('Hello <name>'), {
			prefix: '<',
			suffix: '>'
		});
	});

	it('reads a doubled pair as itself, not as its single form', () => {
		assert.deepStrictEqual(detectInterpolationDelimiters('Hello {{name}}'), {
			prefix: '{{',
			suffix: '}}'
		});
	});

	it('allows the spacing a style may put inside the delimiters', () => {
		assert.deepStrictEqual(detectInterpolationDelimiters('Hello {{ name }}'), {
			prefix: '{{',
			suffix: '}}'
		});
	});

	it('is not fooled by the punctuation of the JSON holding the text', () => {
		assert.strictEqual(detectInterpolationDelimiters('{"desc":{"hello":"Hello"}}'), null);
		assert.strictEqual(detectInterpolationDelimiters('{\n\t"list": ["a", "b"]\n}'), null);
	});

	it('answers with the first pair it believes when a text mixes two', () => {
		assert.deepStrictEqual(detectInterpolationDelimiters('{{a}} and [[b]]'), {
			prefix: '{{',
			suffix: '}}'
		});
	});

	it('has nothing to say about a text with no placeholder', () => {
		assert.strictEqual(detectInterpolationDelimiters('Hello there'), null);
		assert.strictEqual(detectInterpolationDelimiters(''), null);
	});

	it('answers with one of the pairs it publishes', () => {
		const found = detectInterpolationDelimiters('Hello {name}');

		assert.ok(
			INTERPOLATION_DELIMITERS.some(
				(pair) => pair.prefix === found?.prefix && pair.suffix === found?.suffix
			)
		);
	});
});

describe('the delimiters a scan saw', () => {
	it('reports what the files it read are written with', async () => {
		const session = await loadTranslations(join('test', 'samples', 'locales-no-issue'));

		assert.deepStrictEqual(session.detectedInterpolation, { prefix: '{', suffix: '}' });
		// A guess about the files, not the setting the checks ran with.
		assert.strictEqual(session.options.interpolationPrefix, '{');
	});

	it('says nothing about files that hold no placeholder', async () => {
		const session = await loadTranslations(join('test', 'samples', 'excluded-files'));

		assert.strictEqual(session.detectedInterpolation, null);
	});

	it('says nothing when there was no directory to read', async () => {
		const session = await loadTranslations();

		assert.strictEqual(session.detectedInterpolation, null);
	});
});
