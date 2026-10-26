import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

/** Run the built command line with its output on a pipe, as a CI runner reads it. */
const runCli = (args: string[]): Promise<{ code: number | null; stdout: string }> =>
	new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [join('dist', 'cli.js'), ...args]);
		const chunks: Buffer[] = [];

		child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
		child.on('error', reject);
		child.on('close', (code) => resolve({ code, stdout: Buffer.concat(chunks).toString('utf8') }));
	});

describe('the command line', () => {
	let dir = '';

	before(async () => {
		dir = await mkdtemp(join(tmpdir(), 'chki18n-cli-'));

		const en: Record<string, string> = {};
		const ko: Record<string, string> = {};

		// Every Korean value is left untranslated, so the report is far larger
		// than the 64 KB a pipe holds at once.
		for (let index = 0; index < 3000; index += 1) {
			en[`group.key${index}`] = `Value number ${index}`;
			ko[`group.key${index}`] = `Value number ${index}`;
		}

		await writeFile(join(dir, 'en.json'), JSON.stringify(en));
		await writeFile(join(dir, 'ko.json'), JSON.stringify(ko));
	});

	after(() => rm(dir, { recursive: true, force: true }));

	it('writes the whole report into a pipe before it exits', async () => {
		const { code, stdout } = await runCli([dir, '--target', 'en', '--reporter', 'json']);
		const result = JSON.parse(stdout);

		assert.ok(stdout.length > 64 * 1024);
		assert.strictEqual(result.issuesByCode.NOT_TRANSLATED_VALUE.length, 3000);
		assert.strictEqual(code, 0);
	});

	it('exits with 1 when an error level issue was found', async () => {
		const { code } = await runCli([dir, '--target', 'fr', '--reporter', 'list']);

		assert.strictEqual(code, 1);
	});
});
