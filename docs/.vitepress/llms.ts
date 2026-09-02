/**
 * `llms.txt` and `llms-full.txt`, written at build time rather than committed.
 *
 * The convention (llmstxt.org) asks for a short, link-shaped index of a site at
 * `/llms.txt`, with the whole thing flattened into one file beside it. Both are
 * **generated**, for the same reason `robots.txt` is: a hand-written index of a
 * documentation site is a second table of contents, and the second one is the
 * one that goes stale. The sidebar is already the site's menu — and it is itself
 * generated from the folder tree — so adding a page adds it here too, and there
 * is nothing to remember.
 *
 * Both files are **English**. Not a shortcut: llms.txt has no notion of locales,
 * and this site's Korean pages are translations of these ones rather than
 * different documents.
 */

import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export interface LlmsOptions {
	/** Where the built site is being written. */
	outDir: string;
	/** `docs/`, which the locale folders sit in. */
	srcDir: string;
	/** The site's own origin, with no trailing slash. */
	siteUrl: string;
	repoUrl: string;
	npmUrl: string;
	/** The site description, used as the file's one-line summary. */
	description: string;
	/** A page's first paragraph of prose — the same one the `<meta>` tags use. */
	summaryOf: (filePath: string) => string | undefined;
	/** The site's own menu, links already resolved to URLs. */
	sidebar: SidebarEntry[];
	defaultLocale: string;
}

/** A sidebar entry, as much of one as this file reads. */
export interface SidebarEntry {
	text?: string;
	link?: string;
	items?: SidebarEntry[];
}

/** `/guide/cli` → `en/guide/cli.md`; `/guide/` → `en/guide/index.md`. */
function sourceOf(link: string, locale: string): string {
	const path = link.replace(/^\//, '');

	return `${locale}/${path.endsWith('/') || path === '' ? `${path}index.md` : `${path}.md`}`;
}

/**
 * Every relative link made absolute, against the page it was written on.
 *
 * `[Options](./options)` resolves in a browser because the reader is standing
 * on a URL. Nobody reading `llms-full.txt` is standing anywhere.
 */
function absoluteLinks(markdown: string, pageUrl: string): string {
	return markdown.replace(/\]\((?!https?:|mailto:)([^)]+)\)/g, (whole, href: string) => {
		try {
			return `](${new URL(href, pageUrl).toString()})`;
		} catch {
			return whole;
		}
	});
}

/** One page, with the parts only a browser can show taken out. */
function flatten(markdown: string): string {
	return (
		markdown
			// Frontmatter is the page's metadata, not its content.
			.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
			// VitePress containers — the marker is chrome, the prose inside is not.
			.replace(/^:::\s*\w+(\s+.*)?$/gm, '')
			.replace(/^:::$/gm, '')
			.replace(/\n{3,}/g, '\n\n')
			.trim()
	);
}

const PREAMBLE = [
	'chki18n compares a set of i18n translation files against one target language and reports what',
	'is wrong with them: keys one locale is missing, values left empty, strings still identical to',
	'the original, interpolation placeholders that do not match, and seven more checks.',
	'',
	'It runs from the command line and from JavaScript, and both share one definition of every check',
	'and every option. The comparison itself does no file system work, so it also runs in a browser',
	'or an editor: `chki18n/core` is the same engine with the directory scanner left out.',
	'',
	'Every page below also exists in Korean at the same path under `/ko/`.'
].join('\n');

/**
 * The menu flattened into `llms.txt`'s one level of sections.
 *
 * A group that holds pages becomes a section; a group nested inside another is
 * named after both (`API: Utilities`) rather than losing either half.
 */
function sectionsOf(entries: SidebarEntry[], prefix = ''): [string, SidebarEntry[]][] {
	const sections: [string, SidebarEntry[]][] = [];

	for (const entry of entries) {
		if (!entry.items?.length) {
			continue;
		}

		const title = prefix ? `${prefix}: ${entry.text}` : (entry.text ?? '');
		// A group's own `index.md` is a page too — the one that introduces the
		// section — so it leads the section rather than being dropped for being
		// the thing the section is named after.
		const pages = [
			...(entry.link ? [{ text: entry.text, link: entry.link }] : []),
			...entry.items.filter((item) => item.link && !item.items?.length)
		];

		if (pages.length) {
			sections.push([title, pages]);
		}

		sections.push(...sectionsOf(entry.items, title));
	}

	return sections;
}

export async function writeLlmsFiles(options: LlmsOptions): Promise<void> {
	const { outDir, srcDir, siteUrl, repoUrl, npmUrl, description, summaryOf } = options;

	const index: string[] = ['# chki18n', '', `> ${description}`, '', PREAMBLE, ''];
	const full: string[] = [
		'# chki18n — full documentation',
		'',
		`> ${description}`,
		'',
		PREAMBLE,
		''
	];

	for (const [title, pages] of sectionsOf(options.sidebar)) {
		index.push(`## ${title}`, '');

		for (const page of pages) {
			const source = sourceOf(page.link!, options.defaultLocale);
			const url = `${siteUrl}${page.link}`;
			const summary = summaryOf(source);

			index.push(`- [${page.text}](${url})${summary ? `: ${summary}` : ''}`);

			const file = resolve(srcDir, source);

			if (existsSync(file)) {
				// The page keeps its own `#` heading; the source line goes under it,
				// which is where a reader of one of these files expects to find it.
				const body = absoluteLinks(flatten(readFileSync(file, 'utf8')), url);
				const [heading, ...rest] = body.split('\n');

				full.push('---', '', heading, '', `Source: ${url}`, '', rest.join('\n').trim(), '');
			}
		}

		index.push('');
	}

	index.push(
		'## Optional',
		'',
		`- [Full documentation as one file](${siteUrl}/llms-full.txt): every page above, concatenated.`,
		`- [Source repository](${repoUrl}): the packages and this site.`,
		`- [npm](${npmUrl}): the published JavaScript package.`,
		''
	);

	await writeFile(resolve(outDir, 'llms.txt'), `${index.join('\n').trimEnd()}\n`);
	await writeFile(resolve(outDir, 'llms-full.txt'), `${full.join('\n').trimEnd()}\n`);
}
