import assert from 'node:assert';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
	buildResult,
	checkTranslationFiles,
	DEFAULT_GROUP_BY,
	DEFAULT_REPORTER,
	displayWidth,
	formatResult,
	GROUP_BY,
	groupIssues,
	padTo,
	REPORTER,
	reporterOfFileName,
	resolveOptions,
	truncate
} from '../dist/index.js';
import type { Chki18nOptions, Chki18nResult } from '../dist/index.js';

const samplePath = (name: string) => join('test', 'samples', name);

/** Somewhere outside the project, so a failed run leaves nothing behind in it. */
const outputDir = () => mkdtemp(join(tmpdir(), 'chki18n-report-'));

/** The sample every reporter is measured against: one of nearly every check. */
const analyze = (): Promise<Chki18nResult> =>
	checkTranslationFiles(samplePath('locales-all-issues'), { target: 'en' });

const render = (
	result: Chki18nResult,
	options: Chki18nOptions,
	init: { width?: number; cwd?: string } = {}
) => formatResult(result, resolveOptions({ target: 'en', color: false, ...options }).options, init);

const ANSI = new RegExp('\\u001b\\[');

describe('reporter options', () => {
	it('defaults to a grouped, coloured report and no file', () => {
		const { options } = resolveOptions();

		assert.strictEqual(options.reporter, DEFAULT_REPORTER);
		assert.strictEqual(options.groupBy, DEFAULT_GROUP_BY);
		assert.strictEqual(options.output, null);
		assert.strictEqual(options.outputReporter, null);
		assert.strictEqual(options.color, true);
	});

	it('falls back and says so when a reporter is not one it knows', () => {
		const { options, issues } = resolveOptions({ reporter: 'fancy' as never });

		assert.strictEqual(options.reporter, DEFAULT_REPORTER);
		assert.ok(issues.some((issue) => issue.message.includes('fancy')));
	});

	it('reads a reporter name whatever its case', () => {
		assert.strictEqual(
			resolveOptions({ reporter: 'JSON' as never }).options.reporter,
			REPORTER.JSON
		);
	});

	it('takes the file reporter from the extension', () => {
		assert.strictEqual(reporterOfFileName('report.json'), REPORTER.JSON);
		assert.strictEqual(reporterOfFileName('report.md'), REPORTER.MARKDOWN);
		assert.strictEqual(reporterOfFileName('report.txt'), DEFAULT_REPORTER);
		assert.strictEqual(reporterOfFileName('report'), DEFAULT_REPORTER);
	});

	it('lets an explicit reporter override what the extension implies', () => {
		const { options } = resolveOptions({ output: 'report.json', reporter: REPORTER.LIST });

		assert.strictEqual(options.outputReporter, REPORTER.LIST);
	});

	it('uses the extension when no reporter was named', () => {
		const { options } = resolveOptions({ output: 'report.md' });

		assert.strictEqual(options.reporter, DEFAULT_REPORTER);
		assert.strictEqual(options.outputReporter, REPORTER.MARKDOWN);
	});

	it('reads a width from a number or the string a flag gives it', () => {
		assert.strictEqual(resolveOptions({ width: 80 }).options.width, 80);
		assert.strictEqual(resolveOptions({ width: '80' }).options.width, 80);
	});

	it('measures the terminal instead when the width is not a column count', () => {
		for (const value of ['abc', 0, -10]) {
			const { options, issues } = resolveOptions({ width: value });

			assert.strictEqual(options.width, null);
			assert.ok(issues.some((issue) => issue.message.includes('not a usable `width`')));
		}
	});

	it('leaves the width unset when nothing asked for one', () => {
		assert.strictEqual(resolveOptions().options.width, null);
	});
});

describe('formatResult', () => {
	it('renders one section per locale by default', async () => {
		const report = render(await analyze(), {});

		assert.ok(report.includes(' ko '));
		assert.ok(report.includes('NO_KEY'));
		assert.ok(report.includes('only-en'));
		assert.ok(report.includes('FAIL'));
		// The locale nothing is wrong with is still worth naming.
		assert.ok(report.includes('Clean: en'));
	});

	it('renders one section per check when asked to', async () => {
		const report = render(await analyze(), { groupBy: GROUP_BY.CODE });

		assert.ok(report.includes(' NO_KEY '));
		assert.ok(report.includes('By locale'));
	});

	it('leaves out the colours when they are turned off', async () => {
		assert.strictEqual(ANSI.test(render(await analyze(), {})), false);
	});

	it('writes one line per issue as a list', async () => {
		const result = await analyze();
		const report = render(result, { reporter: REPORTER.LIST });
		const lines = report.split('\n').filter((line) => line.startsWith('ko'));

		assert.strictEqual(lines.length, result.issues.length);
		assert.ok(lines[0].includes('error'));
		assert.ok(lines[0].includes('NO_KEY'));
	});

	it('writes a table per section as Markdown', async () => {
		const report = render(await analyze(), { reporter: REPORTER.MARKDOWN });

		assert.ok(report.startsWith('# Translation check'));
		assert.ok(report.includes('## ko'));
		assert.ok(report.includes('| Level | Check'));
	});

	it('pads a Markdown table to one width, counting a wide character as two', async () => {
		const report = render(await analyze(), { reporter: REPORTER.MARKDOWN });
		const rows = report.split('\n').filter((line) => line.startsWith('|'));
		const widths = new Set(rows.map((row) => displayWidth(row)));

		// The sample holds a Korean value, so equal widths here can only come from
		// counting columns rather than characters.
		assert.ok(rows.some((row) => /[가-힣]/.test(row)));
		assert.strictEqual(widths.size, 1);
	});

	it('hands back the whole result as JSON, unfiltered', async () => {
		const result = await analyze();
		const parsed = JSON.parse(render(result, { reporter: REPORTER.JSON, warn: false }));

		assert.strictEqual(parsed.issues.length, result.issues.length);
		assert.deepStrictEqual(parsed.summary, result.summary);
	});

	it('drops the warnings, and their lines with them, on `no-warn`', async () => {
		const result = await analyze();
		const report = render(result, { warn: false });

		assert.strictEqual(report.includes('EMPTY_VALUE'), false);
		assert.ok(report.includes(`${result.summary.warn} issues not shown`));
		assert.ok(report.includes('NO_KEY'));
	});

	it('leaves out the heading block and the summary on `no-info`', async () => {
		const report = render(await analyze(), { info: false });

		assert.strictEqual(report.includes('Compared 11 keys'), false);
		assert.ok(report.includes('NO_KEY'));
	});

	it('lays the report out to the width it is given', async () => {
		const report = render(await analyze(), {}, { width: 60 });
		const rules = report.split('\n').filter((line) => line.includes('─'));

		assert.ok(rules.length > 0);

		for (const rule of rules) {
			assert.strictEqual(displayWidth(rule), 60);
		}
	});

	it('wraps a description rather than cutting it short', async () => {
		const report = render(await analyze(), {}, { width: 56 });

		assert.ok(report.includes('The key exists in the target language but is'));
		assert.strictEqual(report.includes('...'), false);
	});

	it('says so rather than printing nothing when a run is clean', async () => {
		const result = await checkTranslationFiles(samplePath('multiple-translate-files'), {
			target: 'en'
		});

		assert.ok(render(result, {}).includes('PASS'));
	});
});

describe('the GitHub reporter', () => {
	/** One issue, so a property can carry the characters a command breaks on. */
	const awkward = () =>
		buildResult(
			[
				{
					code: 'NO_KEY',
					level: 'error',
					locale: 'ko',
					key: 'attr.folder',
					group: '',
					targetValue: 'Folder',
					file: '/repo/lo,cales/ko.json',
					message: 'Missing: here, and there.'
				}
			],
			resolveOptions({ target: 'en' }).options,
			{ locales: ['en', 'ko'], groups: [''], keyCount: 1 }
		);

	it('writes one workflow command per issue', async () => {
		const result = await analyze();
		const report = render(result, { reporter: REPORTER.GITHUB }, { cwd: process.cwd() });
		const commands = report.split('\n').filter((line) => line.startsWith('::'));

		assert.strictEqual(commands.length, result.issues.length);
		assert.ok(commands[0].startsWith('::error '));
		assert.ok(commands[0].includes('title=chki18n NO_KEY'));
		// The path is relative to the working directory, which is what GitHub
		// resolves an annotation against.
		assert.ok(commands[0].includes('file=test/samples/locales-all-issues/ko.json'));
	});

	it('names each severity the way GitHub does', async () => {
		const report = render(await analyze(), { reporter: REPORTER.GITHUB });

		assert.ok(report.includes('::warning '));
		assert.strictEqual(report.includes('::warn '), false);
	});

	it('escapes what would otherwise end a command or a property', () => {
		const [command] = render(awkward(), { reporter: REPORTER.GITHUB }, { cwd: '/repo' }).split(
			'\n'
		);

		assert.ok(command.includes('file=lo%2Ccales/ko.json'));
		// The message keeps its punctuation; only a property value may not.
		assert.ok(command.includes('Missing: here, and there.'));
	});

	it('writes a path GitHub can match, whatever the runner calls a separator', () => {
		const onWindows = buildResult(
			[
				{
					code: 'NO_KEY',
					level: 'error',
					locale: 'ko',
					key: 'attr.folder',
					group: '',
					file: 'D:\\repo\\locales\\ko.json',
					message: 'Missing.'
				}
			],
			resolveOptions({ target: 'en' }).options,
			{ locales: ['en', 'ko'], groups: [''], keyCount: 1 }
		);
		const [command] = render(onWindows, { reporter: REPORTER.GITHUB }, { cwd: 'D:\\repo' }).split(
			'\n'
		);

		// GitHub matches an annotation against a repository path, which is always
		// written with forward slashes.
		assert.ok(command.includes('file=locales/ko.json'));
	});

	it('leaves out what the level options hid', async () => {
		const report = render(await analyze(), { reporter: REPORTER.GITHUB, warn: false });

		assert.strictEqual(report.includes('::warning '), false);
		assert.ok(report.includes('::error '));
	});
});

describe('groupIssues', () => {
	it('puts the sections that fail the run first', async () => {
		const result = await analyze();
		const sections = groupIssues(result.issues, GROUP_BY.CODE);

		assert.ok(sections.length > 1);
		assert.ok(sections[0].counts.error > 0);
		assert.strictEqual(
			sections.reduce((total, section) => total + section.issues.length, 0),
			result.issues.length
		);
	});

	it('collects what the axis cannot name into one section', () => {
		const sections = groupIssues(
			[{ code: 'INVALID_OPTIONS', level: 'warn', locale: '', key: '', group: '', message: 'bad' }],
			GROUP_BY.LOCALE
		);

		assert.strictEqual(sections[0].label, '(general)');
	});
});

describe('column arithmetic', () => {
	it('counts a Korean or Japanese character as two columns', () => {
		assert.strictEqual(displayWidth('abc'), 3);
		assert.strictEqual(displayWidth('한국어'), 6);
		assert.strictEqual(displayWidth('日本語'), 6);
	});

	it('pads to a column count rather than a character count', () => {
		assert.strictEqual(displayWidth(padTo('한국어', 10)), 10);
		assert.strictEqual(displayWidth(padTo('abc', 10)), 10);
	});

	it('cuts to a column count and marks the cut', () => {
		assert.strictEqual(truncate('abcdefghij', 5), 'ab...');
		assert.strictEqual(truncate('abc', 5), 'abc');
		assert.ok(displayWidth(truncate('한국어입니다', 7)) <= 7);
	});
});

describe('writing the report to a file', () => {
	it('creates the directory and writes what the extension asked for', async (t) => {
		const directory = await outputDir();

		t.after(() => rm(directory, { force: true, recursive: true }));

		const file = join(directory, 'nested', 'report.json');
		const result = await checkTranslationFiles(samplePath('locales-all-issues'), {
			target: 'en',
			output: file
		});
		const written = JSON.parse(await readFile(file, { encoding: 'utf-8' }));

		assert.strictEqual(written.summary.error, result.summary.error);
		assert.strictEqual(written.issues.length, result.issues.length);
	});

	it('never writes escape codes into a file', async (t) => {
		const directory = await outputDir();

		t.after(() => rm(directory, { force: true, recursive: true }));

		const file = join(directory, 'report.txt');

		await checkTranslationFiles(samplePath('locales-all-issues'), {
			target: 'en',
			output: file,
			color: true
		});

		assert.strictEqual(ANSI.test(await readFile(file, { encoding: 'utf-8' })), false);
	});

	it('fails the run when the report cannot be written', async () => {
		const result = await checkTranslationFiles(samplePath('locales-no-issue'), {
			target: 'en',
			// A path whose parent is a file cannot be created.
			output: join(samplePath('locales-no-issue'), 'en.json', 'report.txt')
		});

		assert.strictEqual(result.success, false);
		assert.ok(result.issues.some((issue) => issue.message.includes('could not be written')));
	});
});
