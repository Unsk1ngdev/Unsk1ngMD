'use strict';

/**
 * Comando: .clonar [@usuario | número]
 * Premium + Owner: Copia temporalmente la foto de perfil y estado/about
 * de un número y los aplica al perfil del bot.
 *
 * ⚠️ El perfil original del bot se restaura automáticamente después de 5 minutos.
 */

const premium = require('../../lib/premium');
const axios   = require('axios');

const RESTORE_DELAY = 5 * 60 * 1000; // 5 minutos

module.exports = {
    name: 'clonar',
    alias: ['clone', 'copiar'],
    category: 'tools',
    desc: 'Copia temporalmente la foto y estado de un número al perfil del bot (Premium)',
    usage: '.clonar @usuario',
    groupOnly: false,
    adminOnly: false,

    execute: async ({ sock, m, args, isOwner }) => {
        // ── Verificar acceso premium o owner ─────────────────────────────────
        if (!isOwner && !premium.isPremium(m.sender)) {
            return await sock.sendMessage(m.chat, {
                text: '⭐ Este comando es exclusivo para miembros *Premium*.\n\n💎 Contacta al owner para obtener acceso.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        // ── Resolver JID objetivo ─────────────────────────────────────────────
        let targetJid = null;
        if (m.mentionedJid?.length > 0) {
            targetJid = m.mentionedJid[0];
        } else if (m.quoted?.sender) {
            targetJid = m.quoted.sender;
        } else if (args[0]) {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw.length >= 7) targetJid = `${raw}@s.whatsapp.net`;
        }

        if (!targetJid) {
            return await sock.sendMessage(m.chat, {
                text: '❌ Menciona a un usuario o proporciona su número.\n*Uso:* `.clonar @usuario`'
            }, { quoted: m });
        }

        await m.react('⏳');

        try {
            // ── Verificar que el número esté en WhatsApp ──────────────────────
            const check = await sock.onWhatsApp(targetJid).catch(() => null);
            if (!check?.[0]?.exists) {
                await m.react('❌');
                return await sock.sendMessage(m.chat, {
                    text: '❌ Ese número no está registrado en WhatsApp.'
                }, { quoted: m });
            }

            const validJid = check[0].jid;
            const number   = validJid.split('@')[0];

            // ── Obtener foto de perfil y estado del objetivo ──────────────────
            const [ppUrl, statusRes] = await Promise.all([
                sock.profilePictureUrl(validJid, 'image').catch(() => null),
                sock.fetchStatus(validJid).catch(() => null)
            ]);

            // ── Guardar perfil actual del bot para restaurar después ───────────
            const [botPpUrl, botStatus] = await Promise.all([
                sock.profilePictureUrl(sock.user.id, 'image').catch(() => null),
                sock.fetchStatus(sock.user.id).catch(() => null)
            ]);

            // ── Aplicar foto del objetivo al bot ──────────────────────────────
            if (ppUrl) {
                try {
                    const { data: imgBuffer } = await axios.get(ppUrl, {
                        responseType: 'arraybuffer',
                        timeout: 15000
                    });
                    await sock.updateProfilePicture(sock.user.id, Buffer.from(imgBuffer));
                } catch (err) {
                    console.warn('[clonar] No se pudo actualizar foto del bot:', err.message);
                }
            }

            // ── Aplicar estado/about del objetivo al bot ──────────────────────
            const newStatus = statusRes?.status || `Copiado de +${number}`;
            try {
                await sock.updateProfileStatus(newStatus);
            } catch (err) {
                console.warn('[clonar] No se pudo actualizar estado del bot:', err.message);
            }

            await m.react('✅');
            await sock.sendMessage(m.chat, {
                text: [
                    `🪞 *Clonación completada*`,
                    ``,
                    `👤 Número clonado: *+${number}*`,
                    `📸 Foto: *${ppUrl ? 'Aplicada' : 'No disponible'}*`,
                    `💬 Estado: *${newStatus}*`,
                    ``,
                    `⏱️ El perfil original se restaurará en *5 minutos*`,
                    ``,
                    `_Unknown Codexツ</>_`
                ].join('\n')
            }, { quoted: m });

            // ── Restaurar perfil original después de 5 minutos ────────────────
            setTimeout(async () => {
                try {
                    if (botPpUrl) {
                        const { data: origBuf } = await axios.get(botPpUrl, {
                            responseType: 'arraybuffer',
                            timeout: 15000
                        });
                        await sock.updateProfilePicture(sock.user.id, Buffer.from(origBuf));
                    }
                    const origStatus = botStatus?.status || '';
                    if (origStatus) await sock.updateProfileStatus(origStatus);
                    console.log('[clonar] Perfil restaurado correctamente.');
                } catch (err) {
                    console.warn('[clonar] Error restaurando perfil:', err.message);
                }
            }, RESTORE_DELAY);

        } catch (err) {
            await m.react('❌');
            await sock.sendMessage(m.chat, {
                text: `❌ Error al clonar: ${err.message}`
            }, { quoted: m });
        }
    }
};

