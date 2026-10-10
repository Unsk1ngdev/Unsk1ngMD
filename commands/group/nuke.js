'use strict';

/**
 * Comando: .nuke
 * Descripción: Destruye el grupo — expulsa a todos (salvo bot y ejecutor),
 *              renombra el grupo y cambia su descripción.
 * Requiere: el bot Y el ejecutor deben ser administradores del grupo.
 *
 * NOTAS TÉCNICAS:
 * - Los metadatos se consultan en TIEMPO REAL (ignora el caché del handler).
 * - La detección de admin usa comparación por DÍGITOS PUROS del número para
 *   ser 100% inmune a variantes de JID: @s.whatsapp.net, @lid, sufijos :N.
 */

const DELAY_MS = 500;
const sleep    = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Extrae solo los dígitos de un JID de cualquier formato:
 *   "5491134567890:1@s.whatsapp.net" → "5491134567890"
 *   "5491134567890@lid"              → "5491134567890"
 *   "5491134567890@s.whatsapp.net"   → "5491134567890"
 */
const jidToNumber = (jid = '') => jid.split('@')[0].split(':')[0].replace(/\D/g, '');

/**
 * Busca un participante comparando SOLO los dígitos del número.
 * Esto es inmune a cualquier variante de dominio o sufijo de dispositivo.
 */
const findByNumber = (participants, rawJid) => {
    const target = jidToNumber(rawJid);
    if (!target) return null;
    return participants.find(p => jidToNumber(p.id) === target) || null;
};

const isGroupAdmin = (member) =>
    member?.admin === 'admin' || member?.admin === 'superadmin';

module.exports = {
    name: 'nuke',
    alias: ['nukear', 'destruir'],
    category: 'grupo',
    desc: 'Expulsa a todos los miembros, renombra y cambia la descripción del grupo',
    usage: '.nuke',
    groupOnly: true,
    adminOnly: false,
    botAdminRequired: false,

    execute: async ({ sock, m, isOwner }) => {
        const jid = m.chat;

        // ── 1. Metadatos FRESCOS del grupo ───────────────────────────────────
        let meta;
        try {
            meta = await sock.groupMetadata(jid);
        } catch (err) {
            return await sock.sendMessage(jid, {
                text: '❌ No se pudieron obtener los datos del grupo. Inténtalo de nuevo.'
            }, { quoted: m });
        }

        const participants = meta.participants || [];

        // JIDs en crudo (sin normalizar — findByNumber lo maneja)
        const botRawJid    = sock.user?.id || '';
        const senderRawJid = m.sender || '';

        // Buscar por número puro (robusto contra @lid, @s.whatsapp.net, :N)
        const botMember    = findByNumber(participants, botRawJid);
        const senderMember = findByNumber(participants, senderRawJid);

        // Debug silencioso en consola (ayuda a diagnosticar en producción)
        console.log('[nuke] botJid:', botRawJid, '→ encontrado:', botMember?.id, '| admin:', botMember?.admin);
        console.log('[nuke] senderJid:', senderRawJid, '→ encontrado:', senderMember?.id, '| admin:', senderMember?.admin);

        const isBotAdmin    = isGroupAdmin(botMember);
        const isSenderAdmin = isGroupAdmin(senderMember);

        // ── 2. Verificar permisos ─────────────────────────────────────────────
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

        // ── 3. Lista de expulsión (excluye bot y ejecutor) ────────────────────
        const botNum    = jidToNumber(botRawJid);
        const senderNum = jidToNumber(senderRawJid);

        const toRemove = participants
            .filter(p => {
                const num = jidToNumber(p.id);
                return num !== botNum && num !== senderNum;
            })
            .map(p => p.id);

        // ── 4. Confirmar inicio ───────────────────────────────────────────────
        await m.react('💣');
        await sock.sendMessage(jid, {
            text: `☢️ *NUKE ACTIVADO*\n👥 Expulsando *${toRemove.length}* miembros...`
        }, { quoted: m });

        // ── 5. Expulsar uno a uno con delay ───────────────────────────────────
        let expelled = 0;
        for (const pJid of toRemove) {
            try {
                await sock.groupParticipantsUpdate(jid, [pJid], 'remove');
                expelled++;
            } catch (err) {
                console.warn(`[nuke] No se pudo expulsar ${pJid}: ${err.message}`);
            }
            await sleep(DELAY_MS);
        }

        // ── 6. Renombrar y cambiar descripción ────────────────────────────────
        const newName = 'Unknown Codexツ</>';
        const newDesc  = 'Unknown Codexツ</>';

        try { await sock.groupUpdateSubject(jid, newName); }
        catch (err) { console.warn('[nuke] Nombre no cambiado:', err.message); }

        try { await sock.groupUpdateDescription(jid, newDesc); }
        catch (err) { console.warn('[nuke] Descripción no cambiada:', err.message); }

        // ── 7. Resumen final ──────────────────────────────────────────────────
        await m.react('✅');
        await sock.sendMessage(jid, {
            text: `💀 *NUKE completado.*\n👥 Expulsados: *${expelled}/${toRemove.length}*\n✏️ Grupo: *${newName}*`
        }, { quoted: m });
    }
};
