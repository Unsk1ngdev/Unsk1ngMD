'use strict';

const rpgManager = require('../../lib/rpgManager');
const economy = require('../../lib/economy');

module.exports = {
    name: 'woodcut',
    alias: ['talar', 'madera', 'cortarmadera', 'chop'],
    category: 'rpg',
    desc: 'Corta madera en el bosque para construcción y crafteo (normal, roble, bambú, ébano)',
    usage: '.woodcut',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        const res = rpgManager.woodcut(sender);

        if (!res.success) {
            return await sock.sendMessage(jid, {
                text: [
                    '⏳ *[TALA EN COOLDOWN]*',
                    '',
                    `El filo de tu hacha necesita afilarse, @${sender.split('@')[0]}.`,
                    `⏱️ Tiempo restante: *${res.cd.timeLeft}*`,
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n'),
                mentions: [sender]
            }, { quoted: m });
        }

        try {
            await m.react?.('🪓');
        } catch (_) {}

        return await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 🪓 EXPEDICIÓN DE TALA 》 ❐',
                '┃',
                `┃├◆ ¡Derribaste árboles en el bosque, @${sender.split('@')[0]}!`,
                `┃├◆ 🪵 *Madera cortada:* ${res.item.nombre} x${res.count}`,
                `┃├◆ 💰 *Recompensa:* +$${economy.formatNumber(res.monedas)} monedas`,
                `┃├◆ 🔮 *Experiencia:* +${res.exp} EXP`,
                res.leveledUp ? `┃├◆ 🌟 *¡SUBISTE AL NIVEL ${res.newLevel}!*` : '',
                '┃',
                '┃├◆ 🛠️ Úsala para craftear armas y equipo con `.craft`.',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].filter(Boolean).join('\n'),
            mentions: [sender]
        }, { quoted: m });
    }
};

