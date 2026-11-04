const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');

const SQL_SYSTEM = 'You are an expert SQL assistant. Your task is to generate ONLY valid SQL code based on the provided schema and user request. Do not include any explanations, markdown formatting, or backticks. Just the raw SQL.';
const ANALYSIS_SYSTEM = 'You are a senior database engineer and data analyst. Answer in Spanish, concisely, using Markdown.';

// Models the UI may request; anything else falls back to ANTHROPIC_MODEL or the default
const ANTHROPIC_MODELS = [
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (máxima calidad)' },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (equilibrado)' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (rápido y económico)' }
];
const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';

const generateWithOpenAI = async (prompt, model = process.env.OPENAI_MODEL || 'gpt-4o', system = SQL_SYSTEM) => {
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
                    content: system
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

const generateWithGemini = async (prompt, model = process.env.GEMINI_MODEL || 'gemini-2.5-flash', system = SQL_SYSTEM) => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_gemini_key_here' || apiKey.trim() === '') {
        console.error('[AI-SERVICE] Gemini API Key is missing or invalid.');
        throw new Error('Configuración de IA incompleta: Falta la API Key de Gemini. Ve a Configuración para cargarla.');
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelInstance = genAI.getGenerativeModel({ model });

        const result = await modelInstance.generateContent(system + "\n\nUser Request: " + prompt);
        const response = await result.response;
        const text = response.text().trim();
        return system === SQL_SYSTEM ? text.replace(/```sql/g, '').replace(/```/g, '') : text;
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

const SQL_RULES = `You are a Senior DBA and SQL expert embedded in a database administration tool.
- Generate valid SQL for the database engine and schema given below.
- Be careful with engine-specific syntax (e.g. Firebird uses FIRST/SKIP, PostgreSQL and MySQL use LIMIT/OFFSET, SQL Server uses OFFSET/FETCH).
- Quote identifiers only when the schema requires it (mixed case, reserved words).
- Prefer read-only queries; when the request implies modifying data, say so in the warnings and always include a WHERE clause unless the user explicitly asks for the whole table.
- If the request is ambiguous, make a reasonable assumption based on the schema and state it in the explanation.
- Write the explanation and warnings in Spanish.`;

const describeSchema = (userPrompt, dbType, metadata) => {
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
    return `Database Engine: ${dbType}\n\n${schemaContext}`.trim();
};

const buildUserMessage = (userPrompt, currentSql, errorMessage) => {
    const parts = [];
    if (currentSql) parts.push(`SQL currently in the editor:\n${currentSql}`);
    if (errorMessage) parts.push(`Running it failed with this database error:\n${errorMessage}\nFix the SQL so it runs correctly and keeps the original intent.`);
    if (userPrompt) parts.push(`Request: ${userPrompt}`);
    return parts.join('\n\n');
};

const formatHistory = (history) => history.map(turn => `${turn.role === 'user' ? 'User' : 'Assistant SQL'}: ${turn.content}`).join('\n');

// Single-string prompt for providers without a separate system/context channel (OpenAI, Gemini)
const prepareSqlPrompt = (userPrompt, dbType, metadata, options = {}) => {
    const { history = [], currentSql, errorMessage } = options;
    const relevance = [userPrompt, currentSql, ...history.filter(t => t.role === 'user').map(t => t.content)].filter(Boolean).join(' ');

    return `
${SQL_RULES}

${describeSchema(relevance, dbType, metadata)}
${history.length > 0 ? `\nPrevious conversation:\n${formatHistory(history)}\n` : ''}
${buildUserMessage(userPrompt, currentSql, errorMessage)}

ONLY RETURN THE RAW SQL. No explanations, no markdown backticks, just the code.`.trim();
};

const SQL_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        sql: { type: 'string', description: 'The SQL, ready to run on the target engine, without markdown fences' },
        explanation: { type: 'string', description: 'One or two sentences in Spanish on what the query does and any assumption made' },
        warnings: { type: 'array', items: { type: 'string' }, description: 'Spanish notes about risks: data modification, missing filters, assumptions' }
    },
    required: ['sql', 'explanation', 'warnings'],
    additionalProperties: false
};

const resolveAnthropicModel = (requested) => {
    if (requested && ANTHROPIC_MODELS.some(model => model.id === requested)) return requested;
    return process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;
};

const describeAnthropicError = (err) => {
    if (err instanceof Anthropic.AuthenticationError) return 'La API Key de Anthropic es inválida o fue revocada.';
    if (err instanceof Anthropic.PermissionDeniedError) return 'La API Key de Anthropic no tiene permiso para usar este modelo.';
    if (err instanceof Anthropic.RateLimitError) return 'Anthropic limitó las solicitudes (rate limit). Espera un momento e inténtalo de nuevo.';
    if (err instanceof Anthropic.BadRequestError) return `Anthropic rechazó la solicitud: ${err.message}`;
    if (err instanceof Anthropic.APIConnectionError) return 'No se pudo conectar con Anthropic. Revisa tu conexión a internet.';
    if (err instanceof Anthropic.APIError) return `Error de Anthropic (${err.status}): ${err.message}`;
    return err.message;
};

/**
 * Call Claude. `context` (engine + schema) goes in its own system block marked for prompt caching:
 * it is the large, stable part, so repeated questions about the same database reuse it.
 * With `structured` the reply is constrained to { sql, explanation, warnings }.
 */
const generateWithAnthropic = async ({ system, context, messages, model, structured = false }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey || apiKey.trim() === '') {
        console.error('[AI-SERVICE] Anthropic API Key is missing.');
        throw new Error('Configuración de IA incompleta: Falta la API Key de Anthropic. Ve a Configuración para cargarla.');
    }

    const systemBlocks = [{ type: 'text', text: system }];
    if (context) systemBlocks.push({ type: 'text', text: context, cache_control: { type: 'ephemeral' } });

    const outputConfig = { effort: 'medium' };
    if (structured) outputConfig.format = { type: 'json_schema', schema: SQL_RESPONSE_SCHEMA };

    let response;
    try {
        const client = new Anthropic({ apiKey, timeout: 120000 });
        response = await client.messages.create({
            model: resolveAnthropicModel(model),
            max_tokens: 16000,
            system: systemBlocks,
            messages,
            output_config: outputConfig
        });
    } catch (err) {
        console.error('[AI-SERVICE] Anthropic Error:', err.message);
        throw new Error(describeAnthropicError(err));
    }

    if (response.stop_reason === 'refusal') {
        throw new Error('Claude rechazó responder esta solicitud. Reformúlala o prueba con otro proveedor.');
    }
    if (response.stop_reason === 'max_tokens') {
        throw new Error('La respuesta de Claude se cortó por longitud. Pide algo más acotado.');
    }

    const text = response.content.filter(block => block.type === 'text').map(block => block.text).join('').trim();
    if (!text) throw new Error('Claude no devolvió contenido.');
    return text;
};

const stripFences = (text) => text.replace(/```sql/gi, '').replace(/```/g, '').trim();

/**
 * Turn a provider reply into { sql, explanation, warnings }.
 * Structured replies are JSON; plain replies (OpenAI/Gemini, or a malformed JSON) are treated as raw SQL.
 */
const parseSqlReply = (text, structured) => {
    if (structured) {
        try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed.sql === 'string') {
                return {
                    sql: stripFences(parsed.sql),
                    explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
                    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter(w => typeof w === 'string') : []
                };
            }
        } catch (err) {
            // fall through: use the text as SQL
        }
    }
    return { sql: stripFences(text), explanation: '', warnings: [] };
};

module.exports = {
    generateWithOpenAI,
    generateWithGemini,
    generateWithAnthropic,
    prepareSqlPrompt,
    describeSchema,
    buildUserMessage,
    parseSqlReply,
    selectRelevantTables,
    ANTHROPIC_MODELS,
    DEFAULT_ANTHROPIC_MODEL,
    resolveAnthropicModel,
    SQL_RULES,
    ANALYSIS_SYSTEM
};
