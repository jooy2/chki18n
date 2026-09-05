/**
 * Builds `docs/<locale>/reference/changelog.md` from the package's own changelog.
 *
 * Each language the library ships for keeps the changelog its registry reads
 * from its own package root, so the file under `docs/` is a copy — and a copy
 * kept by hand is one more place to forget. It is read at build time instead.
 *
 * The output is generated, so it is git-ignored and Prettier-ignored. Run
 * through `npm run changelog`, which `npm run dev` and `npm run build` both do
 * first.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const docsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = resolve(docsDir, '..');

const LOCALES = ['en', 'ko'];

/**
 * Every package whose changelog belongs on the page.
 *
 * Each one is wrapped in the `::: lang` block for the language it is written
 * in, so a reader sees the changelog of the package they picked rather than
 * three of them stacked. `lang` is the id `docs/.vitepress/data/languages.ts`
 * gives that language.
 */
const PACKAGES = [
	{ dir: 'packages/javascript', lang: 'js', registry: 'npm', name: 'chki18n' },
	{ dir: 'packages/dart', lang: 'dart', registry: 'pub.dev', name: 'chki18n' },
	{ dir: 'packages/python', lang: 'py', registry: 'PyPI', name: 'chki18n' }
];

const STRINGS = {
	en: {
		title: 'Changelog',
		order: 3,
		lede: 'Every release of chki18n, newest first. Each package versions on its own, so a release on one side is not a release on the others.',
		source: (registry, name) => `Released as \`${name}\` on ${registry}.`
	},
	ko: {
		title: '변경 내역',
		order: 3,
		lede: 'chki18n의 모든 릴리스를 최신순으로 정리했습니다. 각 패키지는 독립적으로 버전을 관리하므로, 한쪽의 릴리스가 다른 쪽의 릴리스를 의미하지는 않습니다.',
		source: (registry, name) => `${registry}의 \`${name}\` 패키지입니다.`
	}
};

/** The changelog body, with its own `# Changelog` heading dropped. */
async function bodyOf(dir) {
	const source = await readFile(resolve(rootDir, dir, 'CHANGELOG.md'), 'utf8');

	return source.replace(/^#\s+.*\r?\n/, '').trim();
}

async function main() {
	const bodies = await Promise.all(PACKAGES.map((pkg) => bodyOf(pkg.dir)));

	for (const locale of LOCALES) {
		const strings = STRINGS[locale];
		const sections = PACKAGES.map(
			(pkg, index) =>
				`::: lang ${pkg.lang}\n\n${strings.source(pkg.registry, pkg.name)}\n\n${bodies[index]}\n:::`
		);

		const page = [
			'---',
			`title: ${strings.title}`,
			`order: ${strings.order}`,
			'---',
			'',
			`# ${strings.title}`,
			'',
			strings.lede,
			'',
			...sections,
			''
		].join('\n');

		const file = resolve(docsDir, locale, 'reference', 'changelog.md');

		await mkdir(dirname(file), { recursive: true });
		await writeFile(file, page, 'utf8');
	}
}

await main();
