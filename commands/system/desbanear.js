'use strict';

const bannedManager = require('../../lib/banned');

module.exports = {
    name: 'unban',
    alias: ['desbanear'],
    category: 'sistema',
    desc: 'Remueve a un usuario de la lista negra del bot (solo owner)',
    usage: '.unban @usuario | .unban [número]',
    ownerOnly: true,

    execute: async ({ sock, m, args, isOwner }) => {
        if (!isOwner && !bannedManager.isOwner(m.sender)) return;

        const jid = m.chat || m.key.remoteJid;
        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        let target = mentioned[0];

        if (!target && args[0]) {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw) target = `${raw}@s.whatsapp.net`;
        }

        if (!target || target === 'undefined@s.whatsapp.net') {
            return await sock.sendMessage(jid, {
                text: '❌ Uso correcto:\n' +
                      '*.unban @usuario*\n' +
                      '*.unban 18091234567*'
            }, { quoted: m });
        }

        const isBanned = bannedManager.isBanned(target);
        if (!isBanned) {
            return await sock.sendMessage(jid, {
                text: `⚠️ El número *+${target.replace('@s.whatsapp.net', '').split(':')[0]}* no está en la lista negra.`
            }, { quoted: m });
        }

        bannedManager.unbanUser(target);

        const fecha = new Date().toLocaleString('es-DO', {
            timeZone: 'America/Santo_Domingo'
        });

        // Notificar al usuario desbaneado
        try {
            await sock.sendMessage(target, {
                text: '✅ *Has sido desbaneado del bot.*\n\n' +
                      'Ya puedes volver a usar todos los comandos.\n\n' +
                      '_Unknown Codexツ</>_'
            });
        } catch (_) {}

        const remaining = bannedManager.list().length;

        // Confirmar al owner
        await sock.sendMessage(jid, {
            text: `✅ *Desbaneo aplicado*\n\n` +
                  `👤 Usuario: *+${target.replace('@s.whatsapp.net', '').split(':')[0]}*\n` +
                  `📅 Fecha: *${fecha}*\n` +
                  `📋 Baneados restantes: *${remaining}*\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

