const axios = require('axios');
const config = require('../config');
const logger = require('../lib/logger');

const SYSTEM_PROMPT = "Eres Wiki, el módulo enciclopédico del bot Unsk1ngMD desarrollado por Castrodev. Tu objetivo es explicar conceptos matemáticos, ciencia, historia, personajes, tecnología o términos generales en español de forma rigurosa, clara y estructurada. Responde directamente en 2 o 3 párrafos concisos sin rodeos, introducciones innecesarias ni saludos.";

module.exports = {
    name: 'wiki',
    alias: ['wikipedia', 'enciclopedia', 'definir', 'definicion', 'kiwi'],
    category: 'herramientas',
    desc: 'Consulta enciclopédica avanzada y explicaciones rigurosas con IA (Groq Cloud)',
    usage: '.wiki [término o tema a consultar]',
    execute: async ({ sock, m, text }) => {
        // 1. Extracción y validación de la consulta
        const rawText = text || m.quoted?.body || '';
        const query = rawText.replace(/^[.\/#!](?:wiki|kiwi|wikipedia|enciclopedia)\s*/i, '').trim();

        if (!query) {
            return await sock.sendMessage(m.chat, {
                text: '❌ Por favor indica el tema que deseas consultar. Ejemplo: `.wiki El número Pi`'
            }, { quoted: m });
        }

        const apiKey = process.env.GROQ_API_KEY || config.groqApiKey;

        if (!apiKey || apiKey.trim() === '') {
            return await sock.sendMessage(m.chat, {
                text: '❌ La clave de IA no está configurada o es inválida.'
            }, { quoted: m });
        }

        await m.react('📚');

        try {
            const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

            // Lista de modelos con fallback automático de alta disponibilidad
            const candidateModels = [
                process.env.GROQ_MODEL,
                'openai/gpt-oss-120b',
                'qwen/qwen3.8-27b',
                'openai/gpt-oss-20b',
                'llama-3.3-70b-versatile',
                'llama-3.1-8b-instant'
            ].filter(Boolean);

            const uniqueModels = [...new Set(candidateModels)];

            let explanation = null;
            let lastError = null;

            for (const model of uniqueModels) {
                try {
                    const response = await axios.post(
                        endpoint,
                        {
                            model: model,
                            messages: [
                                { role: 'system', content: SYSTEM_PROMPT },
                                { role: 'user', content: query }
                            ],
                            temperature: 0.3,
                            max_tokens: 800
                        },
                        {
                            headers: {
                                'Authorization': `Bearer ${apiKey.trim()}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 20000
                        }
                    );

                    explanation = response.data?.choices?.[0]?.message?.content?.trim();
                    if (explanation) break;
                } catch (err) {
                    lastError = err;
                    const status = err.response?.status;
                    if (status === 401) break; // Token inválido
                }
            }

            if (!explanation) {
                await m.react('❌');
                const isAuthError = lastError?.response?.status === 401;
                const errorMsg = isAuthError
                    ? '❌ La clave de IA no está configurada o es inválida.'
                    : `❌ No fue posible obtener la explicación enciclopédica para "*${query}*". Detalle: ${lastError?.response?.data?.error?.message || lastError?.message || 'Error de servicio'}`;

                return await sock.sendMessage(m.chat, { text: errorMsg }, { quoted: m });
            }

            // 2. Estructura visual de respuesta
            const formattedExplanation = explanation
                .split('\n')
                .map(line => line.trim() ? `│ ${line}` : '│')
                .join('\n');

            const message =
`┌─── 📚 *WIKI ENCYCLOPEDIA* ───
│ 📌 *Término:* ${query}
│ 📖 *Definición / Explicación:*
${formattedExplanation}
└─────────────────────────────`;

            await sock.sendMessage(m.chat, { text: message }, { quoted: m });
            await m.react('✅');

        } catch (error) {
            logger.error('[WIKI ERROR]:', error.message);
            await m.react('❌');
            await sock.sendMessage(m.chat, {
                text: `❌ Ocurrió un error al procesar la consulta enciclopédica. Intenta nuevamente.`
            }, { quoted: m });
        }
    }
};

