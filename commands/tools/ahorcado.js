'use strict';

const economy = require('../../lib/economy');
const userNames = require('../../lib/userNames');

if (!global.ahorcado) {
    global.ahorcado = {};
}

const muñeco = [
    '```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```'
];

const palabras = [
    // Anime & Manga
    'naruto', 'sasuke', 'goku', 'vegeta', 'luffy', 'zoro',
    'sanji', 'kakashi', 'itachi', 'tanjiro', 'nezuko', 'gojo',
    'sukuna', 'levi', 'eren', 'mikasa', 'alphonse', 'edward',
    'bleach', 'ichigo', 'shinobi', 'hokage', 'saiyan', 'titan',
    'sharingan', 'katana', 'bankai', 'rasengan', 'kamehameha',
    // Videojuegos
    'mario', 'luigi', 'zelda', 'link', 'kratos', 'sonic',
    'minecraft', 'creeper', 'pokemon', 'pikachu', 'charizard',
    'fortnite', 'roblox', 'portal', 'fallout', 'skyrim', 'pacman',
    // Tecnología & Ciencia
    'robot', 'codigo', 'python', 'hacker', 'servidor', 'pixel',
    'satelite', 'planeta', 'galaxia', 'cometa', 'universo',
    // Términos épicos y aventura
    'dragon', 'fuego', 'fantasma', 'pirata', 'castillo', 'tesoro',
    'vampiro', 'esfinge', 'leyenda', 'hechizo', 'diamante', 'laberinto',
    'gladiador', 'tormenta', 'vikingo', 'armadura', 'escorpion', 'guerrero'
];

module.exports = [
    {
        name: 'ahorcado',
        alias: ['hangman'],
        category: 'juegos',
        desc: 'Juego del ahorcado interactivo con palabras de anime, videojuegos y cultura pop',
        usage: '.ahorcado | .ahorcado [letra o palabra] | .ahorcado stop',

        execute: async ({ sock, m, args }) => {
            const chatId = m.chat || m.key.remoteJid;
            const input = (args[0] || '').toLowerCase().trim();

            // Cancelación voluntaria
            if (input === 'stop' || input === 'cancel' || input === 'cancelar') {
                if (global.ahorcado[chatId]) {
                    delete global.ahorcado[chatId];
                    return await sock.sendMessage(chatId, {
                        text: '🧩 Partida de ahorcado cancelada con éxito.'
                    }, { quoted: m });
                }
                return await sock.sendMessage(chatId, {
                    text: 'ℹ️ No hay ninguna partida de ahorcado activa en este chat.'
                }, { quoted: m });
            }

            // 1. Proceso de adivinanza (si ya hay juego activo en el chat)
            if (global.ahorcado[chatId] && input.length >= 1) {
                const juego = global.ahorcado[chatId];

                // Caso A: Intento de adivinar la palabra completa en un solo intento
                if (input.length > 1) {
                    if (input === juego.palabra) {
                        const palabraFinal = juego.palabra.toUpperCase();
                        delete global.ahorcado[chatId];

                        // Otorgar premio de partida directo al banco
                        try {
                            if (economy && typeof economy.addGameReward === 'function') {
                                economy.addGameReward(m.sender, 350, 150, chatId);
                            } else {
                                if (economy?.addCoins) economy.addCoins(m.sender, 350);
                                if (economy?.addExp) economy.addExp(m.sender, 150);
                            }
                        } catch (_) {}

                        const displayName = (userNames && typeof userNames.get === 'function')
                            ? userNames.get(m.sender)
                            : null;
                        const winnerTag = displayName ? `*${displayName}* (@${m.sender.split('@')[0]})` : `@${m.sender.split('@')[0]}`;

                        return await sock.sendMessage(chatId, {
                            text: `🎉 *¡Felicidades, han ganado!*\n\n` +
                                  `👑 *Adivinado por:* ${winnerTag}\n` +
                                  `📝 *Palabra exacta:* *${palabraFinal}*\n` +
                                  `💰 *Premio de partida:* +$350 monedas (al banco) | ⚡ +150 EXP\n\n` +
                                  `_Unknown Codexツ</>_`,
                            mentions: [m.sender]
                        }, { quoted: m });
                    } else {
                        // Palabra incorrecta: resta 1 intento
                        juego.intentos--;
                    }
                } else {
                    // Caso B: Intento con 1 letra
                    const letra = input;
                    if (!/^[a-zñ]$/i.test(letra)) {
                        return await sock.sendMessage(chatId, {
                            text: '⚠️ Ingresa solo una letra válida (a-z).\n\n_Unknown Codexツ</>_'
                        }, { quoted: m });
                    }

                    if (juego.letrasUsadas.includes(letra)) {
                        return await sock.sendMessage(chatId, {
                            text: `⚠️ La letra *${letra.toUpperCase()}* ya fue usada.\n\n_Unknown Codexツ</>_`
                        }, { quoted: m });
                    }

                    juego.letrasUsadas.push(letra);

                    if (juego.palabra.includes(letra)) {
                        juego.letrasAdivinadas.push(letra);
                    } else {
                        juego.intentos--;
                    }
                }

                const mostrar = juego.palabra.split('').map(c =>
                    juego.letrasAdivinadas.includes(c) ? c : '_'
                ).join(' ');

                const ganó = !mostrar.includes('_');
                const perdió = juego.intentos <= 0;

                if (ganó) {
                    const palabraFinal = juego.palabra.toUpperCase();
                    delete global.ahorcado[chatId];

                    // Otorgar premio de partida directo al banco
                    try {
                        if (economy && typeof economy.addGameReward === 'function') {
                            economy.addGameReward(m.sender, 350, 150, chatId);
                        } else {
                            if (economy?.addCoins) economy.addCoins(m.sender, 350);
                            if (economy?.addExp) economy.addExp(m.sender, 150);
                        }
                    } catch (_) {}

                    const displayName = (userNames && typeof userNames.get === 'function')
                        ? userNames.get(m.sender)
                        : null;
                    const winnerTag = displayName ? `*${displayName}* (@${m.sender.split('@')[0]})` : `@${m.sender.split('@')[0]}`;

                    return await sock.sendMessage(chatId, {
                        text: `🎉 *¡Felicidades, han ganado!*\n\n` +
                              `👑 *Adivinado por:* ${winnerTag}\n` +
                              `📝 *La palabra era:* *${palabraFinal}*\n` +
                              `💰 *Premio de partida:* +$350 monedas (al banco) | ⚡ +150 EXP\n\n` +
                              `_Unknown Codexツ</>_`,
                        mentions: [m.sender]
                    }, { quoted: m });
                }

                if (perdió) {
                    const palabraFinal = juego.palabra.toUpperCase();
                    delete global.ahorcado[chatId];
                    return await sock.sendMessage(chatId, {
                        text: `${muñeco[6]}\n\n` +
                              `💀 *¡Perdieron!*\n` +
                              `La palabra oculta era: *${palabraFinal}*\n\n` +
                              `_Unknown Codexツ</>_`
                    }, { quoted: m });
                }

                return await sock.sendMessage(chatId, {
                    text: `${muñeco[6 - juego.intentos]}\n\n` +
                          `📝 *${mostrar}*\n\n` +
                          `❤️ Intentos restantes: *${juego.intentos}*\n` +
                          `🔤 Letras usadas: *${juego.letrasUsadas.join(', ') || 'Ninguna'}*\n` +
                          `💰 *Premio de partida:* +$350 monedas (al banco) | ⚡ +150 EXP\n\n` +
                          `Adivina con *.ahorcado [letra]* o *.ahorcado [palabra]*\n\n` +
                          `_Unknown Codexツ</>_`
                }, { quoted: m });
            }

            // 2. Comprobar si ya hay una partida activa sin argumentos
            if (global.ahorcado[chatId]) {
                const juego = global.ahorcado[chatId];
                const mostrar = juego.palabra.split('').map(c =>
                    juego.letrasAdivinadas.includes(c) ? c : '_'
                ).join(' ');

                return await sock.sendMessage(chatId, {
                    text: `⚠️ *Ya hay una partida de ahorcado activa en este chat.*\n\n` +
                          `${muñeco[6 - juego.intentos]}\n\n` +
                          `📝 *${mostrar}*\n` +
                          `❤️ Intentos restantes: *${juego.intentos}*\n` +
                          `🔤 Letras usadas: *${juego.letrasUsadas.join(', ') || 'Ninguna'}*\n` +
                          `💰 *Premio de partida:* +$350 monedas (al banco) | ⚡ +150 EXP\n\n` +
                          `👉 Responde con *.ahorcado [letra]* o escribe *.ahorcado stop* para reiniciar.`
                }, { quoted: m });
            }

            // 3. Inicio de nuevo juego
            const palabra = palabras[Math.floor(Math.random() * palabras.length)];
            global.ahorcado[chatId] = {
                palabra,
                letrasAdivinadas: [],
                letrasUsadas: [],
                intentos: 6
            };

            const mostrar = '_ '.repeat(palabra.length).trim();

            await sock.sendMessage(chatId, {
                text: `🧩 *¡AHORCADO INICIADO!* 🧩\n\n` +
                      `📝 *${mostrar}*\n` +
                      `📏 Longitud: *${palabra.length}* letras\n` +
                      `❤️ Intentos: *6*\n` +
                      `💰 *Premio de partida:* +$350 monedas (al banco) | ⚡ +150 EXP\n\n` +
                      `💡 Adivina con *.ahorcado [letra]* o *.ahorcado [palabra]*\n` +
                      `_Ejemplo:_ \`.ahorcado a\` o \`.ahorcado ${palabra.slice(0, 3)}...\`\n` +
                      `_(Escribe *.ahorcado stop* para cancelar)_\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    },
    {
        name: 'cancelahorcado',
        alias: ['stopahorcado', 'stophangman'],
        category: 'juegos',
        desc: 'Cancela la partida de ahorcado activa en el chat',
        usage: '.cancelahorcado',
        execute: async ({ sock, m }) => {
            const chatId = m.chat || m.key.remoteJid;
            if (global.ahorcado && global.ahorcado[chatId]) {
                delete global.ahorcado[chatId];
                return await sock.sendMessage(chatId, {
                    text: '🧩 Partida de ahorcado cancelada con éxito.'
                }, { quoted: m });
            }
            return await sock.sendMessage(chatId, {
                text: 'ℹ️ No hay ninguna partida de ahorcado activa en este chat.'
            }, { quoted: m });
        }
    }
];
