import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import container from 'markdown-it-container';
import {
	defineConfig,
	type HeadConfig,
	type MarkdownRenderer,
	type SiteData,
	type TransformContext,
	type UserConfig
} from 'vitepress';
import { withI18n } from 'vitepress-i18n';
import type { VitePressI18nOptions } from 'vitepress-i18n/types';
import { generateSidebar } from 'vitepress-sidebar';
import type { VitePressSidebarOptions } from 'vitepress-sidebar/types';
import { CODE_LANGUAGE_HEAD_SCRIPT, CODE_LANGUAGE_IDS } from './data/languages';
import { writeLlmsFiles } from './llms';

const vitePressDir = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(vitePressDir, '..');
const rootDir = resolve(srcDir, '..');

const defaultLocale = 'en';
const supportLocales: string[] = [defaultLocale, 'ko'];

/**
 * The package, read off its own manifest rather than written out.
 *
 * The site's own URL is the package's `homepage`, so the canonical links, the
 * sitemap and the hostname the deploy writes into `CNAME` all come from one
 * line. A second copy of it here is one that can silently disagree.
 */
const npmPackage = JSON.parse(
	readFileSync(resolve(rootDir, 'packages/javascript/package.json'), 'utf8')
) as { name: string; version: string; homepage: string; repository: { url: string } };

/** The other two names, read off their own manifests for the same reason. */
const pubName =
	readFileSync(resolve(rootDir, 'packages/dart/pubspec.yaml'), 'utf8').match(
		/^name:\s*(\S+)/m
	)?.[1] ?? npmPackage.name;

const pypiName =
	readFileSync(resolve(rootDir, 'packages/python/pyproject.toml'), 'utf8').match(
		/^name\s*=\s*"([^"]+)"/m
	)?.[1] ?? npmPackage.name;

const siteUrl = npmPackage.homepage.replace(/\/+$/, '');
const repoUrl = npmPackage.repository.url.replace(/\.git$/, '');
const npmUrl = `https://www.npmjs.com/package/${npmPackage.name}`;
const pubUrl = `https://pub.dev/packages/${pubName}`;
const pypiUrl = `https://pypi.org/project/${pypiName}/`;
const editLinkPattern = `${repoUrl}/edit/main/docs/:path`;
const socialImage = `${siteUrl}/512x512.png`;

/**
 * Where each package is published, in the order the language switch lists them.
 *
 * The navbar renders these as one **Packages** dropdown rather than as three
 * social-link icons beside GitHub: a registry is one destination, and four icons
 * in a row read as a toolbar rather than as the places this site actually sends
 * a reader. `mark` is the logo the row is labelled with — the registry's own,
 * not the language's, because npm is not JavaScript — and `id` is the code
 * language it publishes. See `PackageLinks.vue`.
 */
const packageLinks = [
	{ id: 'js', registry: 'npm', mark: 'npm', url: npmUrl },
	{ id: 'dart', registry: 'pub.dev', mark: 'pubdev', url: pubUrl },
	{ id: 'py', registry: 'PyPI', mark: 'pypi', url: pypiUrl }
];

/** `/` for the default locale, `/{lang}/` for every other one. */
const localeBase = (lang: string): string => (lang === defaultLocale ? '/' : `/${lang}/`);

/**
 * The order the sidebar lists things in, folders and files alike.
 *
 * The menu itself is generated from the folder tree by `vitepress-sidebar`,
 * which is what keeps it from drifting away from the pages that exist. What a
 * file tree cannot say is which page comes first, so that much is written out —
 * both locales hold the same file names, so one list orders both.
 */
const SIDEBAR_ORDER = [
	// Folders, in the order the sidebar shows them.
	'guide',
	'api',
	'reference',
	// Pages, in the order they appear inside their folder.
	'index.md',
	'getting-started.md',
	'cli.md',
	'ci.md',
	'file-layouts.md',
	'checks.md',
	'options.md',
	'check-translation-files.md',
	'analyze-translations.md',
	'load-translations.md',
	'create-analyzer.md',
	'core.md',
	'result.md',
	'changelog.md'
];

const sidebarOptionsFor = (lang: string): VitePressSidebarOptions => ({
	documentRootPath: '/',
	scanStartPath: lang,
	resolvePath: localeBase(lang),
	basePath: localeBase(lang),
	// Each folder's `index.md` names the group and is its landing page, which is
	// also how a Korean group heading is a Korean word rather than the folder's
	// English name.
	useTitleFromFrontmatter: true,
	useFolderTitleFromIndexFile: true,
	useFolderLinkFromIndexFile: true,
	// The home page is the site's front door, not a sidebar entry.
	includeRootIndexFile: false,
	manualSortFileNameByPriority: SIDEBAR_ORDER,
	collapsed: false
});

/** A sidebar entry, as much of one as the normaliser below reads. */
interface SidebarEntry {
	text?: string;
	link?: string;
	items?: SidebarEntry[];
}

/**
 * The generator's links, as URLs.
 *
 * It writes what it found on disk — `guide/index.md`, `guide/cli` — and two
 * things are wrong with the first of those as a link: the extension, and that
 * `/guide/index` is a second URL for a page whose canonical link is `/guide/`.
 * VitePress would resolve both, which is exactly why it is worth fixing here
 * rather than leaving two addresses for one page in the sitemap.
 */
function withUrlLinks(entries: SidebarEntry[], base: string): SidebarEntry[] {
	return entries.map((entry) => ({
		...entry,
		...(entry.link
			? {
					link: `${base}${entry.link
						.replace(/^\//, '')
						.replace(/(^|\/)index\.md$/, '$1')
						.replace(/\.md$/, '')}`
				}
			: {}),
		...(entry.items ? { items: withUrlLinks(entry.items, base) } : {})
	}));
}

/** The menu for one locale, generated from its folder tree. */
const sidebarFor = (lang: string): SidebarEntry[] =>
	withUrlLinks(generateSidebar(sidebarOptionsFor(lang)) as SidebarEntry[], localeBase(lang));

const navFor = (lang: string, labels: { guide: string; reference: string; packages: string }) => {
	const base = localeBase(lang);

	return [
		{ text: labels.guide, link: `${base}guide/` },
		{ text: 'API', link: `${base}api/` },
		{ text: labels.reference, link: `${base}reference/` },
		{
			text: labels.packages,
			items: [{ component: 'PackageLinks', props: { links: packageLinks } }]
		}
	];
};

/** The site's own sentence. Read twice: once by a crawler, once by `llms.txt`. */
const siteDescription =
	'Find the missing keys, the empty values and the broken interpolation in your i18n translation files. One check engine for the command line, for CI and for your own JavaScript — fast enough to lint as you type.';

const siteDescriptionKo =
	'i18n 번역 파일에서 누락된 키, 비어 있는 값, 어긋난 보간 키를 찾아냅니다. 커맨드라인과 CI, 그리고 직접 호출하는 JavaScript API가 같은 검사 엔진을 사용하며, 편집 중 실시간 검사에 쓸 수 있을 만큼 빠릅니다.';

const vitePressI18nConfig: VitePressI18nOptions = {
	locales: supportLocales,
	rootLocale: defaultLocale,
	searchProvider: 'local',
	description: {
		en: siteDescription,
		ko: siteDescriptionKo
	},
	themeConfig: {
		en: {
			nav: navFor('en', { guide: 'Guide', reference: 'Reference', packages: 'Packages' }),
			sidebar: { '/': { items: sidebarFor('en') } }
		},
		ko: {
			nav: navFor('ko', { guide: '가이드', reference: '레퍼런스', packages: '패키지' }),
			sidebar: { '/ko/': { items: sidebarFor('ko') } }
		}
	}
};

/* ---------------------------------------------------------------------------
 * Search engines
 *
 * Two things a documentation site gets wrong by default, and both of them are
 * per page rather than per site:
 *
 * - **Every page ships the same description.** VitePress falls back to the
 *   site's own whenever a page declares none, so every page carries one sentence
 *   between them and not one of them says what it is about. There is already a
 *   better sentence on nearly every page — the first paragraph under the title —
 *   so it is read out of the source.
 * - **Nothing says the two locales are the same page.** Without `hreflang` a
 *   crawler has no reason to connect `/guide/cli` to its Korean counterpart, and
 *   treats them as two documents competing for one query.
 * ------------------------------------------------------------------------- */

/** The BCP-47 tag the site itself declares for a locale — `en` → `en-US`. */
function langTagOf(siteData: SiteData, lang: string): string {
	return siteData.locales[lang === defaultLocale ? 'root' : lang]?.lang ?? lang;
}

/** `en/guide/cli.md` → `/guide/cli`. */
function pathOf(filePath: string): string {
	const [lang, ...rest] = filePath.split('/');
	const page = rest
		.join('/')
		.replace(/(^|\/)index\.md$/, '$1')
		.replace(/\.md$/, '');

	return `${localeBase(lang)}${page}`;
}

/** Everything below the locale folder — the part two locales have in common. */
function pageOf(filePath: string): string {
	return filePath.split('/').slice(1).join('/');
}

/** Inline Markdown and HTML dropped: a `<meta>` carries text and nothing else. */
function plainText(source: string): string {
	return source
		.replace(/<[^>]+>/g, ' ')
		.replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
		.replace(/[`*]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Cut at a word boundary, to about what a result page will show whole. */
function clamp(text: string, limit = 160): string {
	if (text.length <= limit) {
		return text;
	}

	const cut = text.slice(0, limit);
	const boundary = cut.lastIndexOf(' ');

	return `${(boundary > 0 ? cut.slice(0, boundary) : cut).trimEnd()}…`;
}

/**
 * A page's own one-line summary: its first paragraph of prose, which is written
 * to be exactly this. Not the title, not a fenced example, not a container.
 */
export function summaryOf(filePath: string): string | undefined {
	const file = resolve(srcDir, filePath);

	if (!existsSync(file)) {
		return undefined;
	}

	const source = readFileSync(file, 'utf8');

	for (const block of source.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').split(/\n\s*\n/)) {
		const trimmed = block.trim();

		if (!trimmed || /^[#<`:|>-]/.test(trimmed)) {
			continue;
		}

		const text = plainText(trimmed);

		if (text) {
			return clamp(text);
		}
	}

	return undefined;
}

/** The locales that actually have this page — a mirror is not a guarantee. */
function localesWith(filePath: string): string[] {
	const page = pageOf(filePath);

	return supportLocales.filter((lang) => existsSync(resolve(srcDir, lang, page)));
}

/** What the library is, for the one page in each locale that is about it. */
function structuredData(description: string, url: string) {
	return {
		'@context': 'https://schema.org',
		'@type': 'SoftwareSourceCode',
		name: 'chki18n',
		description,
		url,
		codeRepository: repoUrl,
		programmingLanguage: ['TypeScript', 'JavaScript'],
		license: 'https://opensource.org/licenses/MIT',
		author: { '@type': 'Organization', name: 'CDGet', url: 'https://cdget.com' },
		sameAs: [repoUrl, npmUrl]
	};
}

/**
 * The half of the metadata that is different on every page. Only runs at build
 * time — `transformPageData` is what the dev server sees — so the tags below are
 * checked by reading a built page, not the preview.
 */
function transformHead({ pageData, siteData, title, description }: TransformContext): HeadConfig[] {
	const { filePath } = pageData;

	// A dynamic route, or the built-in 404: no source file, so no canonical URL
	// and nothing to point an alternate at.
	if (!filePath) {
		return [];
	}

	const lang = filePath.split('/')[0];
	const url = `${siteUrl}${pathOf(filePath)}`;
	const translations = localesWith(filePath);

	// Open Graph writes a BCP-47 tag with an underscore in it, and nothing else.
	const ogLocale = (of: string) => langTagOf(siteData, of).replace('-', '_');

	const head: HeadConfig[] = [
		['link', { rel: 'canonical', href: url }],
		['meta', { property: 'og:url', content: url }],
		['meta', { property: 'og:title', content: title }],
		['meta', { property: 'og:description', content: description }],
		['meta', { property: 'og:locale', content: ogLocale(lang) }],
		['meta', { name: 'twitter:title', content: title }],
		['meta', { name: 'twitter:description', content: description }]
	];

	for (const other of translations) {
		head.push([
			'link',
			{
				rel: 'alternate',
				hreflang: langTagOf(siteData, other),
				href: `${siteUrl}${pathOf(`${other}/${pageOf(filePath)}`)}`
			}
		]);

		if (other !== lang) {
			head.push(['meta', { property: 'og:locale:alternate', content: ogLocale(other) }]);
		}
	}

	// Which one a crawler should serve to a reader it cannot place. The default
	// locale is the one that is served from `/`.
	if (translations.includes(defaultLocale)) {
		head.push([
			'link',
			{
				rel: 'alternate',
				hreflang: 'x-default',
				href: `${siteUrl}${pathOf(`${defaultLocale}/${pageOf(filePath)}`)}`
			}
		]);
	}

	if (pageData.frontmatter.layout === 'home') {
		head.push([
			'script',
			{ type: 'application/ld+json' },
			JSON.stringify(structuredData(description, url))
		]);
	}

	return head;
}

// Ref: https://vitepress.dev/reference/site-config
const vitePressConfig: UserConfig = {
	title: 'chki18n',
	lastUpdated: true,
	outDir: '../docs-dist',
	cleanUrls: true,
	metaChunk: true,
	/**
	 * The default locale is served from `/`, not from `/{lang}/`.
	 *
	 * This has to agree with two other things or every sidebar link 404s:
	 * `vitepress-i18n` puts the root locale in `locales.root` (no path prefix),
	 * and the sidebar options resolve their links against `/`. The rewrite is
	 * what actually moves `docs/{defaultLocale}/**` there. Every other locale
	 * keeps its folder as its prefix.
	 */
	rewrites: {
		[`${defaultLocale}/:rest*`]: ':rest*'
	},
	head: [
		// PNG first for anything modern, `favicon.ico` behind it for the browsers
		// and the Windows surfaces that still ask for one by that name.
		['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/logo-32.png' }],
		['link', { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/logo-16.png' }],
		['link', { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
		['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
		['meta', { name: 'theme-color', content: '#2080c8' }],
		// The half of the metadata that is the same on every page. The other half —
		// the canonical URL, the title, the description, the locale alternates — is
		// per page and lives in `transformHead`.
		['meta', { property: 'og:type', content: 'website' }],
		['meta', { property: 'og:site_name', content: 'chki18n' }],
		['meta', { property: 'og:image', content: socialImage }],
		['meta', { property: 'og:image:width', content: '512' }],
		['meta', { property: 'og:image:height', content: '512' }],
		['meta', { property: 'og:image:alt', content: 'chki18n' }],
		// `summary` and not `summary_large_image`: the image is a square mark, and a
		// wide card would letterbox it into a strip of background.
		['meta', { name: 'twitter:card', content: 'summary' }],
		['meta', { name: 'twitter:image', content: socialImage }],
		// Which package's third of every page is displayed, applied to `<html>`
		// before the first paint. See `data/languages.ts`.
		['script', {}, CODE_LANGUAGE_HEAD_SCRIPT]
	],
	sitemap: {
		hostname: siteUrl
	},
	/**
	 * The three files that are written rather than committed.
	 *
	 * `robots.txt` exists to name the sitemap, and the sitemap's own URL is
	 * already derived from the package manifest — a copy of that host sitting in
	 * `public/` would be one more place to forget when the site moves. `llms.txt`
	 * and `llms-full.txt` are generated for the same reason: see `llms.ts`.
	 */
	async buildEnd({ outDir }) {
		await writeFile(
			resolve(outDir, 'robots.txt'),
			`User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`
		);

		await writeLlmsFiles({
			outDir,
			srcDir,
			siteUrl,
			repoUrl,
			packages: packageLinks.map(({ registry, url }) => ({ registry, url })),
			description: siteDescription,
			summaryOf,
			sidebar: sidebarFor(defaultLocale),
			defaultLocale
		});
	},
	/**
	 * A description that is about this page rather than about the library. Runs in
	 * the dev server as well as in the build, which is what makes it the right
	 * place for the description — `transformHead` would have to repeat the
	 * fallback chain VitePress already applies to `pageData.description`.
	 */
	transformPageData(pageData) {
		if (!pageData.description && pageData.filePath) {
			pageData.description = summaryOf(pageData.filePath) ?? '';
		}
	},
	transformHead,
	/**
	 * `::: lang js` … `:::` — the block that only one package sees.
	 *
	 * Every package's block is in the document and CSS displays one of them,
	 * which is what makes the switch instant and what keeps the three halves from
	 * being three pages that drift apart. It also means the search index carries
	 * all of them, so a reader looking up `check_translation_files` finds the page
	 * whichever package they had selected.
	 */
	markdown: {
		config(md: MarkdownRenderer) {
			md.use(container, 'lang', {
				validate: (params: string) => /^lang(\s+\S+)+$/.test(params.trim()),
				render(tokens: { nesting: number; info: string }[], index: number) {
					const token = tokens[index];

					if (token.nesting !== 1) {
						return '</div>\n';
					}

					// `::: lang dart`, and `::: lang js dart` for a block two of them
					// want but the third would not.
					const wanted = token.info
						.trim()
						.split(/\s+/)
						.slice(1)
						.filter((id) => CODE_LANGUAGE_IDS.includes(id));

					return `<div class="chki18n-lang" data-lang="${wanted.join(' ')}">\n`;
				}
			});
		}
	},
	themeConfig: {
		logo: { src: '/logo-32.png', width: 24, height: 24 },
		/**
		 * `h2` and `h3`, nested. A reference page is one `h2` — Options — with a
		 * dozen `h3`s under it, and at the default depth the outline lists four
		 * words for a page that is ten screens long.
		 */
		outline: { level: [2, 3] },
		editLink: {
			pattern: editLinkPattern
		},
		/*
		 * The source, and only the source. npm used to sit here too, and with three
		 * registries to name it would have been three more icons in a corner that
		 * already holds the locale switch and the appearance toggle — they are in
		 * the navbar's Packages menu now, where each one gets a name instead of
		 * being a logo the reader has to recognise.
		 */
		socialLinks: [{ icon: 'github', link: repoUrl }],
		footer: {
			message: 'Released under the MIT License',
			copyright: '© <a href="https://cdget.com">CDGet</a>'
		}
	}
};

export default defineConfig(withI18n(vitePressConfig, vitePressI18nConfig));
