'use strict';

const rpgManager = require('../../lib/rpgManager');
const economy = require('../../lib/economy');

module.exports = {
    name: 'fishing',
    alias: ['pescar', 'pesca', 'fish'],
    category: 'rpg',
    desc: 'Pesca en el río con probabilidades de capturar diferentes especies marinas y ganar EXP/monedas',
    usage: '.fishing',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        const res = rpgManager.fish(sender);

        if (!res.success) {
            return await sock.sendMessage(jid, {
                text: [
                    '⏳ *[PESCA EN COOLDOWN]*',
                    '',
                    `Los peces se asustaron, @${sender.split('@')[0]}. Espera un momento antes de volver a lanzar la caña.`,
                    `⏱️ Tiempo restante: *${res.cd.timeLeft}*`,
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n'),
                mentions: [sender]
            }, { quoted: m });
        }

        try {
            await m.react?.('🎣');
        } catch (_) {}

        return await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 🎣 EXPEDICIÓN DE PESCA 》 ❐',
                '┃',
                `┃├◆ ¡Has lanzado el anzuelo, @${sender.split('@')[0]}!`,
                `┃├◆ 🐟 *Captura:* ${res.item.nombre}`,
                `┃├◆ 💰 *Recompensa:* +$${economy.formatNumber(res.monedas)} monedas`,
                `┃├◆ 🔮 *Experiencia:* +${res.exp} EXP`,
                res.leveledUp ? `┃├◆ 🌟 *¡SUBISTE AL NIVEL ${res.newLevel}!*` : '',
                '┃',
                '┃├◆ 🎒 Guardado en tu inventario (`.craft` para cocinar o fabricar).',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].filter(Boolean).join('\n'),
            mentions: [sender]
        }, { quoted: m });
    }
};

