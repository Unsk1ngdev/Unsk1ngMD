'use strict';

const database = require('../../lib/database');

module.exports = {
    name: 'impersonar',
    alias: ['fakequote', 'simular'],
    category: 'sistema',
    desc: 'Simula un mensaje de un usuario citado o mencionado (solo owner)',
    usage: '.impersonar @usuario [mensaje]',
    ownerOnly: true,

    execute: async ({ sock, m, args, text, isOwner }) => {
        if (!isOwner && !database.isOwner(m.sender)) return;

        const jid = m.chat || m.key.remoteJid;
        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = m.message?.extendedTextMessage?.contextInfo?.participant;

        let target = mentioned[0];
        let mensaje = '';

        if (target) {
            // El primer argumento suele ser la mención @usuario
            mensaje = args.slice(1).join(' ').trim();
        } else if (quotedParticipant) {
            target = quotedParticipant;
            mensaje = text?.trim() || args.join(' ').trim();
        } else if (args[0] && args[0].replace(/[^0-9]/g, '').length >= 7) {
            const raw = args[0].replace(/[^0-9]/g, '');
            target = `${raw}@s.whatsapp.net`;
            mensaje = args.slice(1).join(' ').trim();
        }

        if (!target || !mensaje) {
            return await sock.sendMessage(jid, {
                text: '❌ Uso: *.impersonar @usuario [mensaje]*\n' +
                      'Ejemplo: *.impersonar @Juan Hola a todos!*\n' +
                      'O responde a un mensaje con *.impersonar [mensaje]*'
            }, { quoted: m });
        }

        const numero = target.replace('@s.whatsapp.net', '').split(':')[0];

        try {
            let foto = null;
            try {
                foto = await sock.profilePictureUrl(target, 'image');
            } catch (e) {}

            await sock.sendMessage(jid, {
                text: `👤 *+${numero}*\n\n${mensaje}`,
                mentions: [target]
            });
        } catch (e) {
            await sock.sendMessage(jid, {
                text: `❌ Error: ${e.message}`
            }, { quoted: m });
        }
    }
};

