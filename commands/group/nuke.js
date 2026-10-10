'use strict';

/**
 * Comando: .nuke
 * Descripción: Destruye el grupo — expulsa a todos (salvo bot y ejecutor),
 *              renombra el grupo y cambia su descripción.
 * Requiere: el bot debe ser administrador del grupo.
 */

const DELAY_MS = 500; // ms entre cada expulsión (evitar rate-limit de WA)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Normaliza un JID eliminando el sufijo de dispositivo (:X) para comparar
 * correctamente IDs entre participantes y el JID del bot/sender.
 */
const normalizeJid = (jid = '') => jid.replace(/:\d+@/, '@').toLowerCase();

module.exports = {
    name: 'nuke',
    alias: ['nukear', 'destruir'],
    category: 'grupo',
    desc: 'Expulsa a todos los miembros, renombra y cambia la descripción del grupo',
    usage: '.nuke',
    groupOnly: true,
    adminOnly: false,   // La verificación se hace manualmente (también validamos botAdmin)
    botAdminRequired: true,

    execute: async ({ sock, m, isAdmin, isOwner, isBotAdmin, participants }) => {
        const jid = m.chat;

        // ── 1. Verificar permisos ────────────────────────────────────────────
        if (!isBotAdmin) {
            return await sock.sendMessage(jid, {
                text: '⚠️ El bot no es administrador del grupo. Otórgale permisos de admin para usar este comando.'
            }, { quoted: m });
        }

        if (!isAdmin && !isOwner) {
            return await sock.sendMessage(jid, {
                text: '🚫 No tienes permisos para usar este comando.'
            }, { quoted: m });
        }

        // ── 2. Confirmar inicio ──────────────────────────────────────────────
        await m.react('💣');
        await sock.sendMessage(jid, {
            text: '☢️ *NUKE ACTIVADO* — Iniciando limpieza del grupo...'
        }, { quoted: m });

        // ── 3. Calcular a quién expulsar ─────────────────────────────────────
        const botJid   = normalizeJid(sock.user?.id || '');
        const senderJid = normalizeJid(m.sender || '');

        const toRemove = (participants || [])
            .filter(p => {
                const pid = normalizeJid(p.id);
                return pid !== botJid && pid !== senderJid;
            })
            .map(p => p.id);

        // ── 4. Expulsar uno a uno ────────────────────────────────────────────
        let expelled = 0;
        for (const participantJid of toRemove) {
            try {
                await sock.groupParticipantsUpdate(jid, [participantJid], 'remove');
                expelled++;
            } catch (err) {
                // Ignorar errores individuales (ya expulsado, admin, etc.)
                console.warn(`[nuke] No se pudo expulsar a ${participantJid}:`, err.message);
            }
            await sleep(DELAY_MS);
        }

        // ── 5. Renombrar grupo y cambiar descripción ─────────────────────────
        const newName = 'Unknown Codexツ</>';
        const newDesc  = 'Unknown Codexツ</>';

        try {
            await sock.groupUpdateSubject(jid, newName);
        } catch (err) {
            console.warn('[nuke] No se pudo cambiar el nombre del grupo:', err.message);
        }

        try {
            await sock.groupUpdateDescription(jid, newDesc);
        } catch (err) {
            console.warn('[nuke] No se pudo cambiar la descripción del grupo:', err.message);
        }

        // ── 6. Resumen final ─────────────────────────────────────────────────
        await m.react('✅');
        await sock.sendMessage(jid, {
            text: `💀 *NUKE completado.*\n👥 Miembros expulsados: *${expelled}*\n✏️ Grupo renombrado a: *${newName}*`
        }, { quoted: m });
    }
};
