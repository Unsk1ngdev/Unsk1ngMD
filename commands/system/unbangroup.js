'use strict';

const bannedManager = require('../../lib/banned');

module.exports = {
    name: 'unbangroup',
    alias: ['unbangp', 'desbaneargrupo', 'unbangk', 'unbanchat'],
    category: 'owner',
    desc: 'Restaura el funcionamiento del bot en un grupo previamente baneado (solo owner)',
    usage: '.unbangroup | .unbangroup [jid_grupo]',
    ownerOnly: true,

    execute: async ({ sock, m, args, isOwner, prefix, groupMetadata }) => {
        if (!isOwner && !bannedManager.isOwner(m.sender)) return;

        const pfx = prefix || '.';

        // ── 1. Resolver JID del grupo a desbanear ──
        let targetJid = null;
        if (args[0] && args[0].endsWith('@g.us')) {
            targetJid = args[0].trim();
        } else if (m.isGroup) {
            targetJid = m.chat;
        }

        if (!targetJid || !targetJid.endsWith('@g.us')) {
            return await sock.sendMessage(m.chat, {
                text: `❌ *Uso incorrecto:*\n` +
                      `• Dentro del grupo baneado: *${pfx}unbangroup*\n` +
                      `• Desde cualquier chat: *${pfx}unbangroup [jid_del_grupo]*`
            }, { quoted: m });
        }

        // ── 2. Comprobar si realmente está baneado ──
        if (!bannedManager.isGroupBanned(targetJid)) {
            return await sock.sendMessage(m.chat, {
                text: `⚠️ El grupo \`${targetJid}\` no figura en la lista de grupos baneados.`
            }, { quoted: m });
        }

        // ── 3. Obtener nombre del grupo de forma segura ──
        let groupName = 'Grupo';
        if (targetJid === m.chat && groupMetadata?.subject) {
            groupName = groupMetadata.subject;
        } else {
            try {
                const meta = await sock.groupMetadata(targetJid);
                if (meta?.subject) groupName = meta.subject;
            } catch (_) {}
        }

        // ── 4. Levantar la suspensión ──
        bannedManager.unbanGroup(targetJid);

        try {
            await m.react('🔓');
        } catch (_) {}

        const unbanNotice =
            `╔══════════════════════╗\n` +
            `║  🔓 *GRUPO DESBANEADO / ACTIVO* ║\n` +
            `╚══════════════════════╝\n\n` +
            `📌 *Grupo:* ${groupName}\n` +
            `🆔 *JID:* \`${targetJid}\`\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ *ESTADO:* La suspensión ha sido retirada por el Owner.\n` +
            `• El bot vuelve a estar plenamente operativo para todos los miembros.\n` +
            `• Ya pueden utilizar todos los comandos disponibles (*${pfx}menu*, descargas, IA, juegos, etc.).\n\n` +
            `_Unknown Codexツ</>_`;

        if (targetJid === m.chat) {
            await sock.sendMessage(m.chat, { text: unbanNotice }, { quoted: m });
        } else {
            await sock.sendMessage(m.chat, {
                text: `✅ *Grupo desbaneado exitosamente:*\n\n📌 *Nombre:* ${groupName}\n🆔 *JID:* \`${targetJid}\`\nEl bot ya responde en ese grupo.`
            }, { quoted: m });

            try {
                await sock.sendMessage(targetJid, { text: unbanNotice });
            } catch (_) {}
        }
    }
};

