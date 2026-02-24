const path = require('path');
const fs = require('fs');

/**
 * Get the application data directory.
 * In development, it uses the local 'data' folder.
 * In production (Electron), it uses the OS-specific user data folder.
 */
const getAppDataPath = () => {
    // This environment variable should be set by Electron's main process
    const userDataPath = process.env.USER_DATA_PATH;

    if (userDataPath) {
        return path.join(userDataPath, 'sql-copilot-data');
    }

    // Fallback for development/stand-alone server: use 'data' in the project root
    return path.join(process.cwd(), 'data');
};

const APP_DATA_DIR = getAppDataPath();

// Ensure the directory exists
if (!fs.existsSync(APP_DATA_DIR)) {
    try {
        fs.mkdirSync(APP_DATA_DIR, { recursive: true });
    } catch (err) {
        console.error('Failed to create app data directory:', err);
    }
}

module.exports = {
    APP_DATA_DIR,
    STAGING_DIR: path.join(APP_DATA_DIR, 'staging'),
    STATS_FILE: path.join(APP_DATA_DIR, 'table_stats.json'),
    LICENSE_FILE: path.join(APP_DATA_DIR, '.license'),
    QUERIES_FILE: path.join(APP_DATA_DIR, 'queries.json'),
    SETTINGS_FILE: path.join(APP_DATA_DIR, 'settings.json')
};
