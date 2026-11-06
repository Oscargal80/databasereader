const STORAGE_KEY = 'sqlcopilot_ai_selection';

// The provider/model the user last picked in the SQL Copilot, shared with the other AI features
export const loadAiSelection = () => {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return {
            provider: typeof stored.provider === 'string' ? stored.provider : '',
            model: typeof stored.model === 'string' ? stored.model : ''
        };
    } catch (err) {
        return { provider: '', model: '' };
    }
};

export const saveAiSelection = (selection) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    } catch (err) {
        // storage unavailable: the selection just is not remembered
    }
};
