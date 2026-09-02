import chalk from 'chalk';
import type { Chki18nResolvedOptions } from './_types/global.js';

const __header = chalk.bgBlueBright.whiteBright(' Chki18n ');
const __tagError = chalk.bgRedBright.whiteBright(' ERROR ');
const __tagWarning = chalk.bgYellowBright.whiteBright(' WARN ');
const __tagInfo = chalk.bgGrey.whiteBright(' INFO ');
const __tagDebug = chalk.bgBlue.whiteBright(' DEBUG ');
const __tagPass = chalk.bgGreenBright.whiteBright(' PASS ');

export type Chki18nLogger = {
	error: (message: string) => void;
	warn: (message: string) => void;
	info: (message: string) => void;
	debug: (message: string) => void;
	pass: (message: string) => void;
	/** Write a line with no header or tag, for list items and blank lines. */
	plain: (message?: string) => void;
};

const noop = () => {};

/** A logger that writes nothing. What the library uses unless asked to speak. */
export const silentLogger: Chki18nLogger = {
	error: noop,
	warn: noop,
	info: noop,
	debug: noop,
	pass: noop,
	plain: noop
};

/**
 * Console output for the CLI. The library never writes to the console on its
 * own: without `verbose` this hands back `silentLogger`, so importing the module
 * and calling it cannot pollute a host application's output.
 */
export function createLogger(options: Chki18nResolvedOptions): Chki18nLogger {
	if (!options.verbose) {
		return options.debug
			? { ...silentLogger, debug: (message) => console.log(`${__header}${__tagDebug} ${message}`) }
			: silentLogger;
	}

	return {
		error: (message) => console.error(`${__header}${__tagError} ${message}`),
		warn: (message) => {
			if (options.warn) {
				console.log(`${__header}${__tagWarning} ${message}`);
			}
		},
		info: (message) => {
			if (options.info) {
				console.log(`${__header}${__tagInfo} ${message}`);
			}
		},
		debug: (message) => {
			if (options.debug) {
				console.log(`${__header}${__tagDebug} ${message}`);
			}
		},
		pass: (message) => console.log(`${__header}${__tagPass} ${message}`),
		plain: (message = '') => console.log(message)
	};
}
