'use strict';

const economy = require('../../lib/economy');

module.exports = {
    name: 'diario',
    alias: ['daily', 'recompensa', 'bono'],
    category: 'herramientas',
    desc: 'Reclama tu bono diario de monedas y experiencia (cada 24 horas)',
    usage: '.diario',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        const res = economy.claimDaily(sender);

        if (!res.success) {
            return await sock.sendMessage(jid, {
                text: [
                    '⏳ *BONO DIARIO YA RECLAMADO*',
                    '',
                    `Ya has recibido tu recompensa de hoy, @${sender.split('@')[0]}.`,
                    `⏱️ Regresa en: *${res.timeLeft}*`,
                    '',
                    '💡 _Puedes usar .trabajar cada 15 minutos para seguir ganando monedas._',
                    '_Unknown Codexツ</>_'
                ].join('\n'),
                mentions: [sender]
            }, { quoted: m });
        }

        const levelUpMsg = res.leveledUp
            ? `\n🎉 *¡SUBISTE DE NIVEL! Ahora eres Nivel ${res.nuevoNivel}* (+5 ATQ, +3 DEF)\n`
            : '';

        return await sock.sendMessage(jid, {
            text: [
                '🎁 *RECOMPENSA DIARIA RECLAMADA*',
                '',
                `👤 *Usuario:* @${sender.split('@')[0]}`,
                `💵 *Monedas ganadas:* +$${economy.formatNumber(res.monedas)}`,
                `🔮 *Experiencia:* +${res.exp} EXP`,
                levelUpMsg,
                `💰 *Total en mano:* $${economy.formatNumber(res.totalMonedas)}`,
                '',
                '✨ _Vuelve mañana para reclamar otro bono diario._',
                '_Unknown Codexツ</>_'
            ].filter(Boolean).join('\n'),
            mentions: [sender]
        }, { quoted: m });
    }
};

