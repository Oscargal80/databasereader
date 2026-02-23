const fs = require('fs');
const path = require('path');

const { STATS_FILE } = require('../config/paths');

class UsageTracker {
    constructor() {
        this.stats = {};
        this.loadStats();
    }

    loadStats() {
        try {
            if (fs.existsSync(STATS_FILE)) {
                const data = fs.readFileSync(STATS_FILE, 'utf8');
                this.stats = JSON.parse(data);
                console.log('[UsageTracker] Stats loaded from disk.');
            } else {
                // Ensure data directory exists
                const dataDir = path.dirname(STATS_FILE);
                if (!fs.existsSync(dataDir)) {
                    fs.mkdirSync(dataDir, { recursive: true });
                }
                this.stats = {};
            }
        } catch (err) {
            console.error('[UsageTracker] Error loading stats:', err);
            this.stats = {};
        }
    }

    saveStats() {
        try {
            fs.writeFileSync(STATS_FILE, JSON.stringify(this.stats, null, 2), 'utf8');
        } catch (err) {
            console.error('[UsageTracker] Error saving stats:', err);
        }
    }

    track(dbKey, tableName) {
        if (!tableName) return;

        const key = `${dbKey}:${tableName}`;
        if (!this.stats[key]) {
            this.stats[key] = 0;
        }
        this.stats[key]++;

        // Save periodically or after every N tracking calls
        // For simplicity, we save every 10 calls or just let it stay in memory
        if (this.stats[key] % 5 === 0) {
            this.saveStats();
        }
    }

    getStats(dbKey) {
        const result = {};
        const prefix = `${dbKey}:`;

        for (const key in this.stats) {
            if (key.startsWith(prefix)) {
                const tableName = key.substring(prefix.length);
                result[tableName] = this.stats[key];
            }
        }

        return result;
    }
}

const tracker = new UsageTracker();
module.exports = tracker;
