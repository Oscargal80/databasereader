const STORAGE_KEY = 'sqlcopilot_recent_databases';
const MAX_RECENT = 30;

const read = () => {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(stored) ? stored : [];
    } catch (err) {
        return [];
    }
};

const sameHost = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// Database names/paths used before on this device for an engine and host. Passwords are never stored.
export const recentDatabasesFor = (dbType, host) => read()
    .filter(item => item.dbType === dbType && (!String(host || '').trim() || sameHost(item.host, host)))
    .map(item => item.database);

export const rememberDatabase = ({ dbType, host, database }) => {
    const name = String(database || '').trim();
    if (!name) return;

    const rest = read().filter(item => !(item.dbType === dbType && sameHost(item.host, host) && item.database === name));
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([{ dbType, host: String(host || '').trim(), database: name }, ...rest].slice(0, MAX_RECENT)));
    } catch (err) {
        // storage unavailable: recents just are not kept
    }
};
