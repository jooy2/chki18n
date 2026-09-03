import chalk from 'chalk';
import type { Chki18nResolvedOptions } from './_types/global.js';

export type Chki18nLogger = {
	/** Write one diagnostic line. */
	debug: (message: string) => void;
};

const noop = () => {};

/** A logger that writes nothing. What the library uses unless asked to speak. */
export const silentLogger: Chki18nLogger = { debug: noop };

/**
 * Diagnostics for the CLI, and only diagnostics: the findings are rendered by
 * the reporter, in whichever shape was asked for. They go to standard error so
 * that a report piped out of standard output stays parseable with `--debug` on.
 */
export function createLogger(options: Chki18nResolvedOptions): Chki18nLogger {
	if (!options.debug) {
		return silentLogger;
	}

	const label = options.color
		? `${chalk.bgBlueBright.whiteBright(' Chki18n ')}${chalk.bgBlue.whiteBright(' DEBUG ')}`
		: ' Chki18n  DEBUG ';

	return { debug: (message) => console.error(`${label} ${message}`) };
}
