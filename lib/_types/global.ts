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

export type Chki18nOptions = { path?: string; target?: string; info?: boolean; warn?: boolean };

export type Chki18nResult = { success: boolean; issues?: Partial<Record<string, ListIssueItem[]>> };
