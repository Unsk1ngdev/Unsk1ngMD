'use strict';

if (!global.ahorcado) {
    global.ahorcado = {};
}

module.exports = {
    name: 'ahorcado',
    alias: ['hangman'],
    category: 'herramientas',
    desc: 'Juego del ahorcado interactivo con palabras anime y temáticas',
    usage: '.ahorcado | .ahorcado [letra]',

    execute: async ({ sock, m, args }) => {
        const chatId = m.chat || m.key.remoteJid;

        const muñeco = [
            '```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========```',
            '```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========```',
            '```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========```',
            '```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========```',
            '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========```',
            '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========```',
            '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```'
        ];

        // 1. Adivinar letra si ya hay juego activo y se pasa 1 letra
        if (global.ahorcado[chatId] && args[0]?.length === 1) {
            const juego = global.ahorcado[chatId];
            const letra = args[0].toLowerCase();

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

            const mostrar = juego.palabra.split('').map(c =>
                juego.letrasAdivinadas.includes(c) ? c : '_'
            ).join(' ');

            const ganó = !mostrar.includes('_');
            const perdió = juego.intentos <= 0;

            if (ganó) {
                const palabraFinal = juego.palabra.toUpperCase();
                delete global.ahorcado[chatId];
                return await sock.sendMessage(chatId, {
                    text: `🎉 *¡Felicidades, ganaron!*\n\n` +
                          `📝 La palabra era: *${palabraFinal}*\n\n` +
                          `_Unknown Codexツ</>_`
                }, { quoted: m });
            }

            if (perdió) {
                const palabraFinal = juego.palabra.toUpperCase();
                delete global.ahorcado[chatId];
                return await sock.sendMessage(chatId, {
                    text: `${muñeco[6]}\n\n` +
                          `💀 *¡Perdieron!*\n` +
                          `La palabra era: *${palabraFinal}*\n\n` +
                          `_Unknown Codexツ</>_`
                }, { quoted: m });
            }

            return await sock.sendMessage(chatId, {
                text: `${muñeco[6 - juego.intentos]}\n\n` +
                      `📝 *${mostrar}*\n\n` +
                      `❤️ Intentos: *${juego.intentos}*\n` +
                      `🔤 Letras usadas: *${juego.letrasUsadas.join(', ')}*\n\n` +
                      `Adivina con *.ahorcado [letra]*\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // 2. Nuevo juego
        const palabras = [
            'naruto', 'sasuke', 'goku', 'vegeta', 'luffy',
            'dragon', 'ninja', 'samurai', 'katana', 'anime',
            'manga', 'hokage', 'pirata', 'saiyan', 'titan',
            'demonio', 'espada', 'magia', 'poder', 'batalla',
            'shinigami', 'bleach', 'jujutsu', 'hunter', 'sharingan'
        ];

        const palabra = palabras[Math.floor(Math.random() * palabras.length)];
        global.ahorcado[chatId] = {
            palabra,
            letrasAdivinadas: [],
            letrasUsadas: [],
            intentos: 6
        };

        const mostrar = '_ '.repeat(palabra.length).trim();

        await sock.sendMessage(chatId, {
            text: `🧩 *¡Ahorcado iniciado!*\n\n` +
                  `📝 *${mostrar}*\n` +
                  `📏 *${palabra.length}* letras\n\n` +
                  `❤️ Intentos: *6*\n\n` +
                  `Adivina con *.ahorcado [letra]*\n` +
                  `Ejemplo: *.ahorcado a*\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

