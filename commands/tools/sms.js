'use strict';

const premium = require('../../lib/premium');

module.exports = {
    name: 'sms',
    alias: ['sendmsg', 'anonimo'],
    category: 'herramientas',
    desc: 'Envía un mensaje anónimo a un número desde el bot (solo premium)',
    usage: '.sms [número] [mensaje]',

    execute: async ({ sock, m, args, isOwner }) => {
        const sender = m.sender;
        const jid = m.chat || m.key.remoteJid;

        if (!isOwner && !premium.isPremium(sender)) {
            return await sock.sendMessage(jid, {
                text: '⭐ Este comando es *Premium*.\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const rawTarget = args[0] ? args[0].replace(/[^0-9]/g, '') : '';
        const numero = rawTarget ? `${rawTarget}@s.whatsapp.net` : null;
        const mensaje = args.slice(1).join(' ').trim();

        if (!numero || rawTarget.length < 7) {
            return await sock.sendMessage(jid, {
                text: '❌ Uso: *.sms [número] [mensaje]*\nEjemplo: *.sms 18091234567 Hola!*'
            }, { quoted: m });
        }

        if (!mensaje) {
            return await sock.sendMessage(jid, {
                text: '❌ Debes escribir un mensaje.\nEjemplo: *.sms 18091234567 Hola!*'
            }, { quoted: m });
        }

        try {
            const enWA = await sock.onWhatsApp(numero);
            if (!enWA?.[0]?.exists) {
                return await sock.sendMessage(jid, {
                    text: `❌ El número *+${rawTarget}* no tiene WhatsApp registrado.`
                }, { quoted: m });
            }

            // Enviar mensaje al número destino desde el bot
            await sock.sendMessage(numero, { text: mensaje });

            // Confirmar al usuario que ejecutó el comando
            await sock.sendMessage(jid, {
                text: `✅ *Mensaje enviado*\n\n` +
                      `📱 Para: *+${rawTarget}*\n` +
                      `💬 Mensaje: _${mensaje}_\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(jid, {
                text: `❌ Error al enviar: ${e.message}`
            }, { quoted: m });
        }
    }
};

