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

        // 2. Obtención de API Key de Groq si está disponible
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

        await m.react('📚');

        let explanation = null;
        let lastError = null;

        // 3. Capa 1: Intentar con Groq Cloud si la API Key está presente
        if (apiKey) {
            const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
            const candidateModels = [
                process.env.GROQ_MODEL?.trim(),
                'openai/gpt-oss-20b',
                'qwen/qwen3.8-27b',
                'openai/gpt-oss-120b',
                config.groqModel
            ].filter(Boolean);

            const uniqueModels = [...new Set(candidateModels)];

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
                            timeout: 10000
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
        }

        // 4. Capa 2: API oficial de Wikipedia REST (Ultra rápida y enciclopédica)
        if (!explanation) {
            try {
                const wikiRes = await axios.get(
                    `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
                    {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                        timeout: 5000
                    }
                );
                if (wikiRes.data && wikiRes.data.extract) {
                    const desc = wikiRes.data.description ? `*(${wikiRes.data.description})*\n\n` : '';
                    explanation = `${desc}${wikiRes.data.extract.trim()}`;
                }
            } catch (_) {}
        }

        // 5. Capa 3: Fallback a IA secundaria (Pollinations AI)
        if (!explanation) {
            try {
                const fbRes = await axios.post(
                    'https://text.pollinations.ai/',
                    {
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            { role: 'user', content: query }
                        ],
                        model: 'openai',
                        temperature: 0.5
                    },
                    { timeout: 15000 }
                );

                const fbContent = typeof fbRes.data === 'string'
                    ? fbRes.data.trim()
                    : fbRes.data?.choices?.[0]?.message?.content?.trim();

                if (fbContent) {
                    explanation = fbContent;
                }
            } catch (fbErr) {
                logger.warn('[WIKI FALLBACK WARN]:', fbErr.message);
            }
        }

        // 6. Enviar resultado formateado si se obtuvo por cualquiera de las capas
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
└─────────────────────────────
_Unknown Codexツ</>_`;

            await sock.sendMessage(jid, { text: message }, { quoted: m });
            await m.react('✅');
            return;
        }

        // 7. En caso extremo de desconexión total a internet
        await m.react('❌');
        const errMsg = lastError?.response?.data?.error?.message || lastError?.message || 'Error de conexión';
        logger.error('[WIKI ERROR]:', errMsg);
        await sock.sendMessage(jid, {
            text: `❌ No fue posible obtener la explicación enciclopédica para "*${query}*" en este momento. Inténtalo de nuevo.\n\n_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};
