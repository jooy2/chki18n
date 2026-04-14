import chalk from 'chalk';

const __header = chalk.bgBlueBright.whiteBright(' Chki18n ');
const __tagError = chalk.bgRedBright.whiteBright(' ERROR ');
const __tagWarning = chalk.bgYellowBright.whiteBright(' WARN ');
const __tagInfo = chalk.bgGrey.whiteBright(' INFO ');
const __tagDebug = chalk.bgBlue.whiteBright(' DEBUG ');
const __tagPass = chalk.bgGreenBright.whiteBright(' PASS ');

export function _error(message: string) {
	if (message?.length < 1) {
		return;
	}
	console.error(`${__header}${__tagError} ${message}`);
}

export function _pass(message: string) {
	if (message?.length < 1) {
		return;
	}
	console.error(`${__header}${__tagPass} ${message}`);
}

export function _debugLog(message: string, opt: any) {
	if (!opt?.debug || message?.length < 1) {
		return;
	}

	console.log(`${__header}${__tagDebug} ${message}`);
}

export function _log(message: string, level: 'info' | 'warn' | 'error', opt: any) {
	if (message?.length < 1) {
		return;
	}

	let tag: string;

	switch (level) {
		case 'warn':
			if (opt?.warn === false) {
				return;
			}
			tag = __tagWarning;
			break;
		case 'error':
			tag = __tagError;
			break;
		case 'info':
		default:
			if (opt?.info === false) {
				return;
			}
			tag = __tagInfo;
			break;
	}

	console.log(`${__header}${tag} ${message}`);
}
