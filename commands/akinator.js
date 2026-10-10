require('dotenv').config();
const axios = require('axios');
const logger = require('../lib/logger');

// Asegurar inicialización global en memoria
global.akinatorSessions = global.akinatorSessions || new Map();

// Modelos Groq ordenados por disponibilidad y compatibilidad
const CANDIDATE_MODELS = [
    process.env.GROQ_MODEL,
    'openai/gpt-oss-120b',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-20b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant'
].filter(Boolean);

const SYSTEM_PROMPT =
`Eres el genio Akinator en español. El usuario está pensando en un personaje real o ficticio (celebridad, anime, cine, videojuegos, historia, etc.).
Tu objetivo es adivinarlo haciéndole preguntas precisas de eliminación.
En cada turno el usuario responderá estrictamente con una de estas 5 opciones:
1 = Sí
2 = No
3 = No sé
4 = Probablemente sí
5 = Probablemente no

Reglas:
1. Formula una sola pregunta a la vez, concisa y directa en español.
2. Si tienes certeza alta (más del 80%) o si ya llevas entre 10 y 14 preguntas, debes emitir tu adivinanza final.
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
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
        throw new Error('GROQ_API_KEY no configurada');
    }

    let lastError = null;

    for (const model of CANDIDATE_MODELS) {
        try {
            const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model,
                messages,
                response_format: { type: 'json_object' },
                temperature: 0.6
            }, {
                headers: {
                    Authorization: `Bearer ${apiKey.trim()}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });

            const content = res.data?.choices?.[0]?.message?.content;
            if (content) {
                return JSON.parse(content);
            }
        } catch (err) {
            lastError = err;
            const status = err.response?.status;
            if (status === 401) break; // Token inválido, no reintentar
        }
    }

    throw lastError || new Error('No se pudo obtener respuesta de Akinator AI');
};

/**
 * Intenta obtener la imagen oficial del personaje desde la API REST de Wikipedia
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
 * Configura o reinicia el temporizador de inactividad de 60 segundos
 */
const setSessionTimeout = (sock, chatId) => {
    return setTimeout(async () => {
        if (global.akinatorSessions && global.akinatorSessions.has(chatId)) {
            global.akinatorSessions.delete(chatId);
            try {
                await sock.sendMessage(chatId, {
                    text: '🧞‍♂️ *[AKINATOR]* El juego ha finalizado por inactividad (60 segundos sin responder).'
                });
            } catch (_) {}
        }
    }, 60000);
};

/**
 * Inicia una nueva partida de Akinator en el chat
 */
const startGame = async (sock, m) => {
    const chatId = m.chat;

    if (global.akinatorSessions && global.akinatorSessions.has(chatId)) {
        return await m.reply(
            '⚠️ Ya hay una partida de Akinator activa en este chat.\n' +
            'Responde a la pregunta actual o escribe *.cancelakinator* para reiniciar.'
        );
    }

    await m.reply('🧞‍♂️ *[AKINATOR - EL GENIO]*\n\n🔮 _Piensa en un personaje real o ficticio. Conéctate mentalmente... Preparando la primera pregunta..._');

    const initialMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: 'Inicia el juego. Formula la pregunta número 1.' }
    ];

    try {
        const aiResponse = await queryAkinatorAI(initialMessages);

        if (!aiResponse || !aiResponse.pregunta) {
            throw new Error('Respuesta inicial de Akinator inválida');
        }

        const session = {
            chatId,
            player: m.sender,
            step: 1,
            isProcessing: false, // Bloqueo de respuestas concurrentes
            timeout: setSessionTimeout(sock, chatId),
            aki: {
                messages: [
                    ...initialMessages,
                    { role: 'assistant', content: JSON.stringify(aiResponse) }
                ],
                lastQuestion: aiResponse.pregunta,
                progress: aiResponse.progreso || 5
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
        await m.reply('❌ La sesión de Akinator expiró o no pudo completarse. Intenta de nuevo con .akinator');
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
        await m.reply('🧞‍♂️ *[AKINATOR]* Partida cancelada con éxito. ¡Vuelve cuando quieras!');
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
        // Si el usuario citó expresamente el mensaje del bot o envió un número inválido
        const isReplyingToBot = m.quoted && m.quoted.fromMe;
        const isSingleDigit = /^[0-9]$/.test(body);

        if (isReplyingToBot || isSingleDigit) {
            await m.reply(
                '⚠️ *[AKINATOR]* Opción no válida.\n' +
                'Por favor responde únicamente con un número del *1 al 5*:\n\n' +
                '1️⃣ Sí | 2️⃣ No | 3️⃣ No sé\n' +
                '4️⃣ Probablemente sí | 5️⃣ Probablemente no\n\n' +
                '_(Escribe *cancelar* para terminar el juego)_'
            );
            return true;
        }
        return false;
    }

    // 3. Bloqueo de respuestas simultáneas para evitar condiciones de carrera
    if (session.isProcessing) {
        return true; // Mensaje ignorado mientras se procesa la solicitud previa
    }
    session.isProcessing = true;

    // 4. Renovar temporizador de inactividad
    if (session.timeout) clearTimeout(session.timeout);
    session.timeout = setSessionTimeout(sock, chatId);

    session.step += 1;
    session.aki.messages.push({
        role: 'user',
        content: `El usuario respondió: ${answerText}. Formula la siguiente pregunta o tu adivinanza final.`
    });

    await m.react('🔮');

    try {
        const aiResponse = await queryAkinatorAI(session.aki.messages);
        session.aki.messages.push({ role: 'assistant', content: JSON.stringify(aiResponse) });

        const isGuess = aiResponse.tipo === 'adivinanza' || (aiResponse.progreso && aiResponse.progreso >= 80) || session.step >= 15;

        // Caso: Fin del juego / Akinator adivina el personaje
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

        // Siguiente pregunta diagnóstica
        const progress = Math.min(95, aiResponse.progreso || (session.step * 7));
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
        logger.error('Error procesando respuesta en Akinator:', err.message);
        if (session.timeout) clearTimeout(session.timeout);
        global.akinatorSessions.delete(chatId);

        await m.reply('❌ La sesión de Akinator expiró o no pudo completarse. Intenta de nuevo con .akinator');
        return true;
    } finally {
        if (global.akinatorSessions.has(chatId)) {
            const current = global.akinatorSessions.get(chatId);
            if (current) current.isProcessing = false;
        }
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
    return global.akinatorSessions && global.akinatorSessions.has(chatId);
};

// Exportación modular para commandLoader y messageHandler
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
        execute: async ({ m }) => {
            const cancelled = cancelGame(m.chat);
            if (cancelled) {
                await m.reply('🧞‍♂️ La partida de Akinator ha sido cancelada.');
            } else {
                await m.reply('ℹ️ No hay ninguna partida de Akinator activa en este chat.');
            }
        }
    }
];

// Vincular métodos al objeto exportado para interoperabilidad con messageHandler y lib/akinator
commands.hasActiveGame = hasActiveGame;
commands.checkAnswer = checkAnswer;
commands.startGame = startGame;
commands.cancelGame = cancelGame;

module.exports = commands;

