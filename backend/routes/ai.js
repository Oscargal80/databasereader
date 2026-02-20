const express = require('express');
const router = express.Router();
const { executeQuery, getSqlDialect } = require('../config/db');
const { generateWithOpenAI, generateWithGemini } = require('../services/aiService');

// Middleware to check session
const checkAuth = (req, res, next) => {
    if (!req.session.dbOptions) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    next();
};

router.use(checkAuth);

// Endpoint to generate SQL
router.post('/generate-sql', async (req, res) => {
    const { prompt, provider, model } = req.body;
    const dbOptions = req.session.dbOptions;

    if (!prompt) {
        return res.status(400).json({ success: false, message: 'Prompt is required' });
    }

    try {
        // 1. Fetch full schema for context
        const dialect = getSqlDialect(dbOptions.dbType);

        executeQuery(dbOptions, dialect.fullSchema, [], async (err, schemaData) => {
            if (err) {
                console.error('Schema fetch error:', err);
                return res.status(500).json({ success: false, message: 'Failed to fetch database schema for context' });
            }

            try {
                // 2. Format schema for the prompt
                const schemaMap = {};
                schemaData.forEach(row => {
                    const tableName = row.TABLE_NAME || row.NAME;
                    if (!schemaMap[tableName]) schemaMap[tableName] = [];
                    schemaMap[tableName].push(row.FIELD_NAME);
                });

                let schemaContext = "Current Database Schema:\n";
                for (const table in schemaMap) {
                    schemaContext += `Table: ${table} (Columns: ${schemaMap[table].join(', ')})\n`;
                }

                const finalPrompt = `${schemaContext}\nDatabase Engine: ${dbOptions.dbType}\n\nUser Request: ${prompt}\n\nGenerate the SQL query:`;

                console.log(`AI Request - Provider: ${provider}, Model: ${model || 'default'}`);

                // 3. Call AI Service
                let generatedSql = '';
                if (provider === 'gemini') {
                    generatedSql = await generateWithGemini(finalPrompt, model);
                } else {
                    generatedSql = await generateWithOpenAI(finalPrompt, model);
                }

                console.log('AI Generation success');

                res.json({
                    success: true,
                    sql: generatedSql
                });
            } catch (innerError) {
                console.error('AI Service call error:', innerError);
                res.status(500).json({ success: false, message: 'AI Service Error: ' + innerError.message });
            }
        });
    } catch (error) {
        console.error('AI generation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
