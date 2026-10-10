const triviaManager = require('../lib/trivia');
const akinatorManager = require('../lib/akinator');
const database = require('../lib/database');
const { cleanJid } = require('../lib/groupPermissions');

module.exports = [
    // 1. .ruleta (Ruleta Rusa de Grupo)
    {
        name: 'ruleta',
        alias: ['ruletarusa', 'roulette'],
        category: 'juegos',
        desc: 'Juego de la ruleta rusa: 1 de cada 6 disparos es letal y expulsa al participante',
        usage: '.ruleta',
        groupOnly: true,
        execute: async ({ sock, m }) => {
            await m.react('🎲');

            const shooterJid = m.sender;
            const userTag = cleanJid(shooterJid).split('@')[0];

            // Simulación de 6 recámaras con 1 bala
            const chamber = Math.floor(Math.random() * 6) + 1;
            const bullet = 1;

            if (chamber !== bullet) {
                // Se salva
                await sock.sendMessage(m.chat, {
                    text:
                        `🎰 *[RULETA RUSA - UNSK1NGMD]*\n\n` +
                        `*¡CLIC!* 😅 Te salvaste esta ronda, @${userTag}.\n` +
                        `_El percutor golpeó una recámara vacía (${chamber}/6). Respiras aliviado._`,
                    mentions: [shooterJid]
                }, { quoted: m });
            } else {
                // ¡BANG! Disparo letal
                let expelled = false;

                // Si no es el Owner, intentar expulsar
                if (!database.isOwner(shooterJid)) {
                    try {
                        await sock.groupParticipantsUpdate(m.chat, [shooterJid], 'remove');
                        expelled = true;
                    } catch (_) {
                        expelled = false;
                    }
                }

                if (expelled) {
                    await sock.sendMessage(m.chat, {
                        text:
                            `🎰 *[RULETA RUSA - UNSK1NGMD]*\n\n` +
                            `*¡BANG!* 💥 Has perdido el juego.\n\n` +
                            `☠️ @${userTag} jaló del gatillo y la bala estaba en la recámara.\n` +
                            `El participante ha sido expulsado del grupo. ¡Que descanse en paz! ⚰️`,
                        mentions: [shooterJid]
                    }, { quoted: m });
                } else {
                    await sock.sendMessage(m.chat, {
                        text:
                            `🎰 *[RULETA RUSA - UNSK1NGMD]*\n\n` +
                            `*¡BANG!* 💥 Has perdido la ronda.\n\n` +
                            `☠️ @${userTag} ha caído abatido por la bala en la ruleta rusa... ⚰️\n` +
                            `_(Aviso: El usuario es administrador/owner o el bot no cuenta con permisos para expulsarlo)._`,
                        mentions: [shooterJid]
                    }, { quoted: m });
                }
            }
        }
    },

    // 2. .trivia
    {
        name: 'trivia',
        alias: ['quiz', 'pregunta'],
        category: 'juegos',
        desc: 'Inicia una trivia de cultura general con opciones A, B, C y D (45 seg límite)',
        usage: '.trivia',
        execute: async ({ sock, m }) => {
            await triviaManager.startGame(sock, m);
        }
    },

    // 3. .akinator
    {
        name: 'akinator',
        alias: ['aki', 'adivina'],
        category: 'juegos',
        desc: 'El genio Akinator intenta adivinar el personaje real o ficticio en el que estás pensando',
        usage: '.akinator',
        execute: async ({ sock, m }) => {
            await akinatorManager.startGame(sock, m);
        }
    },

    // 4. .cancelakinator
    {
        name: 'cancelakinator',
        alias: ['stopaki', 'cancelaki'],
        category: 'juegos',
        desc: 'Cancela la sesión activa de Akinator en el chat',
        usage: '.cancelakinator',
        execute: async ({ m }) => {
            const cancelled = akinatorManager.cancelGame(m.chat);
            if (cancelled) {
                await m.reply('🧞‍♂️ La partida de Akinator ha sido cancelada.');
            } else {
                await m.reply('ℹ️ No hay ninguna partida de Akinator activa en este chat.');
            }
        }
    }
];
