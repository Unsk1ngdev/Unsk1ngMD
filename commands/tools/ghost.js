'use strict';

const premium = require('../../lib/premium');

let isGhostModeActive = false;

module.exports = {
    name: 'ghost',
    alias: ['invisible', 'fantasma'],
    category: 'herramientas',
    desc: 'Activa o desactiva el modo fantasma / invisible para el bot (solo premium)',
    usage: '.ghost [on | off]',

    execute: async ({ sock, m, args, isOwner }) => {
        const sender = m.sender;
        const jid = m.chat || m.key.remoteJid;

        if (!isOwner && !premium.isPremium(sender)) {
            return await sock.sendMessage(jid, {
                text: '⭐ Este comando es *Premium*.\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const subCmd = (args[0] || '').toLowerCase().trim();

        if (subCmd === 'on' || subCmd === 'activar') {
            isGhostModeActive = true;
            try {
                await sock.sendPresenceUpdate('unavailable');
            } catch (_) {}

            return await sock.sendMessage(jid, {
                text: `👻 *Modo Invisible Activado*\n\n` +
                      `El bot ahora oculta su presencia, lectura y estado en línea.\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        if (subCmd === 'off' || subCmd === 'desactivar') {
            isGhostModeActive = false;
            try {
                await sock.sendPresenceUpdate('available');
            } catch (_) {}

            return await sock.sendMessage(jid, {
                text: `👻 *Modo Invisible Desactivado*\n\n` +
                      `Presencia normal restaurada.\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        return await sock.sendMessage(jid, {
            text: `👻 *Modo Fantasma / Invisible*\n\n` +
                  `Estado actual: *${isGhostModeActive ? '✅ Activado' : '❌ Desactivado'}*\n\n` +
                  `📌 Uso:\n` +
                  `*.ghost on* — Activar modo invisible\n` +
                  `*.ghost off* — Desactivar modo invisible\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

