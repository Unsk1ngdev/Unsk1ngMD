'use strict';

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const axios = require('axios');
const config = require('../../config');
const logger = require('../../lib/logger');

const SYSTEM_PROMPT = `Eres un asistente analítico especializado en síntesis documental de alto nivel.
Tu tarea es leer el texto provisto y generar un resumen estructurado en español claro, profesional y conciso.
Respeta estrictamente esta estructura con formato de WhatsApp:

📌 *IDEA CENTRAL*
(1 o 2 oraciones con el mensaje fundamental del texto).

📝 *PUNTOS CLAVE*
• (Punto relevante 1)
• (Punto relevante 2)
• (Punto relevante 3 si aplica)

💡 *CONCLUSIÓN / TL;DR*
(Un remate conciso con la conclusión o takeaway principal).`;

/**
 * Generador de resumen extractivo local en caso de fallo total de red externa
 */
function localSummaryFallback(rawText) {
    const sentences = rawText
        .split(/(?<=[.?!])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 20);

    if (sentences.length === 0) {
        return `📌 *IDEA CENTRAL*\n${rawText.slice(0, 150)}...\n\n💡 *TL;DR*\nTexto breve sintetizado.`;
    }

    const firstSentence = sentences[0];
    const keyBullets = sentences.slice(1, 4).map(s => `• ${s}`).join('\n') || `• ${sentences[0]}`;
    const lastSentence = sentences.length > 1 ? sentences[sentences.length - 1] : sentences[0];

    return [
        '📌 *IDEA CENTRAL*',
        firstSentence,
        '',
        '📝 *PUNTOS CLAVE*',
        keyBullets,
        '',
        '💡 *CONCLUSIÓN / TL;DR*',
        lastSentence
    ].join('\n');
}

module.exports = {
    name: 'resumir',
    alias: ['resumen', 'summarize', 'tldr'],
    category: 'herramientas',
    desc: 'Resume un texto largo pegado o citado con puntos clave y conclusión ejecutiva',
    usage: '.resumir [texto o citando un mensaje largo]',

    execute: async ({ sock, m, text }) => {
        const jid = m.chat || m.key.remoteJid;
        const targetText = text?.trim() || m.quoted?.body?.trim() || m.quoted?.text?.trim() || '';

        // 1. Validación de longitud mínima
        if (!targetText || targetText.length < 35) {
            return await sock.sendMessage(jid, {
                text: [
                    '📑 *[SISTEMA DE RESUMEN INTELIGENTE]* 📑',
                    '',
                    'Debes proporcionar un texto de suficiente longitud para poder resumirlo.',
                    '',
                    '👉 *Formas de uso:*',
                    '• Citando (respondiendo) a un mensaje largo con `.resumir`',
                    '• Escribiendo: `.resumir [pega aquí una noticia, artículo o mensaje largo]`',
                    '',
                    '⚠️ _Mínimo requerido: al menos 35 caracteres._',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        try {
            await m.react('📑');
        } catch (_) {}

        // 2. Obtener clave de Groq si está disponible
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

        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Por favor resume el siguiente texto de forma fiel y directa:\n\n"""${targetText}"""` }
        ];

        let summaryResult = null;

        // 3. Intento con Groq Cloud
        if (apiKey) {
            const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
            const models = ['llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'llama-3.1-8b-instant'];

            for (const model of models) {
                try {
                    const response = await axios.post(
                        endpoint,
                        {
                            model,
                            messages,
                            temperature: 0.3,
                            max_tokens: 1000
                        },
                        {
                            headers: {
                                'Authorization': `Bearer ${apiKey}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 12000
                        }
                    );

                    summaryResult = response.data?.choices?.[0]?.message?.content?.trim();
                    if (summaryResult) break;
                } catch (err) {
                    if (err.response?.status === 401) break;
                }
            }
        }

        // 4. Fallback a IA secundaria gratuita (Pollinations)
        if (!summaryResult) {
            try {
                const fbRes = await axios.post(
                    'https://text.pollinations.ai/',
                    {
                        messages,
                        model: 'openai',
                        temperature: 0.4
                    },
                    { timeout: 15000 }
                );

                const fbContent = typeof fbRes.data === 'string'
                    ? fbRes.data.trim()
                    : fbRes.data?.choices?.[0]?.message?.content?.trim();

                if (fbContent) {
                    summaryResult = fbContent;
                }
            } catch (fbErr) {
                logger.warn('[RESUMIR FALLBACK]:', fbErr.message);
            }
        }

        // 5. Fallback local si no hay conexión a internet
        if (!summaryResult) {
            summaryResult = localSummaryFallback(targetText);
        }

        try {
            await m.react('✅');
        } catch (_) {}

        const wordsCount = targetText.trim().split(/\s+/).length;

        const output = [
            '╔══════════════════════════╗',
            '║   📑 *RESUMEN EJECUTIVO*  ║',
            '╚══════════════════════════╝',
            `📊 _Texto original: ~${wordsCount} palabras_`,
            '━━━━━━━━━━━━━━━━━━━━━━',
            summaryResult,
            '━━━━━━━━━━━━━━━━━━━━━━',
            '_Unknown Codexツ</>_'
        ].join('\n');

        return await sock.sendMessage(jid, { text: output }, { quoted: m });
    }
};

