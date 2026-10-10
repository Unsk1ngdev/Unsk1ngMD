const axios = require('axios');
const logger = require('../lib/logger');

// Almacenamiento centralizado de sesiones activas en memoria indexado por JID del chat
global.akinatorSessions = global.akinatorSessions || new Map();

const SESSION_TIMEOUT_MS = 90000; // Temporizador realista de inactividad (90 segundos)

const CANDIDATE_MODELS = [
    process.env.GROQ_MODEL?.trim(),
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'openai/gpt-oss-120b',
    'qwen/qwen3.8-27b'
].filter(Boolean);

const SYSTEM_PROMPT =
`Eres el genio Akinator en español. El usuario está pensando en un personaje real o ficticio (celebridad, anime, cine, videojuegos, historia, etc.).
Tu objetivo es adivinarlo formulando preguntas de eliminación estratégicas.
En cada turno el usuario responderá estrictamente con una de estas 5 opciones:
1 = Sí
2 = No
3 = No sé
4 = Probablemente sí
5 = Probablemente no

Reglas fundamentales:
1. Formula UNA SOLA pregunta a la vez, concisa y directa en español.
2. Si tienes certeza alta (más del 80%) o has alcanzado entre 10 y 14 preguntas, debes emitir tu adivinanza final.
3. Devuelve SIEMPRE y ÚNICAMENTE un JSON válido con una de estas dos estructuras:

Si continúas preguntando:
{
  "tipo": "pregunta",
  "pregunta": "¿Tu personaje es real?",
  "progreso": 15
}

Si estás listo para adivinar:
{
  "tipo": "adivinanza",
  "nombre": "Nombre del Personaje",
  "descripcion": "Breve descripción o profesión",
  "progreso": 100
}`;

/**
 * Consulta la IA de Groq probando modelos con formato JSON garantizado
 */
const queryAkinatorAI = async (messages) => {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
        throw new Error('GROQ_API_KEY no configurada');
    }

    const uniqueModels = [...new Set(CANDIDATE_MODELS)];
    let lastError = null;

    for (const model of uniqueModels) {
        try {
            const res = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    model,
                    messages,
                    response_format: { type: 'json_object' },
                    temperature: 0.6
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 18000 // 18 segundos por intento
                }
            );

            let content = res.data?.choices?.[0]?.message?.content?.trim();
            if (content) {
                // Eliminar posibles bloques de markdown ```json ... ```
                content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
                return JSON.parse(content);
            }
        } catch (err) {
            lastError = err;
            const status = err.response?.status;
            if (status === 401) break; // Token inválido
            if (status === 429 || status === 404 || status === 500 || status === 503) {
                continue; // Probar modelo alternativo
            }
            break;
        }
    }

    throw lastError || new Error('No se pudo contactar el servidor de Akinator AI');
};

/**
 * Reintento silencioso de red: si el primer intento falla por socket, timeout o ECONNRESET,
 * espera 800ms y reintenta automáticamente 1 vez antes de emitir error.
 */
const queryAkinatorWithRetry = async (messages) => {
    try {
        return await queryAkinatorAI(messages);
    } catch (firstErr) {
        logger.warn('[AKINATOR] Error de red en primer intento, reintentando tras 800ms:', firstErr.message);
        await new Promise((resolve) => setTimeout(resolve, 800));
        return await queryAkinatorAI(messages);
    }
};

/**
 * Obtiene la imagen oficial del personaje desde Wikipedia (opcional, no bloqueante)
 */
const getCharacterImage = async (characterName) => {
    if (!characterName) return null;
    try {
        const cleanName = characterName.replace(/\s+/g, '_');
        const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanName)}`;
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Unsk1ngMD-Bot/1.0 (Node.js; contact: castrodev)',
                'Accept': 'application/json'
            },
            timeout: 5000
        });
        return res.data?.thumbnail?.source || null;
    } catch (_) {
        return null;
    }
};

/**
 * Configura o renueva el temporizador de inactividad de 90 segundos
 */
const setSessionTimeout = (sock, chatId) => {
    return setTimeout(async () => {
        if (global.akinatorSessions && global.akinatorSessions.has(chatId)) {
            global.akinatorSessions.delete(chatId);
            try {
                await sock.sendMessage(chatId, {
                    text: '🧞‍♂️ *[AKINATOR]* La partida ha finalizado por inactividad (90 segundos sin responder).'
                });
            } catch (_) {}
        }
    }, SESSION_TIMEOUT_MS);
};

/**
 * Inicia una nueva partida de Akinator en el chat
 */
const startGame = async (sock, m) => {
    const chatId = m.chat;

    // Validación de clave de API antes de iniciar
    if (!process.env.GROQ_API_KEY?.trim()) {
        return await sock.sendMessage(chatId, {
            text: '❌ La API Key de Groq no está configurada en el archivo .env. Añade GROQ_API_KEY para habilitar esta función.'
        }, { quoted: m });
    }

    if (global.akinatorSessions && global.akinatorSessions.has(chatId)) {
        return await sock.sendMessage(chatId, {
            text: '⚠️ Ya hay una partida de Akinator activa en este chat.\nResponde a la pregunta actual o escribe *.cancelakinator* para reiniciar.'
        }, { quoted: m });
    }

    await sock.sendMessage(chatId, {
        text: '🧞‍♂️ *[AKINATOR - EL GENIO]*\n\n🔮 _Piensa en un personaje real o ficticio. Conéctate mentalmente... Preparando la primera pregunta..._'
    }, { quoted: m });

    const initialMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: 'Inicia el juego. Formula la pregunta número 1.' }
    ];

    try {
        const aiResponse = await queryAkinatorWithRetry(initialMessages);

        if (!aiResponse || !aiResponse.pregunta) {
            throw new Error('Respuesta inicial de Akinator inválida');
        }

        const session = {
            chatId,
            player: m.sender,
            step: 1,
            currentStep: 1,
            progress: aiResponse.progreso || 5,
            processing: false,    // Mutex para bloquear llamadas simultáneas
            isProcessing: false,  // Alias retrocompatible
            timeout: setSessionTimeout(sock, chatId),
            aki: {
                currentStep: 1,
                progress: aiResponse.progreso || 5,
                lastQuestion: aiResponse.pregunta,
                messages: [
                    ...initialMessages,
                    { role: 'assistant', content: JSON.stringify(aiResponse) }
                ]
            }
        };

        global.akinatorSessions.set(chatId, session);

        const promptText =
            `🧞‍♂️ *AKINATOR - PREGUNTA #${session.step}*\n` +
            `📊 *Progreso:* ${session.aki.progress}%\n\n` +
            `❓ *${aiResponse.pregunta}*\n\n` +
            `1️⃣ *1:* Sí\n` +
            `2️⃣ *2:* No\n` +
            `3️⃣ *3:* No sé\n` +
            `4️⃣ *4:* Probablemente sí\n` +
            `5️⃣ *5:* Probablemente no\n\n` +
            `💡 _Escribe únicamente el número (1 al 5) para responder._\n` +
            `_(Escribe *cancelar* para salir)_`;

        await sock.sendMessage(chatId, { text: promptText }, { quoted: m });

    } catch (err) {
        logger.error('Error al iniciar Akinator:', err.message);
        if (global.akinatorSessions.has(chatId)) {
            const s = global.akinatorSessions.get(chatId);
            if (s?.timeout) clearTimeout(s.timeout);
            global.akinatorSessions.delete(chatId);
        }
        await sock.sendMessage(chatId, {
            text: '❌ No se pudo conectar con el servidor de Akinator. Por favor intenta de nuevo con .akinator'
        }, { quoted: m });
    }
};

/**
 * Valida y procesa la respuesta del usuario para la sesión activa
 */
const checkAnswer = async (sock, m) => {
    const chatId = m.chat;
    if (!global.akinatorSessions || !global.akinatorSessions.has(chatId)) return false;

    const session = global.akinatorSessions.get(chatId);
    if (!session) return false;

    const body = (m.body || '').trim().toLowerCase();
    if (!body) return false;

    // 1. Cancelación voluntaria
    if (body === 'cancelar' || body === '.cancelar' || body === '.cancelakinator') {
        if (session.timeout) clearTimeout(session.timeout);
        global.akinatorSessions.delete(chatId);
        await sock.sendMessage(chatId, {
            text: '🧞‍♂️ *[AKINATOR]* Partida cancelada con éxito. ¡Vuelve cuando quieras!'
        }, { quoted: m });
        return true;
    }

    // 2. Validación estricta de opciones
    const validAnswers = {
        '1': '1 (Sí)',
        'si': '1 (Sí)',
        'sí': '1 (Sí)',
        '2': '2 (No)',
        'no': '2 (No)',
        '3': '3 (No sé)',
        'no se': '3 (No sé)',
        'no sé': '3 (No sé)',
        'nose': '3 (No sé)',
        '4': '4 (Probablemente sí)',
        'probablemente si': '4 (Probablemente sí)',
        'probablemente sí': '4 (Probablemente sí)',
        '5': '5 (Probablemente no)',
        'probablemente no': '5 (Probablemente no)'
    };

    const answerText = validAnswers[body];
    if (!answerText) {
        const isReplyingToBot = m.quoted && m.quoted.fromMe;
        const isSingleDigit = /^[0-9]$/.test(body);

        if (isReplyingToBot || isSingleDigit) {
            await sock.sendMessage(chatId, {
                text: '⚠️ *[AKINATOR]* Opción no válida.\nPor favor responde únicamente con un número del *1 al 5*:\n\n' +
                      '1️⃣ Sí | 2️⃣ No | 3️⃣ No sé\n' +
                      '4️⃣ Probablemente sí | 5️⃣ Probablemente no\n\n' +
                      '_(Escribe *cancelar* para salir)_'
            }, { quoted: m });
            return true;
        }
        return false;
    }

    // 3. Bloqueo de peticiones simultáneas (Mutex)
    // Si ya hay una respuesta procesándose, ignorar llamadas repetidas o concurrentes
    if (session.processing || session.isProcessing) {
        return true;
    }
    session.processing = true;
    session.isProcessing = true;

    // 4. Renovar temporizador de 90 segundos desde este momento
    if (session.timeout) clearTimeout(session.timeout);
    session.timeout = setSessionTimeout(sock, chatId);

    session.step += 1;
    session.currentStep = session.step;
    session.aki.currentStep = session.step;

    const userMessageEntry = {
        role: 'user',
        content: `El usuario respondió: ${answerText}. Formula la siguiente pregunta o tu adivinanza final.`
    };
    session.aki.messages.push(userMessageEntry);

    await m.react('🔮');

    try {
        // Ejecución con reintento automático de 800ms
        const aiResponse = await queryAkinatorWithRetry(session.aki.messages);
        session.aki.messages.push({ role: 'assistant', content: JSON.stringify(aiResponse) });

        const isGuess = aiResponse.tipo === 'adivinanza' || (aiResponse.progreso && aiResponse.progreso >= 80) || session.step >= 15;

        // Fin del juego: Akinator adivina el personaje
        if (isGuess && (aiResponse.nombre || aiResponse.tipo === 'adivinanza')) {
            if (session.timeout) clearTimeout(session.timeout);
            global.akinatorSessions.delete(chatId);

            const charName = aiResponse.nombre || 'Personaje Misterioso';
            const charDesc = aiResponse.descripcion || 'Sin descripción disponible';
            const charImg = await getCharacterImage(charName);

            const resultCard =
                `🧞‍♂️ *¡AKINATOR HA ADIVINADO!* 🧞‍♂️\n\n` +
                `🔮 *Personaje:* *${charName}*\n` +
                `📝 *Detalles:* ${charDesc}\n\n` +
                `🎯 *Preguntas requeridas:* ${session.step}\n` +
                `✨ _¿He acertado tu personaje? ¡El genio nunca falla!_`;

            if (charImg) {
                await sock.sendMessage(chatId, {
                    image: { url: charImg },
                    caption: resultCard
                }, { quoted: m });
            } else {
                await sock.sendMessage(chatId, { text: resultCard }, { quoted: m });
            }

            await m.react('🎉');
            return true;
        }

        // Actualizar y preservar estado de la sesión
        const progress = Math.min(95, aiResponse.progreso || (session.step * 7));
        session.progress = progress;
        session.aki.progress = progress;
        session.aki.lastQuestion = aiResponse.pregunta || '¿Tu personaje sigue activo?';

        const promptText =
            `🧞‍♂️ *AKINATOR - PREGUNTA #${session.step}*\n` +
            `📊 *Progreso:* ${progress}%\n\n` +
            `❓ *${session.aki.lastQuestion}*\n\n` +
            `1️⃣ *1:* Sí\n` +
            `2️⃣ *2:* No\n` +
            `3️⃣ *3:* No sé\n` +
            `4️⃣ *4:* Probablemente sí\n` +
            `5️⃣ *5:* Probablemente no\n\n` +
            `💡 _Escribe tu opción (1 al 5)._`;

        await sock.sendMessage(chatId, { text: promptText }, { quoted: m });
        await m.react('🧞‍♂️');
        return true;

    } catch (err) {
        logger.error('[AKINATOR STEP ERROR]:', err.message);

        // Revertir paso en memoria para no desfasar la sesión y permitir que el usuario reintente
        session.step -= 1;
        session.currentStep = session.step;
        session.aki.currentStep = session.step;
        if (session.aki.messages[session.aki.messages.length - 1] === userMessageEntry) {
            session.aki.messages.pop();
        }

        // NO destruir la sesión ante un error temporal de red; pedir al usuario que reenvíe su número
        await sock.sendMessage(chatId, {
            text: '⚠️ *[AKINATOR]* Ocurrió una demora temporal con el servidor de IA.\n👉 Tu partida sigue guardada. Por favor, reenvía tu número (*1 al 5*) para continuar.'
        }, { quoted: m });
        return true;

    } finally {
        session.processing = false;
        session.isProcessing = false;
    }
};

/**
 * Cancela la partida activa en un chat
 */
const cancelGame = (chatId) => {
    if (global.akinatorSessions && global.akinatorSessions.has(chatId)) {
        const session = global.akinatorSessions.get(chatId);
        if (session?.timeout) clearTimeout(session.timeout);
        global.akinatorSessions.delete(chatId);
        return true;
    }
    return false;
};

const hasActiveGame = (chatId) => {
    return Boolean(global.akinatorSessions && global.akinatorSessions.has(chatId));
};

const commands = [
    {
        name: 'akinator',
        alias: ['aki', 'adivina'],
        category: 'juegos',
        desc: 'El genio Akinator intenta adivinar el personaje real o ficticio en el que estás pensando',
        usage: '.akinator',
        execute: async ({ sock, m }) => {
            await startGame(sock, m);
        }
    },
    {
        name: 'cancelakinator',
        alias: ['stopaki', 'cancelaki'],
        category: 'juegos',
        desc: 'Cancela la sesión activa de Akinator en el chat',
        usage: '.cancelakinator',
        execute: async ({ sock, m }) => {
            const cancelled = cancelGame(m.chat);
            if (cancelled) {
                await sock.sendMessage(m.chat, {
                    text: '🧞‍♂️ La partida de Akinator ha sido cancelada.'
                }, { quoted: m });
            } else {
                await sock.sendMessage(m.chat, {
                    text: 'ℹ️ No hay ninguna partida de Akinator activa en este chat.'
                }, { quoted: m });
            }
        }
    }
];

commands.hasActiveGame = hasActiveGame;
commands.checkAnswer = checkAnswer;
commands.startGame = startGame;
commands.cancelGame = cancelGame;

module.exports = commands;
