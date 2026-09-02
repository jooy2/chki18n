import { platform } from 'node:os';

export const __isWindows = platform() === 'win32';
