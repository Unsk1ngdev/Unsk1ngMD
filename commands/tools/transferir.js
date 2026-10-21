'use strict';

const economy = require('../../lib/economy');

module.exports = {
    name: 'transferir',
    alias: ['pay', 'pagaruser', 'enviardinero'],
    category: 'herramientas',
    desc: 'Transfiere monedas de tu mano a otro usuario',
    usage: '.transferir @usuario <monto>',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        const mentioned = m.mentionedJid || [];
        let target = mentioned[0];

        if (!target && m.quoted && m.quoted.sender) {
            target = m.quoted.sender;
        }

        if (!target && args[0]) {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw.length >= 7) target = `${raw}@s.whatsapp.net`;
        }

        const amountStr = args.find(a => /^\d+$/.test(a.trim()));
        const amount = parseInt(amountStr, 10);

        if (!target || isNaN(amount) || amount <= 0) {
            return await sock.sendMessage(jid, {
                text: [
                    '❌ *Uso correcto:*',
                    '• `.transferir @usuario <monto>`',
                    '• Respondiendo a un mensaje: `.transferir <monto>`',
                    '',
                    '*Ejemplo:* `.transferir @usuario 5000`',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        const res = economy.transfer(sender, target, amount);

        if (!res.success) {
            return await sock.sendMessage(jid, {
                text: `❌ ${res.error}`
            }, { quoted: m });
        }

        return await sock.sendMessage(jid, {
            text: [
                '💸 *TRANSFERENCIA EXITOSA*',
                '',
                `📤 *De:* @${sender.split('@')[0]}`,
                `📥 *Para:* @${target.split('@')[0]}`,
                `💵 *Monto transferido:* $${economy.formatNumber(res.transferido)} monedas`,
                '',
                `💰 *Tu nuevo saldo:* $${economy.formatNumber(res.remitenteSaldo)}`,
                '',
                '_Unknown Codexツ</>_'
            ].join('\n'),
            mentions: [sender, target]
        }, { quoted: m });
    }
};

