import chalk from 'chalk';
import type { Chki18nLevel } from '../_types/global.js';

/**
 * The colours a report may use, held as a table rather than reached for at each
 * call site. One formatter then renders both the coloured terminal report and
 * the plain text that goes into a file, with no branching of its own.
 */
export type Chki18nPaint = {
	error: (text: string) => string;
	warn: (text: string) => string;
	info: (text: string) => string;
	heading: (text: string) => string;
	key: (text: string) => string;
	value: (text: string) => string;
	dim: (text: string) => string;
	pass: (text: string) => string;
	fail: (text: string) => string;
};

const identity = (text: string): string => text;

const PLAIN: Chki18nPaint = {
	error: identity,
	warn: identity,
	info: identity,
	heading: identity,
	key: identity,
	value: identity,
	dim: identity,
	pass: identity,
	fail: identity
};

const COLOURED: Chki18nPaint = {
	error: (text) => chalk.redBright(text),
	warn: (text) => chalk.yellowBright(text),
	info: (text) => chalk.gray(text),
	heading: (text) => chalk.bold.whiteBright(text),
	key: (text) => chalk.cyanBright(text),
	value: (text) => chalk.white(text),
	dim: (text) => chalk.gray(text),
	pass: (text) => chalk.bgGreenBright.whiteBright(text),
	fail: (text) => chalk.bgRedBright.whiteBright(text)
};

/**
 * Colours when asked for them and the terminal supports them. A file always
 * gets `PLAIN`: escape codes in a saved report are noise nothing will read.
 */
export function createPaint(enabled: boolean): Chki18nPaint {
	return enabled && chalk.level > 0 ? COLOURED : PLAIN;
}

/** The painter that matches a severity, for level coloured text. */
export function paintOfLevel(paint: Chki18nPaint, level: Chki18nLevel): (text: string) => string {
	return level === 'error' ? paint.error : level === 'warn' ? paint.warn : paint.info;
}
