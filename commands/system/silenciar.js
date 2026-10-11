'use strict';

const silenciadosManager = require('../../lib/silenciados');
const database = require('../../lib/database');

module.exports = {
    name: 'silenciar',
    alias: ['mute', 'silence', 'desilenciar', 'unmute'],
    category: 'sistema',
    desc: 'Silencia a un usuario para que no pueda usar el bot durante N minutos (solo owner)',
    usage: '.silenciar @usuario [minutos] | .silenciar stop @usuario | .silenciar list',
    ownerOnly: true,

    execute: async ({ sock, m, args, isOwner }) => {
        if (!isOwner) return;

        const subCmd = (args[0] || '').toLowerCase();
        const jid = m.chat || m.key.remoteJid;
        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = m.message?.extendedTextMessage?.contextInfo?.participant;

        // 1. Ver lista de silenciados
        if (subCmd === 'list') {
            const list = silenciadosManager.list();
            if (list.length === 0) {
                return await sock.sendMessage(jid, {
                    text: '🔇 No hay usuarios silenciados actualmente.\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            const lista = list.map((u, i) =>
                `*${i + 1}.* +${u.jid.replace('@s.whatsapp.net', '')}\n` +
                `   🕐 *Hasta:* ${u.hasta}`
            ).join('\n\n');

            return await sock.sendMessage(jid, {
                text: `╔══════════════════╗\n` +
                      `║  🔇 *SILENCIADOS*    ║\n` +
                      `╚══════════════════╝\n\n` +
                      `${lista}\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // 2. Quitar silencio (stop)
        if (subCmd === 'stop' || subCmd === 'unmute') {
            let target = mentioned[0] || quotedParticipant;
            if (!target && args[1]) {
                const raw = args[1].replace(/[^0-9]/g, '');
                if (raw) target = `${raw}@s.whatsapp.net`;
            }

            if (!target || target === 'undefined@s.whatsapp.net') {
                return await sock.sendMessage(jid, {
                    text: '❌ Uso:\n*.silenciar stop @usuario*\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            silenciadosManager.desilenciarUser(target);

            return await sock.sendMessage(jid, {
                text: `✅ Silencio removido a *+${target.replace('@s.whatsapp.net', '')}*\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // 3. Silenciar usuario
        let target = mentioned[0] || quotedParticipant;
        let minutos = parseInt(args[1], 10) || 60;

        if (!target && args[0]) {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw.length >= 7) {
                target = `${raw}@s.whatsapp.net`;
            } else if (parseInt(args[0], 10)) {
                minutos = parseInt(args[0], 10);
            }
        }

        if (!target || target === 'undefined@s.whatsapp.net') {
            return await sock.sendMessage(jid, {
                text: '❌ Uso:\n' +
                      '*.silenciar @usuario [minutos]*\n' +
                      '*.silenciar stop @usuario*\n' +
                      '*.silenciar list*\n\n' +
                      '_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        if (database.isOwner(target)) {
            return await sock.sendMessage(jid, {
                text: '❌ No puedes silenciar al owner del bot.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const { hasta } = silenciadosManager.silenciarUser(target, minutos, sock);

        await sock.sendMessage(jid, {
            text: `🔇 *Silenciado*\n\n` +
                  `👤 *Usuario:* +${target.replace('@s.whatsapp.net', '')}\n` +
                  `⏱️ *Duración:* ${minutos} minutos\n` +
                  `🕐 *Hasta:* ${hasta}\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

