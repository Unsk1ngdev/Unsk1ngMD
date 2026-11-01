'use strict';

const rpgManager = require('../../lib/rpgManager');
const economy = require('../../lib/economy');

module.exports = {
    name: 'mining',
    alias: ['minar', 'mineria', 'mine'],
    category: 'rpg',
    desc: 'Mina minerales en las profundidades de la cueva (roca, hierro, oro, diamante, esmeralda)',
    usage: '.mining',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        const res = rpgManager.mine(sender);

        if (!res.success) {
            return await sock.sendMessage(jid, {
                text: [
                    '⏳ *[MINERÍA EN COOLDOWN]*',
                    '',
                    `Tu pico está sobrecalentado, @${sender.split('@')[0]}. Descansa un momento.`,
                    `⏱️ Tiempo restante: *${res.cd.timeLeft}*`,
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n'),
                mentions: [sender]
            }, { quoted: m });
        }

        try {
            await m.react?.('⛏️');
        } catch (_) {}

        return await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 ⛏️ EXPEDICIÓN DE MINERÍA 》 ❐',
                '┃',
                `┃├◆ ¡Picaste en la roca profunda, @${sender.split('@')[0]}!`,
                `┃├◆ 🪨 *Mineral extraído:* ${res.item.nombre} x${res.count}`,
                `┃├◆ 💰 *Recompensa:* +$${economy.formatNumber(res.monedas)} monedas`,
                `┃├◆ 🔮 *Experiencia:* +${res.exp} EXP`,
                res.leveledUp ? `┃├◆ 🌟 *¡SUBISTE AL NIVEL ${res.newLevel}!*` : '',
                '┃',
                '┃├◆ ⚒️ Úsalos para forjar armas y armaduras con `.blacksmith`.',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].filter(Boolean).join('\n'),
            mentions: [sender]
        }, { quoted: m });
    }
};

