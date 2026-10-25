'use strict';

const silenciadosManager = require('../../lib/silenciados');

module.exports = {
    name: 'unmute',
    alias: ['desilenciar', 'quitarmute', 'unmutear'],
    category: 'owner',
    desc: 'Quita el silencio a un usuario para que pueda volver a interactuar con el bot (solo owner)',
    usage: '.unmute @usuario | .unmute [número]',
    ownerOnly: true,

    execute: async ({ sock, m, args, isOwner, prefix }) => {
        if (!isOwner) return;

        const jid = m.chat || m.key.remoteJid;
        const pfx = prefix || '.';
        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = m.quoted?.sender || m.message?.extendedTextMessage?.contextInfo?.participant;

        let target = mentioned[0] || quotedParticipant;
        if (!target && args[0]) {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw.length >= 7) {
                target = `${raw}@s.whatsapp.net`;
            }
        }

        if (!target || target === 'undefined@s.whatsapp.net') {
            return await sock.sendMessage(jid, {
                text: `❌ *Uso correcto:*\n` +
                      `• *${pfx}unmute @usuario*\n` +
                      `• *${pfx}unmute +18494509905*\n` +
                      `• Citando el mensaje del usuario con *${pfx}unmute*\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        if (!silenciadosManager.isSilenciado(target)) {
            return await sock.sendMessage(jid, {
                text: `⚠️ Ese usuario no se encuentra silenciado actualmente.\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        silenciadosManager.desilenciarUser(target);
        const targetNum = target.replace('@s.whatsapp.net', '').split(':')[0];

        try {
            await m.react('🔊');
        } catch (_) {}

        return await sock.sendMessage(jid, {
            text: `🔊 *[USUARIO DESILENCIADO / UNMUTE]*\n\n` +
                  `👤 *Usuario:* +${targetNum}\n` +
                  `✅ Silencio removido exitosamente. El usuario ya puede interactuar con el bot nuevamente.\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

