import { countsSentence, keyLabelOf, referenceOf, relativeTo, scopeSentence } from './text.js';
import type { Chki18nReportContext } from './context.js';
import type { Chki18nLevel } from '../_types/global.js';

/** What GitHub calls each of our severities. */
const ANNOTATION: Record<Chki18nLevel, string> = {
	error: 'error',
	warn: 'warning',
	info: 'notice'
};

/**
 * A workflow command ends at the first newline, and a literal `%` would be read
 * as the start of an escape, so both have to be encoded before they are written.
 */
const escapeData = (value: string): string =>
	value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

/** A property value additionally ends at a `,` and its name ends at a `:`. */
const escapeProperty = (value: string): string =>
	escapeData(value).replace(/:/g, '%3A').replace(/,/g, '%2C');

/**
 * A path GitHub can match against the repository, which means forward slashes
 * whatever the runner reports. An annotation carrying `locales\\ko.json` attaches
 * to nothing at all, silently, on a Windows runner.
 */
const annotationPath = (path: string): string => path.replace(/\\/g, '/');

/**
 * Workflow commands, one per issue, which GitHub Actions turns into annotations
 * on the files themselves — so a reviewer sees each finding on the line of the
 * pull request it belongs to rather than in a log nobody opens.
 *
 * There is no line number to give: the checks work on parsed translations, and
 * the commonest finding of all is a key that is not in the file to begin with.
 * An annotation without one attaches to the file, which is the right
 * granularity for a missing or mistranslated key anyway.
 */
export function formatGitHub(context: Chki18nReportContext): string {
	const { cwd, options, result, sections } = context;
	const lines = sections
		.flatMap((section) => section.issues)
		.map((issue) => {
			const properties = [
				issue.file && `file=${escapeProperty(annotationPath(relativeTo(issue.file, cwd)))}`,
				`title=${escapeProperty(`chki18n ${issue.code}`)}`
			]
				.filter(Boolean)
				.join(',');
			const reference = referenceOf(issue, result.target);
			const message = [
				[issue.locale, keyLabelOf(issue, context.showGroup)].filter(Boolean).join(' '),
				issue.message,
				reference && `(${reference})`
			]
				.filter(Boolean)
				.join(' ');

			return `::${ANNOTATION[issue.level]} ${properties}::${escapeData(message)}`;
		});

	if (!options.info) {
		return lines.join('\n');
	}

	// Plain text rather than a command: a run's totals belong in the log, not as
	// one more annotation for a reviewer to dismiss.
	return [...lines, `${countsSentence(result.summary)} ${scopeSentence(result)}`].join('\n');
}
