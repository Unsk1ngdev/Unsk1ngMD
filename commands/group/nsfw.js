'use strict';

const nsfwManager = require('../../lib/nsfw');

module.exports = {
    name: 'nsfw',
    alias: ['modonsfw', 'nsfwmode'],
    category: 'grupo',
    desc: 'Activa o desactiva el modo NSFW (+18) en el grupo (solo admins y owner)',
    usage: '.nsfw on | .nsfw off | .nsfw',
    groupOnly: true,

    execute: async ({ sock, m, args, isAdmin, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;

        // Verificar que es grupo
        if (!jid.endsWith('@g.us')) {
            return await sock.sendMessage(jid, {
                text: '❌ Este comando solo funciona en grupos.'
            }, { quoted: m });
        }

        // Verificar admin u owner
        if (!isAdmin && !isOwner) {
            return await sock.sendMessage(jid, {
                text: '❌ Solo los *administradores* del grupo pueden usar este comando.'
            }, { quoted: m });
        }

        const subCmd = (args[0] || '').toLowerCase().trim();

        if (subCmd === 'on' || subCmd === 'activar' || subCmd === 'enable') {
            const already = nsfwManager.isNsfwEnabled(jid);
            if (already) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ El modo NSFW ya está *activado* en este grupo.'
                }, { quoted: m });
            }

            nsfwManager.enableNsfw(jid);

            return await sock.sendMessage(jid, {
                text: `🔞 *Modo NSFW Activado*\n\n` +
                      `⚠️ Solo para mayores de *18 años*.\n` +
                      `📌 Comandos disponibles:\n` +
                      `• *.waifu* — Imagen aleatoria\n` +
                      `• *.hentai* — Contenido anime\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        if (subCmd === 'off' || subCmd === 'desactivar' || subCmd === 'disable') {
            const already = nsfwManager.isNsfwEnabled(jid);
            if (!already) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ El modo NSFW ya está *desactivado* en este grupo.'
                }, { quoted: m });
            }

            nsfwManager.disableNsfw(jid);

            return await sock.sendMessage(jid, {
                text: `✅ *Modo NSFW Desactivado*\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // Ver estado
        const estado = nsfwManager.isNsfwEnabled(jid);
        return await sock.sendMessage(jid, {
            text: `🔞 *Estado NSFW:* ${estado ? '✅ Activado' : '❌ Desactivado'}\n\n` +
                  `📌 Uso:\n` +
                  `*.nsfw on* — Activar\n` +
                  `*.nsfw off* — Desactivar\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

