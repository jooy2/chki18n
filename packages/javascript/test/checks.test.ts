import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
	analyzeTranslations,
	CHECK_CODE,
	createAnalyzer,
	extractNumbers,
	extractTags,
	findInvisibleCharacter,
	hasTranslatableText,
	scriptOfLocale
} from '../dist/index.js';
import type { Chki18nCheckCode, Chki18nOptions, TranslationMap } from '../dist/index.js';

/** Written as escapes: a test file holding one of these is unreviewable. */
const ZERO_WIDTH_SPACE = '\u200b';

const NON_BREAKING_SPACE = '\u00a0';

/** Run one check on one pair of locales, which is what most of these need. */
const check = (
	code: Chki18nCheckCode,
	locales: { [locale: string]: TranslationMap },
	options: Chki18nOptions = {}
) =>
	analyzeTranslations({ locales }, { target: 'en', flattened: true, checks: [code], ...options })
		.issuesByCode[code] ?? [];

describe('NO_LOCALE', () => {
	it('finds the language a group is missing entirely', () => {
		const result = analyzeTranslations(
			{
				groups: {
					'common.json': {
						en: { title: 'Folder' },
						ko: { title: '폴더' },
						ja: { title: 'フォルダ' }
					},
					'errors.json': { en: { missing: 'Not found' }, ko: { missing: '없음' } }
				}
			},
			{ target: 'en', checks: [CHECK_CODE.NO_LOCALE] }
		);

		const issues = result.issuesByCode.NO_LOCALE ?? [];

		assert.strictEqual(issues.length, 1);
		assert.strictEqual(issues[0].locale, 'ja');
		assert.strictEqual(issues[0].group, 'errors.json');
		assert.strictEqual(issues[0].key, '');
		assert.strictEqual(result.success, false);
	});

	it('says nothing when every group has every language', () => {
		const result = analyzeTranslations(
			{
				groups: {
					a: { en: { x: 'X' }, ko: { x: 'ㄱ' } },
					b: { en: { y: 'Y' }, ko: { y: 'ㄴ' } }
				}
			},
			{ target: 'en', checks: [CHECK_CODE.NO_LOCALE] }
		);

		assert.strictEqual(result.issues.length, 0);
	});

	it('cannot fire on a single group, where every language is in it', () => {
		assert.strictEqual(check(CHECK_CODE.NO_LOCALE, { en: { a: 'A' }, ko: { a: 'ㄱ' } }).length, 0);
	});
});

describe('INTERPOLATION_COUNT', () => {
	it('finds a placeholder used fewer times than the target language uses it', () => {
		const issues = check(CHECK_CODE.INTERPOLATION_COUNT, {
			en: { a: '{name} invited {name}' },
			ko: { a: '{name}님이 초대했습니다' }
		});

		assert.strictEqual(issues.length, 1);
		assert.strictEqual(issues[0].interpolation, 'name');
		assert.ok(issues[0].message.includes('1 time here and 2 times'));
	});

	it('finds one used more times as well', () => {
		const issues = check(CHECK_CODE.INTERPOLATION_COUNT, {
			en: { a: 'Hello {name}' },
			ko: { a: '{name}님 안녕하세요 {name}님' }
		});

		assert.strictEqual(issues.length, 1);
	});

	it('leaves a placeholder that is simply absent to the other checks', () => {
		assert.strictEqual(
			check(CHECK_CODE.INTERPOLATION_COUNT, {
				en: { a: 'Hello {name}' },
				ko: { a: '안녕하세요' }
			}).length,
			0
		);
	});

	it('says nothing when the counts agree', () => {
		assert.strictEqual(
			check(CHECK_CODE.INTERPOLATION_COUNT, {
				en: { a: '{a} and {a} and {b}' },
				ko: { a: '{b}, {a}, {a}' }
			}).length,
			0
		);
	});
});

describe('TAG_MISMATCH', () => {
	it('reports every missing tag as one finding', () => {
		const issues = check(CHECK_CODE.TAG_MISMATCH, {
			en: { a: 'Click <b>here</b> to continue' },
			ko: { a: '계속하려면 여기를 누르세요' }
		});

		assert.strictEqual(issues.length, 1);
		assert.ok(issues[0].message.includes('`<b>` and `</b>`'));
	});

	it('reports a tag the target language does not have', () => {
		const issues = check(CHECK_CODE.TAG_MISMATCH, {
			en: { a: 'Plain text' },
			ko: { a: '<i>기울임</i>' }
		});

		assert.strictEqual(issues.length, 1);
		assert.ok(issues[0].message.includes('not in the target language'));
	});

	it('counts the tags rather than only looking for them', () => {
		const issues = check(CHECK_CODE.TAG_MISMATCH, {
			en: { a: '<b>one</b> and <b>two</b>' },
			ko: { a: '<b>하나</b>와 둘' }
		});

		assert.strictEqual(issues.length, 1);
		assert.ok(issues[0].message.includes('1 time of 2'));
	});

	it('reads a tag name whatever its case', () => {
		assert.strictEqual(
			check(CHECK_CODE.TAG_MISMATCH, { en: { a: '<B>Bold</B>' }, ko: { a: '<b>굵게</b>' } }).length,
			0
		);
	});

	it('does not mistake a comparison for markup', () => {
		assert.strictEqual(
			check(CHECK_CODE.TAG_MISMATCH, {
				en: { a: 'Use a < b to compare' },
				ko: { a: '비교하려면 a < b 를 쓰세요' }
			}).length,
			0
		);
	});
});

describe('UNTRANSLATED_SCRIPT', () => {
	it('finds a Korean value written without a Korean character', () => {
		const issues = check(CHECK_CODE.UNTRANSLATED_SCRIPT, {
			en: { a: 'Hello' },
			ko: { a: 'Hello!' }
		});

		assert.strictEqual(issues.length, 1);
		assert.strictEqual(issues[0].locale, 'ko');
	});

	it('leaves a value identical to the target to the untranslated check', () => {
		assert.strictEqual(
			check(CHECK_CODE.UNTRANSLATED_SCRIPT, { en: { a: 'Hello' }, ko: { a: 'Hello' } }).length,
			0
		);
	});

	it('says nothing about a language written in the Latin alphabet', () => {
		assert.strictEqual(
			check(CHECK_CODE.UNTRANSLATED_SCRIPT, { en: { a: 'Hello' }, fr: { a: 'Salut !' } }).length,
			0
		);
	});

	it('says nothing about a locale that names the Latin script itself', () => {
		assert.strictEqual(
			check(CHECK_CODE.UNTRANSLATED_SCRIPT, {
				en: { a: 'Hello' },
				'sr-Latn': { a: 'Zdravo' }
			}).length,
			0
		);
	});

	it('leaves a value that is only a placeholder or a number alone', () => {
		assert.strictEqual(
			check(CHECK_CODE.UNTRANSLATED_SCRIPT, {
				en: { a: '{count}', b: '2026' },
				ko: { a: '{count}', b: '2026' }
			}).length,
			0
		);
	});
});

describe('INCONSISTENT_VALUE', () => {
	it('finds two keys with one original translated two ways', () => {
		const issues = check(CHECK_CODE.INCONSISTENT_VALUE, {
			en: { 'save-a': 'Save', 'save-b': 'Save' },
			ko: { 'save-a': '저장', 'save-b': '보관' }
		});

		assert.strictEqual(issues.length, 1);
		assert.strictEqual(issues[0].key, 'save-b');
		assert.strictEqual(issues[0].relatedKey, 'save-a');
		assert.strictEqual(issues[0].locale, 'ko');
	});

	it('says nothing when the two agree', () => {
		assert.strictEqual(
			check(CHECK_CODE.INCONSISTENT_VALUE, {
				en: { a: 'Save', b: 'Save' },
				ko: { a: '저장', b: '저장' }
			}).length,
			0
		);
	});

	it('leaves a key the locale has not filled in to the other checks', () => {
		assert.strictEqual(
			check(CHECK_CODE.INCONSISTENT_VALUE, {
				en: { a: 'Save', b: 'Save' },
				ko: { a: '저장' }
			}).length,
			0
		);
	});
});

describe('INVISIBLE_CHARACTER', () => {
	it('finds a zero width space and names it', () => {
		const issues = check(CHECK_CODE.INVISIBLE_CHARACTER, {
			en: { a: 'Ready' },
			ko: { a: `준${ZERO_WIDTH_SPACE}비` }
		});

		assert.strictEqual(issues.length, 1);
		assert.ok(issues[0].message.includes('zero width space'));
		assert.ok(issues[0].message.includes('U+200B'));
	});

	it('finds a non-breaking space, which looks like an ordinary one', () => {
		assert.strictEqual(
			check(CHECK_CODE.INVISIBLE_CHARACTER, {
				en: { a: 'A B' },
				ko: { a: `가${NON_BREAKING_SPACE}나` }
			}).length,
			1
		);
	});

	it('says nothing about ordinary text', () => {
		assert.strictEqual(
			check(CHECK_CODE.INVISIBLE_CHARACTER, { en: { a: 'Ready' }, ko: { a: '준비됨' } }).length,
			0
		);
	});
});

describe('NUMBER_MISMATCH', () => {
	it('finds a number the translation changed', () => {
		const issues = check(CHECK_CODE.NUMBER_MISMATCH, {
			en: { a: 'You have 3 items' },
			ko: { a: '5개 있습니다' }
		});

		assert.strictEqual(issues.length, 1);
		assert.ok(issues[0].message.includes('uses 3'));
	});

	it('accepts numbers the translation reordered', () => {
		assert.strictEqual(
			check(CHECK_CODE.NUMBER_MISMATCH, {
				en: { a: '3 of 5' },
				ko: { a: '5 중 3' }
			}).length,
			0
		);
	});

	it('leaves a translation with no digits at all to `MISSING_NUMBER`', () => {
		assert.strictEqual(
			check(CHECK_CODE.NUMBER_MISMATCH, {
				en: { a: 'You have 3 items' },
				ko: { a: '여러 개 있습니다' }
			}).length,
			0
		);
	});

	it('tells a padded number from a bare one', () => {
		assert.strictEqual(
			check(CHECK_CODE.NUMBER_MISMATCH, { en: { a: 'Step 3' }, ko: { a: '03 단계' } }).length,
			1
		);
	});
});

describe('SUSPICIOUS_LENGTH', () => {
	const long = 'Please choose the folder you would like to upload';

	it('reports nothing until `lengthRatio` says what is too far', () => {
		assert.strictEqual(
			check(CHECK_CODE.SUSPICIOUS_LENGTH, { en: { a: long }, ko: { a: '폴더' } }).length,
			0
		);
	});

	it('finds a translation far shorter than its original', () => {
		const issues = check(
			CHECK_CODE.SUSPICIOUS_LENGTH,
			{ en: { a: long }, ko: { a: '폴더' } },
			{ lengthRatio: 3 }
		);

		assert.strictEqual(issues.length, 1);
		assert.strictEqual(issues[0].level, 'info');
	});

	it('finds one far longer as well', () => {
		assert.strictEqual(
			check(
				CHECK_CODE.SUSPICIOUS_LENGTH,
				{
					en: { a: 'Upload a file' },
					ko: { a: '파일을 하나 올리는 방법에 대한 아주 긴 설명입니다' }
				},
				{ lengthRatio: 2 }
			).length,
			1
		);
	});

	it('counts a wide character as two, so Korean is not short by default', () => {
		assert.strictEqual(
			check(
				CHECK_CODE.SUSPICIOUS_LENGTH,
				{ en: { a: 'Shared folder' }, ko: { a: '공유 폴더' } },
				{ lengthRatio: 2 }
			).length,
			0
		);
	});

	it('leaves a short original alone, where a ratio says nothing', () => {
		assert.strictEqual(
			check(
				CHECK_CODE.SUSPICIOUS_LENGTH,
				{ en: { a: 'OK' }, ko: { a: '확인했습니다' } },
				{ lengthRatio: 2 }
			).length,
			0
		);
	});
});

describe('KEY_NAMING', () => {
	const keys = (options: Chki18nOptions) =>
		check(CHECK_CODE.KEY_NAMING, { en: { 'attr-folder': 'A', badKey_Name: 'B' } }, options);

	it('reports nothing until `keyCase` says what the project uses', () => {
		assert.strictEqual(keys({}).length, 0);
	});

	it('finds the key that is not written in the chosen case', () => {
		const issues = keys({ keyCase: 'kebab' });

		assert.strictEqual(issues.length, 1);
		assert.strictEqual(issues[0].key, 'badKey_Name');
		assert.strictEqual(issues[0].locale, '');
	});

	it('judges every level of a nested key', () => {
		const issues = check(
			CHECK_CODE.KEY_NAMING,
			{ en: { 'attr.badName': 'A' } },
			{ keyCase: 'kebab' }
		);

		assert.strictEqual(issues.length, 1);
		assert.ok(issues[0].message.includes('`badName`'));
	});

	it('accepts the plural suffix an i18n library appends', () => {
		assert.strictEqual(
			check(CHECK_CODE.KEY_NAMING, { en: { 'item-count_one': 'A' } }, { keyCase: 'kebab' }).length,
			0
		);
	});

	it('reports a key once however many parts of it are wrong', () => {
		assert.strictEqual(
			check(CHECK_CODE.KEY_NAMING, { en: { 'Bad.Worse': 'A' } }, { keyCase: 'kebab' }).length,
			1
		);
	});

	it('accepts camel case when that is what was asked for', () => {
		assert.strictEqual(
			check(CHECK_CODE.KEY_NAMING, { en: { attrFolder: 'A' } }, { keyCase: 'camel' }).length,
			0
		);
	});
});

describe('KEY_DEPTH', () => {
	it('reports nothing until `maxKeyDepth` says how deep is too deep', () => {
		assert.strictEqual(check(CHECK_CODE.KEY_DEPTH, { en: { 'a.b.c.d': 'A' } }).length, 0);
	});

	it('finds the key nested past the limit', () => {
		const issues = check(
			CHECK_CODE.KEY_DEPTH,
			{ en: { 'a.b.c.d': 'A', 'a.b': 'B' } },
			{ maxKeyDepth: 2 }
		);

		assert.strictEqual(issues.length, 1);
		assert.strictEqual(issues[0].key, 'a.b.c.d');
		assert.ok(issues[0].message.includes('4 levels deep'));
	});
});

describe('checkEntry', () => {
	it('answers the checks a single key can answer', () => {
		const issues = createAnalyzer({ target: 'en', keyCase: 'kebab', maxKeyDepth: 1 }).checkEntry({
			key: 'badName',
			values: { en: '{a} and {a}', ko: '{a}' }
		});

		const codes = issues.map((issue) => issue.code);

		assert.ok(codes.includes(CHECK_CODE.KEY_NAMING));
		assert.ok(codes.includes(CHECK_CODE.INTERPOLATION_COUNT));
	});
});

describe('the value primitives', () => {
	it('reads markup tags as they were written', () => {
		assert.deepStrictEqual([...extractTags('a <b>c</b> <br/>')], ['<b>', '</b>', '<br/>']);
		assert.deepStrictEqual([...extractTags('no markup here')], []);
	});

	it('keeps a padded number apart from a bare one', () => {
		assert.deepStrictEqual([...extractNumbers('Step 03 of 5')], ['03', '5']);
	});

	it('finds the first character nothing will draw', () => {
		assert.strictEqual(findInvisibleCharacter(`ab${ZERO_WIDTH_SPACE}c`), ZERO_WIDTH_SPACE);
		assert.strictEqual(findInvisibleCharacter('plain'), null);
	});

	it('knows which script a language is written in', () => {
		assert.ok(scriptOfLocale('ko')?.test('가'));
		assert.ok(scriptOfLocale('ja-JP')?.test('あ'));
		assert.strictEqual(scriptOfLocale('en'), null);
		assert.strictEqual(scriptOfLocale('sr-Latn'), null);
	});

	it('does not count a placeholder or a tag as words of its own', () => {
		assert.strictEqual(hasTranslatableText('{name}', '{', '}'), false);
		assert.strictEqual(hasTranslatableText('<br/>', '{', '}'), false);
		assert.strictEqual(hasTranslatableText('Hi {name}', '{', '}'), true);
	});
});
