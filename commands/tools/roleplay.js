'use strict';

const roleplayEngine = require('../../lib/roleplayEngine');

if (!global.roleplayMode) {
    global.roleplayMode = {};
}

module.exports = {
    name: 'roleplay',
    alias: ['animepersonaje', 'personaje', 'rp'],
    category: 'juegos',
    desc: 'Activa el modo roleplay de tu personaje de anime favorito para conversar',
    usage: '.roleplay [personaje] | .roleplay stop | .roleplay list',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender;

        const subCmd = (args[0] || '').toLowerCase().trim();

        // 1. Detener roleplay
        if (subCmd === 'stop' || subCmd === 'off' || subCmd === 'salir' || subCmd === 'cancelar') {
            if (!global.roleplayMode[sender]) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No tienes ningún roleplay activo.\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }
            delete global.roleplayMode[sender];
            return await sock.sendMessage(jid, {
                text: '✅ *Modo roleplay desactivado.* ¡Hasta la próxima!\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        // 2. Listar personajes disponibles
        if (subCmd === 'list' || subCmd === 'lista' || subCmd === 'personajes') {
            const listaP = Object.entries(roleplayEngine.personajes).map(([k, p]) =>
                `${p.emoji} *${p.nombre}* (${p.anime})`
            ).join('\n');

            return await sock.sendMessage(jid, {
                text: `╔══════════════════╗\n` +
                      `║ 🎭 *PERSONAJES ROLEPLAY* ║\n` +
                      `╚══════════════════╝\n\n` +
                      `${listaP}\n\n` +
                      `━━━━━━━━━━━━━━━\n` +
                      `💡 Usa: *.roleplay [nombre]* para hablar con uno.\n` +
                      `Ejemplo: *.roleplay gojo* o *.roleplay goku*\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        const query = args.join(' ').trim();
        if (!query) {
            const nombres = Object.values(roleplayEngine.personajes).map(p => `${p.emoji} ${p.nombre.split(' ')[0]}`).join(', ');
            return await sock.sendMessage(jid, {
                text: `🎭 *MODO ROLEPLAY ANIME*\n\n` +
                      `Habla en privado o en grupo y el personaje te responderá de forma personalizada y divertida.\n\n` +
                      `📋 *Personajes disponibles:*\n${nombres}\n\n` +
                      `💡 *Uso:* *.roleplay [personaje]*\n` +
                      `Ejemplo: *.roleplay goku*\n\n` +
                      `🛑 Usa *.roleplay stop* para salir del roleplay cuando quieras.\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        const match = roleplayEngine.getPersonaje(query);
        if (!match) {
            return await sock.sendMessage(jid, {
                text: `❌ No se encontró el personaje *${query}*.\n` +
                      `Usa *.roleplay list* para ver todos los personajes disponibles.`
            }, { quoted: m });
        }

        const { key, data } = match;

        // Guardar modo activo para el usuario
        global.roleplayMode[sender] = key;

        const caption = `🎭 *MODO ROLEPLAY ACTIVADO*\n\n` +
                        `${data.emoji} *Personaje:* ${data.nombre}\n` +
                        `📺 *Anime:* ${data.anime}\n` +
                        `📖 *Perfil:* ${data.descripcion}\n\n` +
                        `━━━━━━━━━━━━━━━\n` +
                        `💬 *${data.nombre}:*\n"${data.frase}"\n` +
                        `━━━━━━━━━━━━━━━\n\n` +
                        `✨ ¡A partir de ahora cualquier mensaje que envíes será respondido como *${data.nombre}*!\n` +
                        `🛑 Para salir escribe: *.roleplay stop*\n\n` +
                        `_Unknown Codexツ</>_`;

        if (data.imagen) {
            try {
                return await sock.sendMessage(jid, {
                    image: { url: data.imagen },
                    caption
                }, { quoted: m });
            } catch (_) {}
        }

        await sock.sendMessage(jid, { text: caption }, { quoted: m });
    }
};
