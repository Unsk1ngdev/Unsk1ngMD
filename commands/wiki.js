const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const axios = require('axios');
const config = require('../config');
const logger = require('../lib/logger');

const SYSTEM_PROMPT = "Eres Wiki, el módulo enciclopédico del bot Unsk1ngMD desarrollado por Unknown Codexツ</>. Tu objetivo es explicar conceptos matemáticos, ciencia, historia, personajes, tecnología o términos generales en español de forma rigurosa, clara y estructurada. Responde directamente en 2 o 3 párrafos concisos sin rodeos, introducciones innecesarias ni saludos.";

module.exports = {
    name: 'wiki',
    alias: ['wikipedia', 'enciclopedia', 'definir', 'definicion', 'kiwi'],
    category: 'herramientas',
    desc: 'Consulta enciclopédica avanzada y explicaciones rigurosas con IA (Groq Cloud)',
    usage: '.wiki [término o tema a consultar]',
    execute: async ({ sock, m, text }) => {
        const jid = m.chat;

        // 1. Extracción y validación de la consulta
        const rawText = text || m.quoted?.body || '';
        const query = rawText.replace(/^[.\/#!](?:wiki|kiwi|wikipedia|enciclopedia)\s*/i, '').trim();

        if (!query) {
            return await sock.sendMessage(jid, {
                text: '❌ Por favor indica el tema que deseas consultar. Ejemplo: `.wiki El número Pi`'
            }, { quoted: m });
        }

        // 2. Validación estricta y dinámica de la API Key de Groq
        let apiKey = (process.env.GROQ_API_KEY || config.groqApiKey || '').trim();
        if (!apiKey) {
            try {
                const envPath = path.resolve(__dirname, '../.env');
                if (fs.existsSync(envPath)) {
                    const envContent = fs.readFileSync(envPath, 'utf8');
                    const mKey = envContent.match(/^GROQ_API_KEY=(.*)$/m);
                    if (mKey) apiKey = mKey[1].trim();
                }
            } catch (_) {}
        }

        if (!apiKey) {
            return await sock.sendMessage(jid, {
                text: '❌ La API Key de Groq no está configurada en el archivo .env. Añade GROQ_API_KEY para habilitar esta función.'
            }, { quoted: m });
        }

        await m.react('📚');

        const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
        const candidateModels = [
            process.env.GROQ_MODEL?.trim(),
            'openai/gpt-oss-20b',
            'qwen/qwen3.8-27b',
            'openai/gpt-oss-120b',
            config.groqModel,
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant'
        ].filter(Boolean);

        const uniqueModels = [...new Set(candidateModels)];

        let explanation = null;
        let lastError = null;

        // 3. Petición HTTP a Groq con timeout estricto de 20s
        for (const model of uniqueModels) {
            try {
                const response = await axios.post(
                    endpoint,
                    {
                        model,
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            { role: 'user', content: query }
                        ],
                        temperature: 0.3,
                        max_tokens: 800
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 20000 // 20 segundos de timeout
                    }
                );

                explanation = response.data?.choices?.[0]?.message?.content?.trim();
                if (explanation) break;
            } catch (err) {
                lastError = err;
                const status = err.response?.status;
                if (status === 401) break;
                if (status === 429 || status === 404 || status === 500 || status === 503) {
                    continue;
                }
                break;
            }
        }

        if (explanation) {
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

            await sock.sendMessage(jid, { text: message }, { quoted: m });
            await m.react('✅');
            return;
        }

        // 4. Manejo de errores amigables
        await m.react('❌');
        const statusCode = lastError?.response?.status;

        if (statusCode === 401) {
            return await sock.sendMessage(jid, {
                text: '❌ La API Key de Groq configurada es inválida o ha expirado. Por favor, revísala en el archivo .env.'
            }, { quoted: m });
        }

        if (statusCode === 429) {
            return await sock.sendMessage(jid, {
                text: '⚠️ Límite de peticiones alcanzado en Groq API (Rate Limit). Por favor espera un momento antes de enviar otra consulta.'
            }, { quoted: m });
        }

        if (statusCode === 500 || statusCode === 503) {
            return await sock.sendMessage(jid, {
                text: '⚠️ El servidor de Groq no está disponible en este momento debido a alta demanda. Inténtalo más tarde.'
            }, { quoted: m });
        }

        if (lastError?.code === 'ECONNABORTED' || lastError?.message?.includes('timeout')) {
            return await sock.sendMessage(jid, {
                text: '⚠️ La consulta enciclopédica tardó más de 20 segundos en responder. Por favor intenta de nuevo.'
            }, { quoted: m });
        }

        const errMsg = lastError?.response?.data?.error?.message || lastError?.message || 'Error de servicio';
        logger.error('[WIKI ERROR]:', errMsg);
        await sock.sendMessage(jid, {
            text: `❌ No fue posible obtener la explicación enciclopédica para "*${query}*": ${errMsg}`
        }, { quoted: m });
    }
};
