const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '..');
const ENV_PATH = path.join(BACKEND_DIR, '.env');
const DATA_DIR = path.join(BACKEND_DIR, 'data');
const LICENSE_PATH = path.join(DATA_DIR, '.license');
const QUERIES_PATH = path.join(DATA_DIR, 'queries.json');

console.log('--- BUILD SANITIZATION START ---');

// 1. Sanitize .env
if (fs.existsSync(ENV_PATH)) {
    console.log('Cleaning .env file...');
    let envContent = fs.readFileSync(ENV_PATH, 'utf8');

    const lines = envContent.split('\n').map(line => {
        if (line.startsWith('OPENAI_API_KEY=')) return 'OPENAI_API_KEY=';
        if (line.startsWith('GEMINI_API_KEY=')) return 'GEMINI_API_KEY=';
        // Keep PORT and NODE_ENV but reset to defaults if needed
        if (line.startsWith('NODE_ENV=')) return 'NODE_ENV=production';
        return line;
    });

    fs.writeFileSync(ENV_PATH, lines.join('\n').trim() + '\n');
    console.log('✅ .env sanitized.');
} else {
    console.log('⚠️  .env not found, skipping.');
}

// 2. Clear .license
if (fs.existsSync(LICENSE_PATH)) {
    console.log('Cleaning license file...');
    fs.writeFileSync(LICENSE_PATH, '');
    console.log('✅ .license cleared.');
}

// 3. Clear queries.json (reset to empty array)
if (fs.existsSync(QUERIES_PATH)) {
    console.log('Cleaning saved queries...');
    fs.writeFileSync(QUERIES_PATH, '[]');
    console.log('✅ queries.json reset.');
}

console.log('--- SANITIZATION COMPLETE ---');
console.log('Project is now safe for binary distribution.');
