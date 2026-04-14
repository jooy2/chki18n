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
