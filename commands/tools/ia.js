const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const axios = require('axios');
const config = require('../../config');
const logger = require('../../lib/logger');

const SYSTEM_PROMPT = "Eres Unsk1ngMD, una IA avanzada, analítica, directa y cordial creada por Unknown Codexツ</>. Responde en español de forma concisa, clara y estructurada a cualquier consulta sobre programación, dudas cotidianas, redacción o ciencia.";

module.exports = {
    name: 'ia',
    alias: ['ai', 'ask', 'groq', 'llama'],
    category: 'herramientas',
    desc: 'Consulta Inteligencia Artificial ultrarrápida con Groq Cloud (GPT-OSS / Llama)',
    usage: '.ia [pregunta o citando un mensaje previo]',
    execute: async ({ sock, m, text }) => {
        const jid = m.chat;
        const queryText = text?.trim() || m.quoted?.body?.trim();

        // 1. Validación de entrada
        if (!queryText) {
            return await sock.sendMessage(jid, {
                text: '❌ Debes escribir una pregunta. Ejemplo: `.ia ¿Cómo funciona la memoria RAM?`'
            }, { quoted: m });
        }

        // 2. Obtención de API Key de Groq si está disponible
        let apiKey = (process.env.GROQ_API_KEY || config.groqApiKey || '').trim();
        if (!apiKey) {
            try {
                const envPath = path.resolve(__dirname, '../../.env');
                if (fs.existsSync(envPath)) {
                    const envContent = fs.readFileSync(envPath, 'utf8');
                    const mKey = envContent.match(/^GROQ_API_KEY=(.*)$/m);
                    if (mKey) apiKey = mKey[1].trim();
                }
            } catch (_) {}
        }

        await m.react('⚡');

        // 3. Construir mensajes manteniendo contexto si se cita una respuesta
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT }
        ];

        if (m.quoted && m.quoted.body) {
            const cleanQuoted = m.quoted.body.replace(/^🤖\s*\*Unsk1ngMD AI:\*\s*\n\n/i, '').trim();
            if (m.quoted.fromMe) {
                messages.push({ role: 'assistant', content: cleanQuoted });
            } else {
                messages.push({ role: 'user', content: `Contexto citado: "${cleanQuoted}"` });
            }
        }

        messages.push({ role: 'user', content: queryText });

        let replyText = null;
        let lastError = null;

        // 4. Intentar con Groq Cloud si la clave está configurada
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
                            messages,
                            temperature: 0.6,
                            max_tokens: 1500
                        },
                        {
                            headers: {
                                'Authorization': `Bearer ${apiKey}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 10000
                        }
                    );

                    replyText = response.data?.choices?.[0]?.message?.content?.trim();
                    if (replyText) break;
                } catch (err) {
                    lastError = err;
                    const status = err.response?.status;
                    if (status === 401) break; // Si expiró o es inválida, pasar al fallback
                    if (status === 429 || status === 404 || status === 500 || status === 503) {
                        continue;
                    }
                    break;
                }
            }
        }

        // 5. Fallback automático a IA secundaria (sin necesidad de API Key) si Groq falló o se desconectó
        if (!replyText) {
            try {
                const fbRes = await axios.post(
                    'https://text.pollinations.ai/',
                    {
                        messages,
                        model: 'openai',
                        temperature: 0.7
                    },
                    { timeout: 15000 }
                );

                const fbContent = typeof fbRes.data === 'string'
                    ? fbRes.data.trim()
                    : fbRes.data?.choices?.[0]?.message?.content?.trim();

                if (fbContent) {
                    replyText = fbContent;
                }
            } catch (fbErr) {
                logger.warn('[IA FALLBACK WARN]:', fbErr.message);
            }
        }

        // 6. Enviar respuesta si se obtuvo por Groq o por Fallback
        if (replyText) {
            try {
                const finalMsg = `${replyText}\n\n_Unknown Codexツ</>_`;
                await sock.sendMessage(jid, { text: finalMsg }, { quoted: m });
                await m.react('✅');
            } catch (sendErr) {
                logger.error('[IA SEND ERROR]:', sendErr.message);
            }
            return;
        }

        // 7. Si ambos métodos fallaron por problemas de red extremos
        await m.react('❌');
        const errMsg = lastError?.response?.data?.error?.message || lastError?.message || 'Error de conexión';
        logger.error('[IA ERROR]:', errMsg);
        await sock.sendMessage(jid, {
            text: `❌ No fue posible procesar la consulta en este momento (${errMsg}). Intenta de nuevo en unos segundos.\n\n_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};
