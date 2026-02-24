const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const generateWithOpenAI = async (prompt, model = 'gpt-4o') => {
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

const generateWithGemini = async (prompt, model = 'gemini-1.5-flash') => {
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

module.exports = {
    generateWithOpenAI,
    generateWithGemini
};
