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

// Endpoint to generate SQL from Natural Language (SQL Copilot)
router.post('/chat-to-sql', async (req, res) => {
    const { prompt, provider, model } = req.body;
    const dbOptions = req.session.dbOptions;

    if (!prompt) {
        return res.status(400).json({ success: false, message: 'Message is required' });
    }

    try {
        const dialect = getSqlDialect(dbOptions.dbType);

        // 1. Fetch full schema for context (using optimized bulk query if available)
        const schemaSql = dialect.fullSchema || dialect.explorer.userTables;

        executeQuery(dbOptions, schemaSql, [], async (err, schemaRows) => {
            if (err) {
                console.error('[SQL-COPILOT] Schema context fetch error:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to fetch database schema for AI context: ' + err.message
                });
            }

            try {
                // 2. Format schema for the prompt
                const tableMap = {};
                (schemaRows || []).forEach(row => {
                    const tName = (row.TABLE_NAME || row.table_name || row.NAME || 'UNKNOWN').trim();
                    const fName = (row.FIELD_NAME || row.field_name || row.column_name || '').trim();
                    if (!tableMap[tName]) tableMap[tName] = [];
                    if (fName) tableMap[tName].push(fName);
                });

                let schemaContext = "Database Schema:\n";
                for (const table in tableMap) {
                    schemaContext += `- Table: ${table} (Columns: ${tableMap[table].join(', ')})\n`;
                }

                const finalPrompt = `
                    You are a Senior DBA and SQL Copilot.
                    Database Engine: ${dbOptions.dbType}
                    ${schemaContext}
                    
                    User Request: "${prompt}"
                    
                    Instructions:
                    - Generate valid SQL for the ${dbOptions.dbType} engine.
                    - Be careful with engine-specific syntax (e.g., Firebird uses FIRST/SKIP, Postgres uses LIMIT/OFFSET).
                    - If the request is ambiguous, make a reasonable assumption based on the schema.
                    - ONLY RETURN THE SQL QUERY. No explanations, no markdown backticks, just the code.
                `.trim();

                console.log(`[SQL-COPILOT] Generating SQL for ${dbOptions.dbType}...`);

                let generatedSql = '';
                if (provider === 'gemini') {
                    generatedSql = await generateWithGemini(finalPrompt, model);
                } else {
                    generatedSql = await generateWithOpenAI(finalPrompt, model);
                }

                // Clean up string just in case AI ignores instruction to not use backticks
                generatedSql = generatedSql.replace(/```sql/g, '').replace(/```/g, '').trim();

                console.log('[SQL-COPILOT] Code generated successfully.');

                res.json({
                    success: true,
                    sql: generatedSql
                });
            } catch (innerError) {
                console.error('AI API Error:', innerError);
                res.status(500).json({ success: false, message: 'AI Service Error: ' + innerError.message });
            }
        });
    } catch (error) {
        console.error('[SQL-COPILOT] General error:', error);
        res.status(500).json({
            success: false,
            message: 'Copilot General Error: ' + error.message,
            stack: error.stack
        });
    }
});

// Endpoint to explain query results in natural language
router.post('/explain-result', async (req, res) => {
    const { query, results, provider, model } = req.body;

    if (!query || !results) {
        return res.status(400).json({ success: false, message: 'Query and results are required' });
    }

    try {
        const dataSnippet = JSON.stringify(results.slice(0, 10), null, 2);
        const count = results.length;

        const prompt = `
            You are an AI Data Analyst.
            Query executed: "${query}"
            Number of rows returned: ${count}
            Data sample (first 10 rows):
            ${dataSnippet}

            Task: Explain these results in a concise, friendly, and professional way in Spanish.
            Highlight any interesting patterns or summaries if possible (e.g. sums, counts, or major values).
            Respond in Markdown.
        `.trim();

        console.log('[SQL-COPILOT] Explaining results...');

        let explanation = '';
        if (provider === 'gemini') {
            explanation = await generateWithGemini(prompt, model);
        } else {
            explanation = await generateWithOpenAI(prompt, model);
        }

        res.json({
            success: true,
            explanation
        });
    } catch (error) {
        console.error('Result explanation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Endpoint to analyze and optimize SQL
router.post('/analyze-query', async (req, res) => {
    const { sql, provider, model } = req.body;
    const dbOptions = req.session.dbOptions;

    if (!sql) {
        return res.status(400).json({ success: false, message: 'SQL query is required' });
    }

    try {
        const dialect = getSqlDialect(dbOptions.dbType);
        const explainSql = dialect.explain ? dialect.explain(sql) : null;

        if (!explainSql) {
            return res.json({
                success: true,
                analysis: "La optimización inteligente no está disponible para este motor, pero te sugerimos revisar los índices en las columnas de JOIN y WHERE."
            });
        }

        executeQuery(dbOptions, explainSql, [], async (err, explainResult) => {
            if (err) {
                return res.status(200).json({
                    success: true,
                    analysis: `No se pudo obtener el plan de ejecución: ${err.message}. Asegúrate de que la consulta sea válida.`
                });
            }

            try {
                const planStr = JSON.stringify(explainResult, null, 2);

                const prompt = `
                    Analiza como un DBA senior esta consulta SQL para ${dbOptions.dbType}.
                    
                    SQL: ${sql}
                    PLAN DE EJECUCIÓN (EXPLAIN): ${planStr}

                    Basado en el plan, sugiere:
                    1. Índices necesarios (especifica nombre de tabla y columna).
                    2. Cambios en JOINs si los hay.
                    3. Errores de rendimiento (Scans completos, sorting pesado).
                    4. Si conviene cambiar algún tipo de dato.

                    Responde de forma visual y entendible en español. Usa Markdown para resaltar recomendaciones.
                    Al final, da un veredicto de "Salud de la consulta" (Excelente, Aceptable, Crítica).
                `.trim();

                let analysis = '';
                if (provider === 'gemini') {
                    analysis = await generateWithGemini(prompt, model);
                } else {
                    analysis = await generateWithOpenAI(prompt, model);
                }

                res.json({
                    success: true,
                    plan: explainResult,
                    analysis: analysis
                });
            } catch (innerError) {
                console.error('AI Analysis Error:', innerError);
                res.status(500).json({ success: false, message: 'Error de IA al analizar: ' + innerError.message });
            }
        });
    } catch (error) {
        console.error('General analysis error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
