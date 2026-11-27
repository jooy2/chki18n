// Two of the three keys are referenced here: one by its whole dotted key, and
// one by its leaf alone — which is the form the scan actually searches for.
export const render = (t: (key: string) => string) => `${t('desc.hello')} ${t('folder')}`;
