import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';
import { resolve } from 'node:path';

export const __isWindows = platform() === 'win32';

export const __isCliMode = (() => {
	try {
		return (
			realpathSync(process.argv[1]) ===
			realpathSync(resolve(fileURLToPath(import.meta.url), '../index.js'))
		);
	} catch {
		return false;
	}
})();

export const CHECK_CODE = {
	UNKNOWN: 'UNKNOWN',
	INVALID_OPTIONS: 'INVALID_OPTIONS',
	INVALID_FILE: 'INVALID_FILE',
	NO_KEY: 'NO_KEY',
	NO_INTERPOLATION_KEY: 'NO_INTERPOLATION_KEY',
	DUMMY_KEY: 'DUMMY_KEY',
	EMPTY_VALUE: 'EMPTY_VALUE',
	DUPLICATE_VALUE: 'DUPLICATE_VALUE',
	NOT_TRANSLATED_VALUE: 'NOT_TRANSLATED_VALUE'
};
