'use strict';

/**
 * Comando: .nuke
 * Descripción: Destruye el grupo — expulsa a todos (salvo bot y ejecutor),
 *              renombra el grupo y cambia su descripción.
 * Requiere: el bot y el ejecutor deben ser administradores del grupo.
 *
 * NOTA: Los metadatos se consultan en TIEMPO REAL para evitar falsos
 *       negativos por el caché de 30s del handler.
 */

const DELAY_MS = 500; // ms entre expulsiones (evitar rate-limit de WA)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Normaliza un JID eliminando el sufijo de dispositivo (:X)
 * y unifica en minúsculas para comparaciones seguras.
 */
const normalizeJid = (jid = '') =>
    jid.replace(/:\d+@/, '@').toLowerCase().trim();

module.exports = {
    name: 'nuke',
    alias: ['nukear', 'destruir'],
    category: 'grupo',
    desc: 'Expulsa a todos los miembros, renombra y cambia la descripción del grupo',
    usage: '.nuke',
    groupOnly: true,
    adminOnly: false,   // Verificación manual con metadatos frescos
    botAdminRequired: false, // Ídem

    execute: async ({ sock, m, isOwner }) => {
        const jid = m.chat;

        // ── 1. Consulta FRESCA de metadatos (ignora el caché del handler) ────
        let meta;
        try {
            meta = await sock.groupMetadata(jid);
        } catch (err) {
            return await sock.sendMessage(jid, {
                text: '❌ No se pudieron obtener los datos del grupo. Inténtalo de nuevo.'
            }, { quoted: m });
        }

        const participants = meta.participants || [];

        const botJid    = normalizeJid(sock.user?.id || '');
        const senderJid = normalizeJid(m.sender || '');

        // Función de búsqueda robusta (tolera @lid y @s.whatsapp.net)
        const findParticipant = (targetJid) =>
            participants.find(p =>
                normalizeJid(p.id) === targetJid ||
                (p.lid && normalizeJid(p.lid) === targetJid)
            );

        const botMember    = findParticipant(botJid);
        const senderMember = findParticipant(senderJid);

        const isBotAdmin    = botMember?.admin === 'admin' || botMember?.admin === 'superadmin';
        const isSenderAdmin = senderMember?.admin === 'admin' || senderMember?.admin === 'superadmin';

        // ── 2. Verificar permisos ────────────────────────────────────────────
        if (!isBotAdmin) {
            return await sock.sendMessage(jid, {
                text: '⚠️ El bot no es administrador del grupo.\nOtórgale permisos de *admin* para usar este comando.'
            }, { quoted: m });
        }

        if (!isSenderAdmin && !isOwner) {
            return await sock.sendMessage(jid, {
                text: '🚫 No tienes permisos para usar este comando.\nDebes ser *administrador* del grupo.'
            }, { quoted: m });
        }

        // ── 3. Calcular a quién expulsar ─────────────────────────────────────
        const toRemove = participants
            .filter(p => {
                const pid = normalizeJid(p.id);
                // Conservar: bot y quien ejecuta el comando
                return pid !== botJid && pid !== senderJid;
            })
            .map(p => p.id);

        // ── 4. Confirmar inicio ──────────────────────────────────────────────
        await m.react('💣');
        await sock.sendMessage(jid, {
            text: `☢️ *NUKE ACTIVADO*\n👥 Expulsando *${toRemove.length}* miembros...`
        }, { quoted: m });

        // ── 5. Expulsar uno a uno ────────────────────────────────────────────
        let expelled = 0;
        for (const participantJid of toRemove) {
            try {
                await sock.groupParticipantsUpdate(jid, [participantJid], 'remove');
                expelled++;
            } catch (err) {
                // Ignorar errores individuales (ya expulsado, es admin, etc.)
                console.warn(`[nuke] No se pudo expulsar ${participantJid}: ${err.message}`);
            }
            await sleep(DELAY_MS);
        }

        // ── 6. Renombrar grupo y cambiar descripción ─────────────────────────
        const newName = 'Unknown Codexツ</>';
        const newDesc  = 'Unknown Codexツ</>';

        try {
            await sock.groupUpdateSubject(jid, newName);
        } catch (err) {
            console.warn('[nuke] No se pudo cambiar el nombre:', err.message);
        }

        try {
            await sock.groupUpdateDescription(jid, newDesc);
        } catch (err) {
            console.warn('[nuke] No se pudo cambiar la descripción:', err.message);
        }

        // ── 7. Resumen final ─────────────────────────────────────────────────
        await m.react('✅');
        await sock.sendMessage(jid, {
            text: `💀 *NUKE completado.*\n👥 Expulsados: *${expelled}/${toRemove.length}*\n✏️ Grupo: *${newName}*`
        }, { quoted: m });
    }
};
