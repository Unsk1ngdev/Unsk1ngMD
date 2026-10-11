'use strict';

const logsManager = require('../../lib/logs');

module.exports = {
    name: 'logs',
    alias: ['cmdlogs', 'historial'],
    category: 'sistema',
    desc: 'Muestra los últimos 20 comandos usados en el bot (solo owner)',
    usage: '.logs',
    ownerOnly: true,

    execute: async ({ sock, m, isOwner }) => {
        if (!isOwner) return;

        const jid = m.chat || m.key.remoteJid;
        const ultimos = logsManager.getRecentLogs(20);

        if (ultimos.length === 0) {
            return await sock.sendMessage(jid, {
                text: '📋 No hay logs registrados aún.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const lista = ultimos.map((l, i) =>
            `*${i + 1}.* +${l.usuario}\n` +
            `   ⌨️ *Cmd:* ${l.comando}\n` +
            `   📍 *En:* ${l.grupo}\n` +
            `   🕐 *Hora:* ${l.hora}`
        ).join('\n\n');

        await sock.sendMessage(jid, {
            text: `╔══════════════════╗\n` +
                  `║    📋 *LOGS (20)*    ║\n` +
                  `╚══════════════════╝\n\n` +
                  `${lista}\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

