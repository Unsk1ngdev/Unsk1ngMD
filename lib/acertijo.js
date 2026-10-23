const path = require('path');
const fs = require('fs-extra');
const economy = require('./economy');
const userNames = require('./userNames');

const ACERTIJOS_PATH = path.join(__dirname, '../data/acertijos.json');

// Lista de respaldo en caso de que el archivo JSON no esté disponible
const DEFAULT_ACERTIJOS = [
    {
        pregunta: "Oro parece, plata no es. Quien no lo adivine, bien tonto es.",
        respuestas: ["platano", "el platano", "banana", "la banana", "cambur", "el cambur"],
        displayRespuesta: "El plátano 🍌"
    },
    {
        pregunta: "Blanca por dentro, verde por fuera. Si quieres que te lo diga, espera.",
        respuestas: ["pera", "la pera"],
        displayRespuesta: "La pera 🍐"
    },
    {
        pregunta: "Tengo agujas pero no sé coser, tengo números pero no sé leer. ¿Qué soy?",
        respuestas: ["reloj", "el reloj"],
        displayRespuesta: "El reloj ⌚"
    }
];

/**
 * Carga la base de acertijos desde data/acertijos.json
 */
const loadAcertijos = () => {
    try {
        if (fs.existsSync(ACERTIJOS_PATH)) {
            const data = fs.readJsonSync(ACERTIJOS_PATH);
            if (Array.isArray(data) && data.length > 0) {
                return data;
            }
        }
    } catch (err) {
        console.error('[ACERTIJOS] Error leyendo data/acertijos.json:', err.message);
    }
    return DEFAULT_ACERTIJOS;
};

// Almacenamiento en memoria de sesiones activas por chatId
const activeSessions = new Map();

/**
 * Limpia y normaliza texto: minúsculas, sin tildes/diacríticos y sin signos de puntuación
 */
const cleanText = (str) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remover acentos y tildes
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'¡¿]/g, '') // Remover signos de puntuación
        .trim();
};

const acertijoManager = {
    /**
     * Comprueba si hay un juego activo en el chat
     */
    hasActiveGame: (chatId) => {
        return activeSessions.has(chatId);
    },

    /**
     * Cancela la partida activa de acertijo en el chat
     */
    cancelGame: (chatId) => {
        if (activeSessions.has(chatId)) {
            const session = activeSessions.get(chatId);
            if (session?.timeout) clearTimeout(session.timeout);
            activeSessions.delete(chatId);
            return true;
        }
        return false;
    },

    /**
     * Inicia una nueva partida de acertijo con temporizador de 60 segundos
     */
    startGame: async (sock, m) => {
        const chatId = m.chat;

        if (activeSessions.has(chatId)) {
            return await m.reply('⚠️ Ya hay un acertijo activo en este chat. Adivínalo o espera a que finalicen los 60 segundos.');
        }

        const riddles = loadAcertijos();
        const riddle = riddles[Math.floor(Math.random() * riddles.length)];

        // Respuestas en formato array homogéneo
        const respuestasList = Array.isArray(riddle.respuestas)
            ? riddle.respuestas
            : [riddle.respuesta || ''];

        // Configurar temporizador de 60 segundos por chat
        const timeout = setTimeout(async () => {
            if (activeSessions.has(chatId)) {
                activeSessions.delete(chatId);
                await sock.sendMessage(chatId, {
                    text: `⏰ *¡SE ACABÓ EL TIEMPO!*\n\nNadie logró adivinar el acertijo.\n💡 *La respuesta correcta era:* *${riddle.displayRespuesta || respuestasList[0]}*`
                });
            }
        }, 60000);

        // Registrar sesión activa
        activeSessions.set(chatId, {
            pregunta: riddle.pregunta,
            respuestas: respuestasList,
            displayRespuesta: riddle.displayRespuesta || respuestasList[0],
            timeout,
            activo: true,
            iniciado: Date.now()
        });

        const promptText =
            `🧩 *JUEGO DE ACERTIJOS - UNSK1NGMD*\n\n` +
            `❓ *Acertijo:* "${riddle.pregunta}"\n\n` +
            `💰 *Premio de partida:* +$200 monedas | ⚡ +100 EXP\n` +
            `⏳ Tienes *60 segundos* para responder directamente en el chat.\n` +
            `_Escribe tu respuesta sin prefijos para participar._`;

        await sock.sendMessage(chatId, { text: promptText }, { quoted: m });
    },

    /**
     * Evalúa las respuestas de los usuarios sin frustraciones por ortografía
     */
    checkAnswer: async (sock, m) => {
        const chatId = m.chat;
        const session = activeSessions.get(chatId);
        if (!session) return false;

        const userText = m.body ? m.body.trim() : '';

        // Ignorar mensajes vacíos o que parezcan comandos
        if (!userText || userText.startsWith('.') || userText.startsWith('/') || userText.startsWith('!') || userText.startsWith('#')) {
            return false;
        }

        const cleanInput = cleanText(userText);
        if (!cleanInput) return false;

        // Opción de cancelar la partida
        if (cleanInput === 'cancelar' || cleanInput === 'cancelacertijo') {
            clearTimeout(session.timeout);
            activeSessions.delete(chatId);
            await sock.sendMessage(chatId, { text: '🧩 *[ACERTIJO]* Partida de acertijo cancelada.' }, { quoted: m });
            return true;
        }

        const userWords = cleanInput.split(/\s+/);

        // Comprobación flexible con .some() contra el array de respuestas válidas
        const isCorrect = session.respuestas.some((ans) => {
            const cleanAns = cleanText(ans);
            if (!cleanAns) return false;

            // 1. Coincidencia exacta
            if (cleanInput === cleanAns) return true;

            // 2. Coincidencia si la respuesta esperada es parte del texto ingresado
            if (cleanAns.length >= 3 && cleanInput.includes(cleanAns)) return true;

            // 3. Coincidencia por palabra individual dentro de la frase
            if (userWords.includes(cleanAns)) return true;

            // 4. Tolerancia con artículos (ej: usuario puso "platano" y respuesta esperada "el platano")
            const ansWithoutArticle = cleanAns.replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '');
            if (cleanInput === ansWithoutArticle || userWords.includes(ansWithoutArticle)) return true;

            // 5. Inverso: si el usuario puso artículo y la respuesta no lo tenía
            const inputWithoutArticle = cleanInput.replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '');
            if (inputWithoutArticle === cleanAns || inputWithoutArticle === ansWithoutArticle) return true;

            return false;
        });

        if (isCorrect) {
            clearTimeout(session.timeout);
            activeSessions.delete(chatId);

            // Recompensa económica y de experiencia
            try {
                if (economy && typeof economy.addCoins === 'function') {
                    economy.addCoins(m.sender, 200);
                }
                if (economy && typeof economy.addExp === 'function') {
                    economy.addExp(m.sender, 100);
                }
            } catch (_) {}

            const displayName = (userNames && typeof userNames.get === 'function')
                ? userNames.get(m.sender)
                : null;
            const winnerText = displayName ? `*${displayName}* (@${m.sender.split('@')[0]})` : `@${m.sender.split('@')[0]}`;

            await sock.sendMessage(chatId, {
                text: `🎉 *¡CORRECTO!* ${winnerText} ha acertado el acertijo.\n\n` +
                      `💡 *Respuesta:* *${session.displayRespuesta}*\n` +
                      `💰 *Premio de partida:* +$200 monedas | ⚡ +100 EXP`,
                mentions: [m.sender]
            }, { quoted: m });

            return true;
        } else {
            // Si el texto parece un intento genuino de respuesta (mensaje corto de 1 a 4 palabras)
            if (userWords.length <= 4 && userText.length <= 35) {
                await m.reply('❌ *Respuesta incorrecta.* ¡Sigue intentando!');
            }
            return false;
        }
    }
};

module.exports = acertijoManager;
