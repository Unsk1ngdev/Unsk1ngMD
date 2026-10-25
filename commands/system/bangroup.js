'use strict';

const bannedManager = require('../../lib/banned');

module.exports = {
    name: 'bangroup',
    alias: ['bangp', 'baneargrupo', 'bangk', 'banchat'],
    category: 'owner',
    desc: 'Banea y suspende completamente el funcionamiento del bot en un grupo (solo owner)',
    usage: '.bangroup [motivo] | .bangroup [jid_grupo] [motivo] | .bangroup list',
    ownerOnly: true,

    execute: async ({ sock, m, args, text, isOwner, prefix, groupMetadata }) => {
        if (!isOwner && !bannedManager.isOwner(m.sender)) return;

        const subCmd = (args[0] || '').toLowerCase();
        const pfx = prefix || '.';

        // ── 1. Ver lista de grupos baneados (.bangroup list) ──
        if (subCmd === 'list') {
            const groups = bannedManager.listGroups();
            if (groups.length === 0) {
                return await sock.sendMessage(m.chat, {
                    text: '📋 *No hay ningún grupo baneado en este momento.*'
                }, { quoted: m });
            }

            const lista = groups.map((g, i) =>
                `*${i + 1}.* ${g.name || 'Grupo'}\n   🆔 \`${g.jid}\`\n   📝 Motivo: _${g.reason}_\n   🕐 Fecha: ${g.fecha}`
            ).join('\n\n');

            return await sock.sendMessage(m.chat, {
                text: `╔══════════════════════╗\n` +
                      `║  🚫 *GRUPOS BANEADOS (${groups.length})*  ║\n` +
                      `╚══════════════════════╝\n\n` +
                      `${lista}\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━\n` +
                      `💡 *Para reactivar un grupo:* *${pfx}unbangroup [jid]*\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // ── 2. Resolver JID del grupo a banear ──
        let targetJid = null;
        let reason = '';

        if (args[0] && args[0].endsWith('@g.us')) {
            targetJid = args[0].trim();
            reason = args.slice(1).join(' ').trim();
        } else if (m.isGroup) {
            targetJid = m.chat;
            reason = (text || '').trim();
        }

        if (!targetJid || !targetJid.endsWith('@g.us')) {
            return await sock.sendMessage(m.chat, {
                text: `❌ *Uso incorrecto:*\n` +
                      `• Dentro del grupo: *${pfx}bangroup [motivo opcional]*\n` +
                      `• Desde cualquier chat: *${pfx}bangroup [jid_del_grupo] [motivo]*\n` +
                      `• Ver lista de baneados: *${pfx}bangroup list*`
            }, { quoted: m });
        }

        // ── 3. Comprobar si ya está baneado ──
        if (bannedManager.isGroupBanned(targetJid)) {
            return await sock.sendMessage(m.chat, {
                text: `⚠️ Este grupo ya se encuentra registrado en la lista negra de grupos baneados.\nUsa *${pfx}unbangroup* para reactivarlo.`
            }, { quoted: m });
        }

        // ── 4. Obtener nombre del grupo de forma segura ──
        let groupName = 'Grupo';
        if (targetJid === m.chat && groupMetadata?.subject) {
            groupName = groupMetadata.subject;
        } else {
            try {
                const meta = await sock.groupMetadata(targetJid);
                if (meta?.subject) groupName = meta.subject;
            } catch (_) {}
        }

        const finalReason = reason || 'Suspensión aplicada por el Owner';

        // ── 5. Registrar baneo del grupo ──
        bannedManager.banGroup(targetJid, groupName, finalReason);

        try {
            await m.react('🔒');
        } catch (_) {}

        const banNotice =
            `╔══════════════════════╗\n` +
            `║  🔒 *GRUPO BANEADO / BLOQUEADO* ║\n` +
            `╚══════════════════════╝\n\n` +
            `📌 *Grupo:* ${groupName}\n` +
            `🆔 *JID:* \`${targetJid}\`\n` +
            `📝 *Motivo:* ${finalReason}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `⚠️ *ESTADO DEL BOT EN ESTE GRUPO:*\n` +
            `• El bot ha sido suspendido y no responderá a ningún comando ni interacción de los miembros.\n` +
            `• Los juegos, comandos multimedia y funciones quedan totalmente deshabilitados.\n` +
            `• Solo un Owner podrá reactivar el bot mediante el comando *${pfx}unbangroup*.\n\n` +
            `_Unknown Codexツ</>_`;

        // Si fue ejecutado en el mismo grupo, enviar el aviso allí
        if (targetJid === m.chat) {
            await sock.sendMessage(m.chat, { text: banNotice }, { quoted: m });
        } else {
            // Si fue ejecutado remotamente por el owner, notificar al owner y también al grupo objetivo
            await sock.sendMessage(m.chat, {
                text: `✅ *Grupo baneado exitosamente:*\n\n📌 *Nombre:* ${groupName}\n🆔 *JID:* \`${targetJid}\`\n📝 *Motivo:* ${finalReason}`
            }, { quoted: m });

            try {
                await sock.sendMessage(targetJid, { text: banNotice });
            } catch (_) {}
        }
    }
};

