'use strict';

const rpgManager = require('../../lib/rpgManager');
const economy = require('../../lib/economy');

module.exports = {
    name: 'hunting',
    alias: ['cazar', 'caza', 'hunt'],
    category: 'rpg',
    desc: 'Caza animales salvajes en el bosque para obtener carne, cuero y materiales raros',
    usage: '.hunting',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        const res = rpgManager.hunt(sender);

        if (!res.success) {
            return await sock.sendMessage(jid, {
                text: [
                    '⏳ *[CAZA EN COOLDOWN]*',
                    '',
                    `Los animales están alerta y escondidos, @${sender.split('@')[0]}.`,
                    `⏱️ Tiempo restante: *${res.cd.timeLeft}*`,
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n'),
                mentions: [sender]
            }, { quoted: m });
        }

        try {
            await m.react?.('🏹');
        } catch (_) {}

        return await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 🏹 EXPEDICIÓN DE CAZA 》 ❐',
                '┃',
                `┃├◆ ¡Disparaste con precisión, @${sender.split('@')[0]}!`,
                `┃├◆ 🦌 *Presa obtenida:* ${res.item.nombre}`,
                `┃├◆ 💰 *Recompensa:* +$${economy.formatNumber(res.monedas)} monedas`,
                `┃├◆ 🔮 *Experiencia:* +${res.exp} EXP`,
                res.leveledUp ? `┃├◆ 🌟 *¡SUBISTE AL NIVEL ${res.newLevel}!*` : '',
                '┃',
                '┃├◆ 🍲 Úsalo para cocinar recetas nutritivas con `.cook`.',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].filter(Boolean).join('\n'),
            mentions: [sender]
        }, { quoted: m });
    }
};

