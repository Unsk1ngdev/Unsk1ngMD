'use strict';

const rankManager = require('../../lib/rank');

module.exports = {
    name: 'rank',
    alias: ['top', 'activos', 'ranking'],
    category: 'grupo',
    desc: 'Muestra el top 10 de usuarios más activos del grupo',
    usage: '.rank',
    groupOnly: true,

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const sorted = rankManager.getRank(jid, 10);

        if (!sorted || sorted.length === 0) {
            return await sock.sendMessage(jid, {
                text: '📊 No hay datos de actividad aún en este grupo.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const medallas = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

        const lista = sorted.map(([userJid, msgs], i) =>
            `${medallas[i] || '▫️'} *+${userJid.replace('@s.whatsapp.net', '')}*\n` +
            `   💬 ${msgs} mensajes`
        ).join('\n\n');

        await sock.sendMessage(jid, {
            text: `╔══════════════════╗\n` +
                  `║  🏆 *TOP ACTIVOS*   ║\n` +
                  `╚══════════════════╝\n\n` +
                  `${lista}\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

