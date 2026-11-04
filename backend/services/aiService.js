const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const generateWithOpenAI = async (prompt, model = process.env.OPENAI_MODEL || 'gpt-4o') => {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey === 'your_openai_key_here' || apiKey.trim() === '') {
        console.error('[AI-SERVICE] OpenAI API Key is missing or invalid.');
        throw new Error('Configuración de IA incompleta: Falta la API Key de OpenAI. Ve a Configuración para cargarla.');
    }

    try {
        const openai = new OpenAI({ apiKey });
        const response = await openai.chat.completions.create({
            model,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert SQL assistant. Your task is to generate ONLY valid SQL code based on the provided schema and user request. Do not include any explanations, markdown formatting, or backticks. Just the raw SQL.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0
        });

        return response.choices[0].message.content.trim();
    } catch (err) {
        console.error('[AI-SERVICE] OpenAI Error:', err.message);
        throw new Error(`Error de OpenAI: ${err.message}`);
    }
};

const generateWithGemini = async (prompt, model = process.env.GEMINI_MODEL || 'gemini-2.5-flash') => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_gemini_key_here' || apiKey.trim() === '') {
        console.error('[AI-SERVICE] Gemini API Key is missing or invalid.');
        throw new Error('Configuración de IA incompleta: Falta la API Key de Gemini. Ve a Configuración para cargarla.');
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelInstance = genAI.getGenerativeModel({ model });

        const systemInstruction = 'You are an expert SQL assistant. Your task is to generate ONLY valid SQL code based on the provided schema and user request. Do not include any explanations, markdown formatting, or backticks. Just the raw SQL.';

        const result = await modelInstance.generateContent(systemInstruction + "\n\nUser Request: " + prompt);
        const response = await result.response;
        return response.text().trim().replace(/```sql/g, '').replace(/```/g, '');
    } catch (err) {
        console.error('[AI-SERVICE] Gemini Error:', err.message);
        throw new Error(`Error de Gemini: ${err.message}`);
    }
};

const MAX_PROMPT_TABLES = 40;
const MAX_COLUMNS_PER_TABLE = 60;

const tokenize = (text) => String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(word => word.length >= 3);

/**
 * Large databases do not fit in a prompt: keep the tables whose names or columns
 * best match the words of the request.
 */
const selectRelevantTables = (userPrompt, tables) => {
    const entries = Object.entries(tables);
    if (entries.length <= MAX_PROMPT_TABLES) return { selected: entries, omitted: 0 };

    const words = [...new Set(tokenize(userPrompt))];
    const matches = (token, word) => token === word || (word.length >= 4 && token.includes(word)) || (token.length >= 4 && word.includes(token));

    const scored = entries.map(([table, columns]) => {
        const tableTokens = tokenize(table);
        const columnTokens = columns.flatMap(tokenize);
        let score = 0;
        words.forEach(word => {
            if (tableTokens.some(token => matches(token, word))) score += 3;
            if (columnTokens.some(token => matches(token, word))) score += 1;
        });
        return { entry: [table, columns], score };
    });

    scored.sort((a, b) => b.score - a.score || a.entry[0].localeCompare(b.entry[0]));
    return {
        selected: scored.slice(0, MAX_PROMPT_TABLES).map(item => item.entry),
        omitted: entries.length - MAX_PROMPT_TABLES
    };
};

const prepareSqlPrompt = (userPrompt, dbType, metadata) => {
    let schemaContext = "No schema information available.";
    if (metadata && metadata.tables) {
        const { selected, omitted } = selectRelevantTables(userPrompt, metadata.tables);
        schemaContext = "Database Schema:\n";
        for (const [table, columns] of selected) {
            const shown = columns.slice(0, MAX_COLUMNS_PER_TABLE);
            const extra = columns.length - shown.length;
            schemaContext += `- Table: ${table} (Columns: ${shown.join(', ')}${extra > 0 ? `, ... +${extra} more` : ''})\n`;
        }
        if (omitted > 0) {
            schemaContext += `(${omitted} more tables exist but were omitted because they look unrelated to the request.)\n`;
        }
    }
    if (metadata && metadata.procedures && metadata.procedures.length > 0) {
        schemaContext += "\nProcedures:\n- " + metadata.procedures.join('\n- ');
    }

    return `
You are a Senior DBA and SQL Expert.
Database Engine: ${dbType}

${schemaContext}

User Request: "${userPrompt}"

Instructions:
- Generate valid SQL for the ${dbType} engine.
- Be careful with engine-specific syntax (e.g., Firebird uses FIRST/SKIP, Postgres uses LIMIT/OFFSET).
- If the request is ambiguous, make a reasonable assumption based on the schema.
- ONLY RETURN THE RAW SQL. No explanations, no markdown backticks, just the code.`.trim();
};

module.exports = {
    generateWithOpenAI,
    generateWithGemini,
    prepareSqlPrompt,
    selectRelevantTables
};
