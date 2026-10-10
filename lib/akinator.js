require('dotenv').config();
const axios = require('axios');
const logger = require('./logger');

const activeSessions = new Map();

const CANDIDATE_MODELS = [
    'openai/gpt-oss-120b',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-20b'
];

const SYSTEM_PROMPT =
`Eres el genio Akinator en español. El usuario está pensando en un personaje real o ficticio (celebridad, anime, cine, videojuegos, historia, etc.).
Tu objetivo es adivinarlo haciéndole preguntas precisas de eliminación.
En cada turno el usuario responderá con una de estas 5 opciones:
1 = Sí
2 = No
3 = No sé
4 = Probablemente sí
5 = Probablemente no

Reglas:
1. Haz preguntas concisas y directas en español.
2. Si tienes certeza alta (más del 80%) o si ya llevas entre 10 y 14 preguntas, debes arriesgarte y emitir tu adivinanza final.
3. Devuelve SIEMPRE y ÚNICAMENTE un JSON válido con una de estas dos estructuras:

Si continúas preguntando:
{
  "tipo": "pregunta",
  "pregunta": "¿Tu personaje es de género femenino?",
  "progreso": 35
}

Si estás listo para adivinar:
{
  "tipo": "adivinanza",
  "nombre": "Nombre del Personaje",
  "descripcion": "Breve explicación de quién es",
  "progreso": 100
}`;

/**
 * Consulta la IA de Groq probando modelos disponibles
 */
const queryAkinatorAI = async (messages) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY no configurada');

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
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 20000
            });

            const content = res.data?.choices?.[0]?.message?.content;
            if (content) {
                return JSON.parse(content);
            }
        } catch (err) {
            lastError = err;
        }
    }

    throw lastError || new Error('No se pudo obtener respuesta de Akinator AI');
};

/**
 * Intenta obtener la imagen de perfil oficial del personaje desde Wikipedia
 */
const getCharacterImage = async (characterName) => {
    try {
        const cleanName = characterName.replace(/\s+/g, '_');
        const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanName)}`;
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 5000
        });
        return res.data?.thumbnail?.source || null;
    } catch (_) {
        return null;
    }
};

const akinatorManager = {
    hasActiveGame: (chatId) => activeSessions.has(chatId),

    cancelGame: (chatId) => {
        const session = activeSessions.get(chatId);
        if (session) {
            clearTimeout(session.timeout);
            activeSessions.delete(chatId);
            return true;
        }
        return false;
    },

    startGame: async (sock, m) => {
        const chatId = m.chat;

        if (activeSessions.has(chatId)) {
            return await m.reply(
                '⚠️ Ya hay una partida de Akinator en curso en este chat.\n' +
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

            const session = {
                chatId,
                player: m.sender,
                step: 1,
                messages: [
                    ...initialMessages,
                    { role: 'assistant', content: JSON.stringify(aiResponse) }
                ],
                timeout: null
            };

            // Temporizador de inactividad de 60 segundos por pregunta
            session.timeout = setTimeout(async () => {
                if (activeSessions.has(chatId)) {
                    activeSessions.delete(chatId);
                    await sock.sendMessage(chatId, {
                        text: '🧞‍♂️ *[AKINATOR]* El juego ha finalizado por inactividad (60 segundos sin responder).'
                    });
                }
            }, 60000);

            activeSessions.set(chatId, session);

            const promptText =
                `🧞‍♂️ *AKINATOR - PREGUNTA #${session.step}*\n` +
                `📊 *Progreso:* ${aiResponse.progreso || 5}%\n\n` +
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
            await m.reply('❌ No fue posible conectar con el genio Akinator en este momento. Inténtalo más tarde.');
        }
    },

    checkAnswer: async (sock, m) => {
        const chatId = m.chat;
        const session = activeSessions.get(chatId);
        if (!session) return false;

        const body = (m.body || '').trim().toLowerCase();
        if (!body) return false;

        // Comprobar cancelación voluntaria
        if (body === 'cancelar' || body === '.cancelar' || body === '.cancelakinator') {
            clearTimeout(session.timeout);
            activeSessions.delete(chatId);
            await m.reply('🧞‍♂️ *[AKINATOR]* Partida cancelada con éxito. ¡Vuelve cuando quieras!');
            return true;
        }

        // Mapeo flexible de respuestas
        const answerMap = {
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

        const answerText = answerMap[body];
        if (!answerText) {
            return false; // El mensaje no es una respuesta de Akinator
        }

        // Reiniciar temporizador de 60 segundos
        clearTimeout(session.timeout);
        session.timeout = setTimeout(async () => {
            if (activeSessions.has(chatId)) {
                activeSessions.delete(chatId);
                await sock.sendMessage(chatId, {
                    text: '🧞‍♂️ *[AKINATOR]* El juego ha finalizado por inactividad (60 segundos sin responder).'
                });
            }
        }, 60000);

        session.step += 1;
        session.messages.push({
            role: 'user',
            content: `El usuario respondió: ${answerText}. Formula la siguiente pregunta o tu adivinanza final.`
        });

        await m.react('🔮');

        try {
            const aiResponse = await queryAkinatorAI(session.messages);
            session.messages.push({ role: 'assistant', content: JSON.stringify(aiResponse) });

            if (aiResponse.tipo === 'adivinanza' || aiResponse.nombre) {
                // Akinator emite su veredicto final
                clearTimeout(session.timeout);
                activeSessions.delete(chatId);

                const charName = aiResponse.nombre;
                const charDesc = aiResponse.descripcion || '';
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
            const promptText =
                `🧞‍♂️ *AKINATOR - PREGUNTA #${session.step}*\n` +
                `📊 *Progreso:* ${Math.min(95, aiResponse.progreso || (session.step * 7))}%\n\n` +
                `❓ *${aiResponse.pregunta}*\n\n` +
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
            await m.reply('⚠️ Hubo un problema al procesar la respuesta con Akinator. Reintenta enviando el número.');
            return false;
        }
    }
};

module.exports = akinatorManager;
