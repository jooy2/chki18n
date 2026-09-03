// Every shape the scan is expected to read, and two it is expected to leave
// alone: a key built at run time, and one the runtime resolves from a prefix.
export const render = (t: (key: string, options?: object) => string, code: string) => [
	t('desc.hello'),
	t('attr.missing'),
	t('common:desc.hello'),
	t('item', { count: 2 }),
	t(`error.${code}`),
	t('folder')
];
