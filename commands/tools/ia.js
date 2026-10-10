const axios = require('axios');
const config = require('../../config');

const SYSTEM_PROMPT = "Eres Unsk1ngMD, una IA avanzada, útil, analítica y directa creada por Castrodev. Responde en español de forma clara, precisa y adaptada a cualquier consulta sobre programación, dudas cotidianas, redacción o análisis.";

module.exports = {
    name: 'ia',
    alias: ['ai', 'ask', 'groq', 'llama'],
    category: 'herramientas',
    desc: 'Consulta Inteligencia Artificial ultrarrápida con Groq Cloud (Llama 3.3)',
    usage: '.ia [pregunta o citando un mensaje previo]',
    execute: async ({ sock, m, text }) => {
        const queryText = text || m.quoted?.body;

        // 1. Validación de entrada
        if (!queryText) {
            return await m.reply('Debes escribir una pregunta. Ejemplo: `.ia ¿Cómo funciona la memoria RAM?`');
        }

        const apiKey = process.env.GROQ_API_KEY || config.groqApiKey;

        // Comprobar configuración de la API Key
        if (!apiKey || apiKey.trim() === '') {
            return await m.reply('❌ No se ha configurado la clave de API de Groq.\nPor favor, añade `GROQ_API_KEY=tu_clave_aqui` en el archivo `.env`. Puedes obtener una clave gratuita en: https://console.groq.com/keys');
        }

        await m.react('⚡');

        // 2. Construir historial de mensajes y mantener contexto
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT }
        ];

        // Soporte de contexto si el usuario cita una respuesta previa
        if (m.quoted && m.quoted.body) {
            const cleanQuoted = m.quoted.body.replace(/^🤖\s*\*Unsk1ngMD AI:\*\s*\n\n/i, '').trim();
            if (m.quoted.fromMe) {
                messages.push({ role: 'assistant', content: cleanQuoted });
            } else {
                messages.push({ role: 'user', content: `Contexto previo citado: "${cleanQuoted}"` });
            }
        }

        messages.push({ role: 'user', content: text || queryText });

        const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
        
        // Modelos candidatos en orden de prioridad:
        // 1. Modelo especificado en variable de entorno (si existe)
        // 2. llama-3.3-70b-versatile (Requerido por defecto)
        // 3. Fallbacks de alta disponibilidad en caso de 404 (tier/acceso) o 429/503 (sobrecarga)
        const candidateModels = [
            process.env.GROQ_MODEL,
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant',
            'openai/gpt-oss-120b',
            'openai/gpt-oss-20b'
        ].filter(Boolean);

        // Deduplicar lista de modelos
        const uniqueModels = [...new Set(candidateModels)];

        // 3. Petición HTTP a Groq Cloud con reintento ante fallos de modelo
        let replyText = null;
        let lastError = null;

        for (const model of uniqueModels) {
            try {
                const response = await axios.post(
                    endpoint,
                    {
                        model: model,
                        messages: messages,
                        temperature: 0.6,
                        max_tokens: 1500
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${apiKey.trim()}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 30000
                    }
                );

                replyText = response.data?.choices?.[0]?.message?.content?.trim();
                if (replyText) {
                    break; // Respuesta obtenida exitosamente
                }
            } catch (err) {
                lastError = err;
                const status = err.response?.status;

                // Si es error 401 (Credencial inválida o expirada), no tiene sentido probar más modelos
                if (status === 401) {
                    break;
                }

                // Si es 404 (modelo no disponible en este tier de cuenta), 429 o 503, intentar con el siguiente modelo
                if (status === 404 || status === 429 || status === 503) {
                    continue;
                }

                // Para otros errores no recuperables, romper ciclo
                break;
            }
        }

        if (replyText) {
            try {
                // 4. Devolver la respuesta directamente como texto citado al mensaje original
                await m.reply(replyText);
                await m.react('✅');
            } catch (replyErr) {
                console.error('[IA] Error al enviar mensaje:', replyErr.message);
            }
            return;
        }

        // 5. Manejo específico y amigable de códigos de error HTTP
        await m.react('❌');
        const statusCode = lastError?.response?.status;

        if (statusCode === 401) {
            return await m.reply('❌ *Error de autenticación (401):* La clave `GROQ_API_KEY` es inválida o ha expirado. Por favor, revísala en https://console.groq.com/keys');
        }

        if (statusCode === 429) {
            return await m.reply('⚠️ *Límite de peticiones alcanzado (429):* Has alcanzado la cuota de peticiones por minuto de Groq Cloud. Por favor, espera unos segundos antes de consultar nuevamente.');
        }

        if (statusCode === 500 || statusCode === 503) {
            return await m.reply('⚠️ *Servicio de Groq temporalmente no disponible:* Los servidores de inferencia están experimentando alta demanda. Intenta de nuevo en un momento.');
        }

        const errMsg = lastError?.response?.data?.error?.message || lastError?.message || 'Error desconocido';
        await m.reply(`❌ Ocurrió un error al procesar tu solicitud con Groq: ${errMsg}`);
    }
};
