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

        // 2. Validación estricta y dinámica de la API Key de Groq
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

        if (!apiKey) {
            return await sock.sendMessage(jid, {
                text: '❌ La API Key de Groq no está configurada en el archivo .env. Añade GROQ_API_KEY para habilitar esta función.'
            }, { quoted: m });
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

        const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
        const candidateModels = [
            process.env.GROQ_MODEL?.trim(),
            config.groqModel,
            'openai/gpt-oss-120b',
            'openai/gpt-oss-20b',
            'qwen/qwen3.8-27b',
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant'
        ].filter(Boolean);

        const uniqueModels = [...new Set(candidateModels)];

        let replyText = null;
        let lastError = null;

        // 4. Petición a Groq con timeout estricto de 20s y conmutación por fallo
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
                        timeout: 20000 // Timeout estricto de 20 segundos
                    }
                );

                replyText = response.data?.choices?.[0]?.message?.content?.trim();
                if (replyText) break;
            } catch (err) {
                lastError = err;
                const status = err.response?.status;
                // Si la credencial es 401 no tiene caso reintentar con otro modelo
                if (status === 401) break;
                // Si es rate-limit o 500/503 en este modelo específico, probar siguiente modelo
                if (status === 429 || status === 404 || status === 500 || status === 503) {
                    continue;
                }
                break;
            }
        }

        if (replyText) {
            try {
                await sock.sendMessage(jid, { text: replyText }, { quoted: m });
                await m.react('✅');
            } catch (sendErr) {
                logger.error('[IA SEND ERROR]:', sendErr.message);
            }
            return;
        }

        // 5. Gestión controlada de errores HTTP amigables
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
                text: '⚠️ El servicio de Groq no está disponible en este momento debido a alta demanda en sus servidores. Inténtalo más tarde.'
            }, { quoted: m });
        }

        if (lastError?.code === 'ECONNABORTED' || lastError?.message?.includes('timeout')) {
            return await sock.sendMessage(jid, {
                text: '⚠️ El servidor de Groq tardó demasiado en responder (tiempo límite de 20s agotado). Intenta de nuevo en unos segundos.'
            }, { quoted: m });
        }

        const errMsg = lastError?.response?.data?.error?.message || lastError?.message || 'Error desconocido';
        logger.error('[IA ERROR]:', errMsg);
        await sock.sendMessage(jid, {
            text: `❌ Ocurrió un error al procesar tu solicitud con Groq: ${errMsg}`
        }, { quoted: m });
    }
};
