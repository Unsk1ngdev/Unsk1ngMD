'use strict';

const bannedManager = require('../../lib/banned');
const config = require('../../config');

module.exports = {
    name: 'ban',
    alias: ['banear', 'blacklist'],
    category: 'sistema',
    desc: 'Banea a un usuario de usar el bot o gestiona la lista negra (solo owner)',
    usage: '.ban @usuario | .ban remove @usuario | .ban list',
    ownerOnly: true,

    execute: async ({ sock, m, args, isOwner }) => {
        if (!isOwner && !bannedManager.isOwner(m.sender)) return;

        const subCmd = (args[0] || '').toLowerCase();
        const jid = m.chat || m.key.remoteJid;
        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        // ── 1. Ver lista de baneados ──
        if (subCmd === 'list') {
            const users = bannedManager.list();
            if (users.length === 0) {
                return await sock.sendMessage(jid, {
                    text: '📋 No hay usuarios baneados.'
                }, { quoted: m });
            }

            const lista = users.map((u, i) =>
                `${i + 1}. +${u.jid.replace('@s.whatsapp.net', '').split(':')[0]} — ${u.fecha}`
            ).join('\n');

            return await sock.sendMessage(jid, {
                text: `╔══════════════════╗\n` +
                      `║  🚫 *LISTA NEGRA*   ║\n` +
                      `╚══════════════════╝\n\n` +
                      `${lista}\n\n` +
                      `🚫 Total: *${users.length}* baneados\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // ── 2. Quitar ban ──
        if (subCmd === 'remove' || subCmd === 'quitar') {
            let target = mentioned[0];
            if (!target && args[1]) {
                const raw = args[1].replace(/[^0-9]/g, '');
                if (raw) target = `${raw}@s.whatsapp.net`;
            }

            if (!target || target === 'undefined@s.whatsapp.net') {
                return await sock.sendMessage(jid, {
                    text: '❌ Uso: *.banear remove @usuario*\nEjemplo: *.banear remove 18091234567*'
                }, { quoted: m });
            }

            const removed = bannedManager.unbanUser(target);
            if (!removed) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ Ese usuario no está baneado.'
                }, { quoted: m });
            }

            // Notificar al usuario desbaneado
            try {
                await sock.sendMessage(target, {
                    text: '✅ *Tu ban ha sido removido.*\n\n_Unknown Codexツ</>_'
                });
            } catch (_) {}

            return await sock.sendMessage(jid, {
                text: `✅ Ban removido a *+${target.replace('@s.whatsapp.net', '').split(':')[0]}*`
            }, { quoted: m });
        }

        // ── 3. Aplicar ban ──
        let target = mentioned[0];
        if (!target && args[0]) {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw) target = `${raw}@s.whatsapp.net`;
        }

        if (!target || target === 'undefined@s.whatsapp.net') {
            return await sock.sendMessage(jid, {
                text: '❌ Uso correcto:\n' +
                      '*.banear @usuario* — Banear\n' +
                      '*.banear remove @usuario* — Quitar ban\n' +
                      '*.banear list* — Ver lista'
            }, { quoted: m });
        }

        // No banear al owner
        if (bannedManager.isOwner(target)) {
            return await sock.sendMessage(jid, {
                text: '❌ No puedes banear al owner.'
            }, { quoted: m });
        }

        if (bannedManager.isBanned(target)) {
            return await sock.sendMessage(jid, {
                text: '⚠️ Ese usuario ya está baneado.'
            }, { quoted: m });
        }

        const fecha = new Date().toLocaleString('es-DO', {
            timeZone: 'America/Santo_Domingo'
        });

        bannedManager.banUser(target, fecha);

        // Notificar al usuario baneado
        try {
            await sock.sendMessage(target, {
                text: '🚫 *Has sido baneado del bot.*\n\n' +
                      'No podrás usar ningún comando.\n\n' +
                      '_Unknown Codexツ</>_'
            });
        } catch (_) {}

        await sock.sendMessage(jid, {
            text: `🚫 *Ban aplicado*\n\n` +
                  `👤 Usuario: *+${target.replace('@s.whatsapp.net', '').split(':')[0]}*\n` +
                  `📅 Fecha: *${fecha}*\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

