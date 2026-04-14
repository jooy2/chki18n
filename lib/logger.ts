import chalk from 'chalk';

const __header = chalk.bgBlueBright.whiteBright(' Chki18n ');
const __tagError = chalk.bgRedBright.whiteBright(' ERROR ');
const __tagWarning = chalk.bgYellowBright.whiteBright(' WARN ');
const __tagInfo = chalk.bgGrey.whiteBright(' INFO ');
const __tagDebug = chalk.bgBlue.whiteBright(' DEBUG ');

export function _error(message: string) {
	if (message?.length < 1) {
		return;
	}
	console.error(`${__header}${__tagError} ${message}`);
}

export function _debugLog(message: string, opt: any) {
	if (!opt?.debug) {
		return;
	}

	console.log(`${__header}${__tagDebug} ${message}`);
}

export function _log(message: string, level: 'info' | 'warn' | 'error', opt: any) {
	if (message?.length < 1) {
		return;
	}

	if (opt?.info === false) {
		return;
	}

	let tag: string;

	switch (level) {
		case 'warn':
			tag = __tagWarning;
			break;
		case 'error':
			tag = __tagError;
			break;
		case 'info':
		default:
			tag = __tagInfo;
			break;
	}

	console.log(`${__header}${tag} ${message}`);
}
