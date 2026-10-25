'use strict';

const silenciadosManager = require('../../lib/silenciados');
const database = require('../../lib/database');

module.exports = {
    name: 'mute',
    alias: ['silenciar', 'silence', 'mutear'],
    category: 'owner',
    desc: 'Silencia a un usuario para que no pueda interactuar con el bot durante N minutos (solo owner)',
    usage: '.mute @usuario [minutos] | .mute stop @usuario | .mute list | .unmute @usuario',
    ownerOnly: true,

    execute: async ({ sock, m, args, isOwner, prefix }) => {
        if (!isOwner) return;

        const subCmd = (args[0] || '').toLowerCase().trim();
        const jid = m.chat || m.key.remoteJid;
        const pfx = prefix || '.';
        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = m.quoted?.sender || m.message?.extendedTextMessage?.contextInfo?.participant;

        // ── 1. Ver lista de silenciados (.mute list / .silenciar list) ──
        if (subCmd === 'list') {
            const list = silenciadosManager.list();
            if (list.length === 0) {
                return await sock.sendMessage(jid, {
                    text: '🔇 *No hay ningún usuario silenciado actualmente.*\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            const lista = list.map((u, i) =>
                `*${i + 1}.* +${u.jid.replace('@s.whatsapp.net', '').split(':')[0]}\n` +
                `   🕐 *Hasta:* ${u.hasta}`
            ).join('\n\n');

            return await sock.sendMessage(jid, {
                text: `╔══════════════════╗\n` +
                      `║  🔇 *USUARIOS SILENCIADOS* ║\n` +
                      `╚══════════════════╝\n\n` +
                      `${lista}\n\n` +
                      `💡 *Para quitar silencio:* *${pfx}unmute @usuario* o *${pfx}mute stop @usuario*\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // ── 2. Quitar silencio (.mute stop / .silenciar stop / .mute unmute) ──
        if (subCmd === 'stop' || subCmd === 'unmute' || subCmd === 'remove' || subCmd === 'quitar' || subCmd === 'off') {
            let target = mentioned[0] || quotedParticipant;
            if (!target && args[1]) {
                const raw = args[1].replace(/[^0-9]/g, '');
                if (raw) target = `${raw}@s.whatsapp.net`;
            }

            if (!target || target === 'undefined@s.whatsapp.net') {
                return await sock.sendMessage(jid, {
                    text: `❌ *Uso correcto:* *${pfx}mute stop @usuario* o *${pfx}unmute @usuario*\n\n_Unknown Codexツ</>_`
                }, { quoted: m });
            }

            if (!silenciadosManager.isSilenciado(target)) {
                return await sock.sendMessage(jid, {
                    text: `⚠️ Ese usuario no está silenciado actualmente.\n\n_Unknown Codexツ</>_`
                }, { quoted: m });
            }

            silenciadosManager.desilenciarUser(target);
            const targetNum = target.replace('@s.whatsapp.net', '').split(':')[0];

            return await sock.sendMessage(jid, {
                text: `🔊 *[USUARIO DESILENCIADO / UNMUTE]*\n\n` +
                      `👤 *Usuario:* +${targetNum}\n` +
                      `✅ Silencio removido exitosamente. El usuario ya puede interactuar con el bot.\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // ── 3. Silenciar usuario (.mute @usuario [minutos]) ──
        let target = mentioned[0] || quotedParticipant;
        let minutos = 60;

        if (subCmd === 'add' || subCmd === 'set') {
            if (args[1] && parseInt(args[1], 10)) {
                minutos = parseInt(args[1], 10);
            }
            if (args[2] && parseInt(args[2], 10)) {
                minutos = parseInt(args[2], 10);
            }
        } else {
            if (args[1] && parseInt(args[1], 10)) {
                minutos = parseInt(args[1], 10);
            } else if (args[0] && parseInt(args[0], 10) && !target) {
                minutos = parseInt(args[0], 10);
            }
        }

        if (!target && args[0]) {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw.length >= 7) {
                target = `${raw}@s.whatsapp.net`;
            }
        }

        if (!target && args[1]) {
            const raw = args[1].replace(/[^0-9]/g, '');
            if (raw.length >= 7) {
                target = `${raw}@s.whatsapp.net`;
            }
        }

        if (!target || target === 'undefined@s.whatsapp.net') {
            return await sock.sendMessage(jid, {
                text: `❌ *Uso correcto:*\n` +
                      `• *${pfx}mute @usuario [minutos]* — Silenciar usuario\n` +
                      `• *${pfx}unmute @usuario* — Quitar silencio\n` +
                      `• *${pfx}mute stop @usuario* — Quitar silencio (alternativa)\n` +
                      `• *${pfx}mute list* — Ver lista de silenciados\n\n` +
                      `_Alias admitido: ${pfx}silenciar_\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        if (database.isOwner(target)) {
            return await sock.sendMessage(jid, {
                text: '❌ No puedes silenciar al owner del bot.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const { hasta } = silenciadosManager.silenciarUser(target, minutos, sock);
        const targetNum = target.replace('@s.whatsapp.net', '').split(':')[0];

        try {
            await m.react('🔇');
        } catch (_) {}

        await sock.sendMessage(jid, {
            text: `🔇 *[USUARIO SILENCIADO / MUTE]*\n\n` +
                  `👤 *Usuario:* +${targetNum}\n` +
                  `⏱️ *Duración:* ${minutos} minutos\n` +
                  `🕐 *Hasta:* ${hasta}\n\n` +
                  `🔕 Todos sus comandos y mensajes serán ignorados hasta que expire el tiempo o un Owner ejecute *${pfx}unmute @usuario*.\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

