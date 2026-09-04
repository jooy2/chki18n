/**
 * Checks that every `::: lang` container on the site is one a reader can see.
 *
 * The container decides which third of a page is displayed, so a malformed one
 * does not fail anything: it renders for nobody and the page quietly loses a
 * paragraph. The two ways that happens are both mechanical, so they are checked
 * rather than watched for.
 *
 * A container's info string runs to the end of its line, and Prettier is
 * configured with `proseWrap: never` — so a paragraph written directly under an
 * opener is joined onto it and swallowed. `::: lang dart` becomes
 * `::: lang dart Dart takes all of them as one`, which matches no language.
 * Hence the blank line this insists on after every opener.
 *
 * The other way is a plain typo in the id. The list comes from
 * `data/languages.ts`, which is where a new language is added, so this file
 * needs no edit when one is.
 *
 * Run through `npm run check:lang`, which `npm run build` does before it builds.
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const docsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The content folders. Everything else under `docs/` is machinery. */
const LOCALES = ['en', 'ko'];

/** VitePress's own containers, which this check has no opinion about. */
const KNOWN_CONTAINERS = /^:::\s*(tip|info|warning|danger|details|raw|code-group)\b/;

/** The language ids, read from the one file that defines them. */
async function languageIds() {
	const source = await readFile(resolve(docsDir, '.vitepress/data/languages.ts'), 'utf8');
	const ids = [...source.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1]);

	if (ids.length === 0) {
		throw new Error('No language ids found in `data/languages.ts`. Has its shape changed?');
	}

	return new Set(ids);
}

/** Every Markdown file under a folder, in no particular order. */
async function markdownFiles(dir) {
	const files = [];

	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);

		if (entry.isDirectory()) files.push(...(await markdownFiles(path)));
		else if (entry.name.endsWith('.md')) files.push(path);
	}

	return files;
}

/** What is wrong with one file's containers, as a list of complaints. */
async function problemsIn(file, ids) {
	const lines = (await readFile(file, 'utf8')).split('\n');
	const at = (index) => `${relative(docsDir, file)}:${index + 1}`;
	const problems = [];
	const open = [];
	let fenced = false;

	lines.forEach((line, index) => {
		// A `:::` inside a code fence is being shown, not used.
		if (line.startsWith('```')) fenced = !fenced;
		if (fenced || !line.startsWith(':::')) return;

		if (/^:::\s*$/.test(line)) {
			if (open.length === 0) problems.push(`${at(index)} closes a container that was not opened`);
			else open.pop();

			return;
		}

		if (!/^:::\s*lang\b/.test(line)) {
			if (!KNOWN_CONTAINERS.test(line)) problems.push(`${at(index)} unknown container: ${line}`);

			open.push(index);

			return;
		}

		const named = line
			.replace(/^:::\s*lang\s*/, '')
			.trim()
			.split(/\s+/);
		const unknown = named.filter((id) => !ids.has(id));

		if (unknown.length > 0) {
			problems.push(
				`${at(index)} names ${unknown.map((id) => `\`${id}\``).join(', ')}, which is not a language.` +
					' A paragraph folded onto the opener looks exactly like this — leave a blank line after it.'
			);
		}

		if (lines[index + 1]?.trim() !== '') {
			problems.push(
				`${at(index)} has no blank line after it, so Prettier will fold the next line in`
			);
		}

		open.push(index);
	});

	for (const index of open) problems.push(`${at(index)} is never closed`);

	return problems;
}

async function main() {
	const ids = await languageIds();
	const files = (
		await Promise.all(LOCALES.map((locale) => markdownFiles(resolve(docsDir, locale))))
	)
		.flat()
		.sort();

	const problems = (await Promise.all(files.map((file) => problemsIn(file, ids)))).flat();

	if (problems.length > 0) {
		console.error(problems.join('\n'));
		console.error(`\n${problems.length} malformed container(s). Nothing above renders for anyone.`);
		process.exitCode = 1;

		return;
	}

	console.log(`Containers OK in ${files.length} pages (${[...ids].join(', ')}).`);
}

await main();
