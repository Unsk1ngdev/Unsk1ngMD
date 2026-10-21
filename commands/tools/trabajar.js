'use strict';

const economy = require('../../lib/economy');

module.exports = {
    name: 'trabajar',
    alias: ['work', 'chambear', 'empleo', 'chamba'],
    category: 'herramientas',
    desc: 'Trabaja en un oficio para ganar dinero y experiencia (disponible cada 15 minutos)',
    usage: '.trabajar',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        const res = economy.work(sender);

        if (!res.success) {
            return await sock.sendMessage(jid, {
                text: [
                    '☕ *ESTÁS DESCANSANDO*',
                    '',
                    `Estás agotado por tu último turno de trabajo, @${sender.split('@')[0]}.`,
                    `⏱️ Podrás volver a trabajar en: *${res.timeLeft}*`,
                    '',
                    '_Tómate un café y relájate antes de tu próxima jornada._',
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
                '💼 *JORNADA LABORAL COMPLETADA*',
                '',
                `👤 *Trabajador:* @${sender.split('@')[0]}`,
                `🛠️ *Oficio:* ${res.empleo}`,
                '',
                `💵 *Salario ganado:* +$${economy.formatNumber(res.monedas)} monedas`,
                `🔮 *Experiencia:* +${res.exp} EXP`,
                levelUpMsg,
                `💰 *Saldo actual en mano:* $${economy.formatNumber(res.totalMonedas)}`,
                '',
                '⏱️ _Podrás volver a trabajar en 15 minutos._',
                '_Unknown Codexツ</>_'
            ].filter(Boolean).join('\n'),
            mentions: [sender]
        }, { quoted: m });
    }
};

