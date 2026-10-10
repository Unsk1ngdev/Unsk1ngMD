const fs = require('fs-extra');
const path = require('path');

const TRIVIA_FILE = path.join(__dirname, '../data/trivia.json');

const DEFAULT_TRIVIA = [
    {
        id: 1,
        categoria: "Tecnología",
        pregunta: "¿En qué año lanzó Linus Torvalds la primera versión oficial del kernel de Linux?",
        opciones: ["A) 1989", "B) 1991", "C) 1995", "D) 1998"],
        correcta: "B"
    }
];

const loadTriviaQuestions = () => {
    try {
        if (fs.existsSync(TRIVIA_FILE)) {
            const data = fs.readJsonSync(TRIVIA_FILE);
            if (Array.isArray(data) && data.length > 0) {
                return data;
            }
        }
    } catch (err) {
        console.error('[TRIVIA] Error leyendo data/trivia.json:', err.message);
    }
    return DEFAULT_TRIVIA;
};

// Map de sesiones activas: chatId => { item, optObj, timeout, startedAt }
const activeSessions = new Map();

/**
 * Normaliza cadenas para comparaciones flexibles
 */
const cleanText = (str) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'¡¿]/g, '')
        .trim();
};

/**
 * Normaliza opciones tanto si vienen en array ["A) ...", "B) ..."] como en objeto { A: "...", B: "..." }
 */
const normalizeOptions = (opciones) => {
    if (Array.isArray(opciones)) {
        const obj = {};
        for (const opt of opciones) {
            const match = opt.match(/^([A-Da-d])[\)\.\:\-]\s*(.*)$/);
            if (match) {
                obj[match[1].toUpperCase()] = match[2].trim();
            } else {
                const keys = ['A', 'B', 'C', 'D'];
                const nextKey = keys[Object.keys(obj).length] || 'A';
                obj[nextKey] = opt.trim();
            }
        }
        return obj;
    }
    return opciones || {};
};

const triviaManager = {
    /**
     * Verifica si hay una trivia en curso en el chat
     */
    hasActiveGame: (chatId) => {
        return activeSessions.has(chatId);
    },

    /**
     * Inicia una nueva ronda de trivia con temporizador de 45 segundos
     */
    startGame: async (sock, m) => {
        const chatId = m.chat;

        if (activeSessions.has(chatId)) {
            return await m.reply('⚠️ Ya hay una trivia activa en este chat. Envía tu respuesta (A, B, C o D) o espera a que finalice.');
        }

        const questions = loadTriviaQuestions();
        const item = questions[Math.floor(Math.random() * questions.length)];
        const optObj = normalizeOptions(item.opciones);

        // Temporizador estricto de 45 segundos
        const timeout = setTimeout(async () => {
            if (activeSessions.has(chatId)) {
                activeSessions.delete(chatId);
                const correctaKey = item.correcta.toUpperCase();
                const correctaVal = optObj[correctaKey] || '';
                await sock.sendMessage(chatId, {
                    text:
                        `⏰ *¡TIEMPO AGOTADO!*\n\n` +
                        `Nadie respondió correctamente dentro de los 45 segundos.\n` +
                        `💡 *La opción correcta era:* *${correctaKey}) ${correctaVal}*`
                });
            }
        }, 45000);

        activeSessions.set(chatId, {
            item,
            optObj,
            timeout,
            startedAt: Date.now()
        });

        const catHeader = item.categoria ? `🏷️ *Categoría:* ${item.categoria}\n` : '';
        const promptText =
            `🧠 *TRIVIA DE CONOCIMIENTO - UNSK1NGMD* 🧠\n` +
            catHeader + `\n` +
            `❓ *Pregunta:* ${item.pregunta}\n\n` +
            `🇦 *A)* ${optObj.A || ''}\n` +
            `🇧 *B)* ${optObj.B || ''}\n` +
            `🇨 *C)* ${optObj.C || ''}\n` +
            `🇩 *D)* ${optObj.D || ''}\n\n` +
            `⏳ Tienes *45 segundos* para responder en el chat.\n` +
            `💡 _Envía únicamente la letra de tu elección (A, B, C o D)._`;

        await sock.sendMessage(chatId, { text: promptText }, { quoted: m });
    },

    /**
     * Evalúa si el mensaje recibido corresponde a la respuesta de la trivia
     */
    checkAnswer: async (sock, m) => {
        const chatId = m.chat;
        const session = activeSessions.get(chatId);
        if (!session) return false;

        const body = (m.body || '').trim();
        if (!body) return false;

        const clean = cleanText(body);
        if (!clean) return false;

        const { item, optObj = normalizeOptions(item.opciones) } = session;
        const targetKey = item.correcta.toUpperCase();
        const targetAnswerText = cleanText(optObj[targetKey] || '');

        // Detección de letra de opción
        let chosenLetter = null;

        // Comprobar formato directo "a", "b", "c", "d"
        if (['a', 'b', 'c', 'd'].includes(clean)) {
            chosenLetter = clean.toUpperCase();
        } else {
            // Comprobar variaciones como "opcion a", "la a", ".a", "es la a"
            const match = clean.match(/^(?:opcion|la|el|es\s+la|es\s+el|\.|\/)?\s*([abcd])\b/i);
            if (match) {
                chosenLetter = match[1].toUpperCase();
            } else if (clean === targetAnswerText) {
                // El usuario escribió el texto completo de la opción correcta
                chosenLetter = targetKey;
            }
        }

        if (!chosenLetter) {
            return false;
        }

        if (chosenLetter === targetKey) {
            clearTimeout(session.timeout);
            activeSessions.delete(chatId);

            const winnerTag = m.sender.split('@')[0];
            const answerTitle = optObj[targetKey] || '';

            await sock.sendMessage(chatId, {
                text:
                    `🎉 *¡RESPUESTA CORRECTA!*\n\n` +
                    `👑 @${winnerTag} ha acertado la trivia.\n` +
                    `✅ *Opción:* *${targetKey}) ${answerTitle}*\n\n` +
                    `¡Excelente velocidad mental! ⚡`,
                mentions: [m.sender]
            }, { quoted: m });

            return true;
        } else {
            // Opción incorrecta enviada expresamente
            if (['A', 'B', 'C', 'D'].includes(chosenLetter)) {
                const wrongText = `❌ *Incorrecto.* La opción *${chosenLetter}* no es la correcta. ¡Sigue intentando!`;
                if (typeof m.reply === 'function') {
                    await m.reply(wrongText);
                } else {
                    await sock.sendMessage(chatId, { text: wrongText });
                }
            }
            return false;
        }
    }
};

module.exports = triviaManager;
