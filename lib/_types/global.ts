export type AnyValueObject = { [key: string]: any };

export type ListIssueItem = {
	locale: string;
	key: string;
	value: string;
	targetValue: string;
	interpolation?: string;
	level: 'warn' | 'error' | 'suggest';
	code: string;
};
