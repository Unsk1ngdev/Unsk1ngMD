'use strict';

const axios = require('axios');
const roleplayEngine = require('../../lib/roleplayEngine');
const logger = require('../../lib/logger');

if (!global.roleplayMode) {
    global.roleplayMode = {};
}

module.exports = {
    name: 'roleplay',
    alias: ['animepersonaje', 'personaje', 'rp'],
    category: 'juegos',
    desc: 'Activa el modo roleplay de tu personaje de anime favorito para conversar in-character con IA',
    usage: '.roleplay [personaje] | .roleplay stop | .roleplay list',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender;

        const subCmd = (args[0] || '').toLowerCase().trim();

        // 1. Detener roleplay
        if (subCmd === 'stop' || subCmd === 'off' || subCmd === 'salir' || subCmd === 'cancelar') {
            if (!global.roleplayMode[sender]) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No tienes ningún roleplay activo en este momento.\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }
            const exCharKey = global.roleplayMode[sender];
            const exChar = roleplayEngine.personajes[exCharKey];
            delete global.roleplayMode[sender];

            const adiosNombre = exChar?.nombre || 'tu personaje';
            return await sock.sendMessage(jid, {
                text: `✅ *Modo roleplay desactivado.*\n¡${adiosNombre} se ha despedido! Hasta la próxima aventura.\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // 2. Listar todos los personajes agrupados por anime
        if (subCmd === 'list' || subCmd === 'lista' || subCmd === 'personajes') {
            const byAnime = {};
            for (const [k, p] of Object.entries(roleplayEngine.personajes)) {
                if (!byAnime[p.anime]) byAnime[p.anime] = [];
                byAnime[p.anime].push(`${p.emoji} *${p.nombre}* \`(${k})\``);
            }

            let textList =
                `╔══════════════════════╗\n` +
                `║  🎭 *ROSTER ROLEPLAY ANIME*  ║\n` +
                `╚══════════════════════╝\n\n` +
                `🌟 *${Object.keys(roleplayEngine.personajes).length} Personajes Legendarios Disponibles*\n\n`;

            for (const [anime, chars] of Object.entries(byAnime)) {
                textList += `📺 *${anime.toUpperCase()}*\n`;
                textList += chars.map(c => `  └ ${c}`).join('\n') + '\n\n';
            }

            textList +=
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `💡 *Cómo activar:* *.roleplay [nombre o alias]*\n` +
                `Ejemplos:\n` +
                `  • *.roleplay goku*\n` +
                `  • *.roleplay gojo*\n` +
                `  • *.roleplay luffy*\n` +
                `  • *.roleplay itachi*\n` +
                `  • *.roleplay shadow*\n\n` +
                `🛑 *Para salir:* *.roleplay stop*\n\n` +
                `_Unknown Codexツ</>_`;

            return await sock.sendMessage(jid, { text: textList }, { quoted: m });
        }

        const query = args.join(' ').trim();
        if (!query) {
            const totalChars = Object.keys(roleplayEngine.personajes).length;
            return await sock.sendMessage(jid, {
                text:
                    `╔══════════════════════╗\n` +
                    `║   🎭 *MODO ROLEPLAY ANIME*   ║\n` +
                    `╚══════════════════════╝\n\n` +
                    `¡Conversa con tus personajes favoritos con inteligencia artificial y personalidad in-character auténtica!\n\n` +
                    `🌟 *Disponibles:* *${totalChars} personajes* de Dragon Ball, Naruto, One Piece, Jujutsu Kaisen, Shingeki, Kimetsu, Death Note, Chainsaw Man, Solo Leveling y más.\n\n` +
                    `📋 *Comandos rápidos:*\n` +
                    `  • *.roleplay list* — Ver catálogo completo organizado\n` +
                    `  • *.roleplay [nombre]* — Iniciar conversación\n` +
                    `  • *.roleplay stop* — Salir del roleplay\n\n` +
                    `💡 *Ejemplos para empezar ya:*\n` +
                    `  • *.roleplay gojo*\n` +
                    `  • *.roleplay goku*\n` +
                    `  • *.roleplay sukuna*\n` +
                    `  • *.roleplay anya*\n` +
                    `  • *.roleplay luffy*\n\n` +
                    `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        const match = roleplayEngine.getPersonaje(query);
        if (!match) {
            return await sock.sendMessage(jid, {
                text: `❌ No se encontró ningún personaje con el nombre o alias *"${query}"*.\n\n` +
                      `💡 Escribe *.roleplay list* para ver la lista completa de los ${Object.keys(roleplayEngine.personajes).length} personajes disponibles.\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        const { key, data } = match;

        // Guardar modo activo para el usuario
        global.roleplayMode[sender] = key;

        // Tarjeta épica de activación
        const caption =
            `╔══════════════════════╗\n` +
            `║  🎭 *MODO ROLEPLAY ACTIVADO* ║\n` +
            `╚══════════════════════╝\n\n` +
            `${data.emoji} *Personaje:* *${data.nombre}*\n` +
            `📺 *Anime:* _${data.anime}_\n` +
            `📖 *Personalidad:* _${data.descripcion}_\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `💬 *${data.nombre.toUpperCase()}:*\n` +
            `"${data.frase}"\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `✨ *¡Conexión establecida!* A partir de ahora todo lo que escribas será respondido por *${data.nombre}* con inteligencia artificial y actitud in-character.\n\n` +
            `💡 _Habla con normalidad, pregúntale lo que quieras o desafíalo a una batalla._\n` +
            `🛑 *Para salir escribe:* *.roleplay stop*\n\n` +
            `_Unknown Codexツ</>_`;

        // Envío garantizado de imagen con descarga directa a Buffer
        if (data.imagen) {
            try {
                const imgRes = await axios.get(data.imagen, {
                    responseType: 'arraybuffer',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 7000
                });

                if (imgRes.status === 200 && imgRes.data && imgRes.data.length > 500) {
                    return await sock.sendMessage(jid, {
                        image: Buffer.from(imgRes.data),
                        caption
                    }, { quoted: m });
                }
            } catch (errBuffer) {
                logger.warn(`[ROLEPLAY] Falló descarga buffer de ${data.nombre}, intentando URL directa:`, errBuffer.message);
                try {
                    return await sock.sendMessage(jid, {
                        image: { url: data.imagen },
                        caption
                    }, { quoted: m });
                } catch (_) {}
            }
        }

        // Fallback texto solo si no hay imagen
        await sock.sendMessage(jid, { text: caption }, { quoted: m });
    }
};
