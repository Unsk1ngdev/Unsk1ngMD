'use strict';

/**
 * Comando: .spy @usuario
 * Premium + Owner: Muestra los grupos en común entre el bot y el número indicado.
 */

const premium = require('../../lib/premium');

module.exports = {
    name: 'spy',
    alias: ['gruposcomunes', 'commongroups'],
    category: 'tools',
    desc: 'Muestra los grupos en común entre el bot y un número (Premium)',
    usage: '.spy @usuario',
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
                text: '❌ Menciona a un usuario o proporciona su número.\n*Uso:* `.spy @usuario`'
            }, { quoted: m });
        }

        await m.react('⏳');

        try {
            // Verificar que el número existe en WhatsApp
            const check = await sock.onWhatsApp(targetJid).catch(() => null);
            if (!check?.[0]?.exists) {
                await m.react('❌');
                return await sock.sendMessage(m.chat, {
                    text: '❌ Ese número no está registrado en WhatsApp.'
                }, { quoted: m });
            }

            const validJid = check[0].jid;
            const number   = validJid.split('@')[0];

            // ── Obtener grupos en común ────────────────────────────────────────
            const commonGroups = await sock.commonGroups(validJid).catch(() => []);

            if (!commonGroups || commonGroups.length === 0) {
                await m.react('✅');
                return await sock.sendMessage(m.chat, {
                    text: [
                        `🕵️ *SPY — +${number}*`,
                        ``,
                        `❌ No hay grupos en común entre el bot y este número.`,
                        ``,
                        `_Unknown Codexツ</>_`
                    ].join('\n')
                }, { quoted: m });
            }

            // ── Obtener metadatos de cada grupo ───────────────────────────────
            const groupLines = [];
            for (const groupJid of commonGroups.slice(0, 20)) { // máx 20 para no spamear
                try {
                    const meta = await sock.groupMetadata(groupJid).catch(() => null);
                    if (meta) {
                        const memberCount = meta.participants?.length || 0;
                        groupLines.push(`👥 *${meta.subject || 'Sin nombre'}* (${memberCount} miembros)`);
                    } else {
                        groupLines.push(`📦 \`${groupJid}\``);
                    }
                } catch (_) {
                    groupLines.push(`📦 \`${groupJid}\``);
                }
            }

            const extraNote = commonGroups.length > 20
                ? `\n_...y ${commonGroups.length - 20} grupo(s) más_`
                : '';

            await m.react('✅');
            await sock.sendMessage(m.chat, {
                text: [
                    `🕵️ *SPY — +${number}*`,
                    ``,
                    `📊 *Grupos en común:* ${commonGroups.length}`,
                    ``,
                    ...groupLines,
                    extraNote,
                    ``,
                    `_Unknown Codexツ</>_`
                ].filter(s => s !== undefined).join('\n')
            }, { quoted: m });

        } catch (err) {
            await m.react('❌');
            await sock.sendMessage(m.chat, {
                text: `❌ Error: ${err.message}`
            }, { quoted: m });
        }
    }
};

