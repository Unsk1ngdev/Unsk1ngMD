'use strict';

const crypto = require('crypto');
const { cleanJid } = require('../../lib/groupPermissions');

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Actualiza el nombre del grupo a Unknown Codexツ</> DOMINA
 * Usa caracteres Unicode seguros (＜/＞) para no romper el parser XML de WhatsApp.
 */
const updateGroupSubject = async (sock, groupId) => {
    try {
        await sock.groupUpdateSubject(groupId, 'Unknown Codexツ</> DOMINA');
        console.log('[NUKE] Nombre actualizado con éxito a: Unknown Codexツ</> DOMINA');
        return true;
    } catch (e1) {
        try {
            await sock.groupUpdateSubject(groupId, 'Unknown Codex DOMINA');
            console.log('[NUKE] Nombre actualizado con éxito a: Unknown Codex DOMINA');
            return true;
        } catch (e2) {
            console.warn('[NUKE] Error al actualizar nombre:', e2.message);
        }
    }
    return false;
};

/**
 * Actualiza la descripción del grupo a Unknown Codexツ</> DOMINA
 */
const updateGroupDescription = async (sock, groupId) => {
    try {
        await sock.groupUpdateDescription(groupId, 'Unknown Codexツ</> DOMINA');
        console.log('[NUKE] Descripción actualizada con éxito a: Unknown Codexツ</> DOMINA');
        return true;
    } catch (e1) {
        try {
            await sock.groupUpdateDescription(groupId, 'Unknown Codex DOMINA');
            console.log('[NUKE] Descripción actualizada con éxito a: Unknown Codex DOMINA');
            return true;
        } catch (e2) {
            // Fallback IQ directo
            const descId = '3EB0' + crypto.randomBytes(12).toString('hex').toUpperCase();
            try {
                await sock.query({
                    tag: 'iq',
                    attrs: { type: 'set', xmlns: 'w:g2', to: groupId },
                    content: [{
                        tag: 'description',
                        attrs: { id: descId },
                        content: [{ tag: 'body', attrs: {}, content: Buffer.from('Unknown Codexツ</> DOMINA', 'utf-8') }]
                    }]
                });
                console.log('[NUKE] Descripción actualizada con éxito vía IQ directo');
                return true;
            } catch (e3) {
                console.warn('[NUKE] Error al actualizar descripción:', e3.message);
            }
        }
    }
    return false;
};

module.exports = {
    name: 'nuke',
    alias: ['nukear', 'destruir'],
    category: 'grupo',
    desc: 'Expulsa a todos los miembros, renombra, expulsa al owner y el bot sale del grupo',
    usage: '.nuke',
    groupOnly: true,
    adminOnly: false,
    ownerOnly: false,

    execute: async ({ sock, m, isOwner }) => {
        if (!isOwner) return;

        const groupId = m.chat || m.key.remoteJid;

        // 1. Obtener metadata fresca del grupo
        let groupMetadata;
        try {
            groupMetadata = await sock.groupMetadata(groupId);
        } catch (e) {
            return await sock.sendMessage(groupId, {
                text: '❌ No se pudo obtener información del grupo.'
            }, { quoted: m });
        }

        let participants = groupMetadata?.participants || [];

        // Identificadores normalizados anti-LID del bot y del owner
        const botNumber = cleanJid(sock.user?.id || sock.user?.jid);
        const botLid = cleanJid(sock.user?.lid);
        const senderNumber = cleanJid(m.sender);

        const isBotParticipant = (p) => {
            const pNumber = cleanJid(p.id);
            const pLid = cleanJid(p.lid);
            const pJid = cleanJid(p.jid);
            return Boolean(
                (botNumber && (pNumber === botNumber || pLid === botNumber || pJid === botNumber)) ||
                (botLid && (pNumber === botLid || pLid === botLid || pJid === botLid))
            );
        };

        const isOwnerParticipant = (p) => {
            const pNumber = cleanJid(p.id);
            const pLid = cleanJid(p.lid);
            const pJid = cleanJid(p.jid);
            return Boolean(
                senderNumber && (pNumber === senderNumber || pLid === senderNumber || pJid === senderNumber)
            );
        };

        const botMember = participants.find(isBotParticipant);
        const ownerMember = participants.find(isOwnerParticipant);

        // Auto-promover bot a admin si no lo es
        const isBotAdmin = botMember?.admin === 'admin' || botMember?.admin === 'superadmin';
        if (!isBotAdmin) {
            const targetPromote = botMember?.id || `${botNumber}@s.whatsapp.net`;
            await sock.groupParticipantsUpdate(groupId, [targetPromote], 'promote').catch(() => {});
            await sleep(500);
            try {
                groupMetadata = await sock.groupMetadata(groupId);
                participants = groupMetadata?.participants || participants;
            } catch (_) {}
        }

        // ── PASO 1: Desbloqueo, Nombre, Descripción y Degradación de Admins EN PARALELO ──
        console.log('[NUKE] Fase 1: Personalización, desbloqueo y degradación simultánea...');
        const otherAdmins = participants
            .filter(p => (p.admin === 'admin' || p.admin === 'superadmin') && !isBotParticipant(p) && !isOwnerParticipant(p))
            .map(p => p.id);

        await Promise.allSettled([
            sock.groupSettingUpdate(groupId, 'unlocked').catch(() => {}),
            updateGroupSubject(sock, groupId),
            updateGroupDescription(sock, groupId),
            otherAdmins.length > 0 ? sock.groupParticipantsUpdate(groupId, otherAdmins, 'demote').catch(() => {}) : Promise.resolve()
        ]);

        // ── PASO 2: Expulsión masiva en ráfagas de 25 participantes por paquete IQ ──
        let othersToRemove = participants
            .filter(p => !isBotParticipant(p) && !isOwnerParticipant(p))
            .map(p => p.id);

        console.log(`[NUKE] Expulsando ${othersToRemove.length} miembros a máxima velocidad (lotes de 35)...`);

        const chunkSize = 35;
        for (let i = 0; i < othersToRemove.length; i += chunkSize) {
            const chunk = othersToRemove.slice(i, i + chunkSize);
            try {
                await sock.groupParticipantsUpdate(groupId, chunk, 'remove');
            } catch (_) {
                // Fallback rápido en paralelo para este lote
                await Promise.allSettled(chunk.map(u => sock.groupParticipantsUpdate(groupId, [u], 'remove').catch(() => {})));
            }
            if (i + chunkSize < othersToRemove.length) {
                await sleep(60);
            }
        }

        // ── PASO 3: Barrido de verificación ultra rápido ──
        try {
            const verifyMeta = await sock.groupMetadata(groupId);
            const remaining = (verifyMeta?.participants || [])
                .filter(p => !isBotParticipant(p) && !isOwnerParticipant(p))
                .map(p => p.id);

            if (remaining.length > 0) {
                console.log(`[NUKE] Barrido: eliminando ${remaining.length} rezagados...`);
                await sock.groupParticipantsUpdate(groupId, remaining, 'demote').catch(() => {});
                await sock.groupParticipantsUpdate(groupId, remaining, 'remove').catch(() => {});
                await Promise.allSettled(remaining.map(u => sock.groupParticipantsUpdate(groupId, [u], 'remove').catch(() => {})));
            }
        } catch (_) {}

        // ── PASO 4: Mensaje de confirmación final ──
        await sock.sendMessage(groupId, {
            text: '☠️ *NUKE COMPLETADO*\n\n' +
                  '👥 Grupo limpiado\n' +
                  '📝 Unknown Codexツ</> DOMINA\n\n' +
                  '_Unknown Codexツ</> DOMINA_'
        }).catch(() => {});

        // ── PASO 5: Expulsar al owner ahora que todos los miembros salieron ──
        const ownerToRemove = ownerMember?.id || m.sender;
        await sock.groupParticipantsUpdate(groupId, [ownerToRemove], 'remove').catch(() => {});

        // ── PASO 6: El bot sale del grupo ──
        await sleep(400);
        if (typeof sock.groupLeave === 'function') {
            await sock.groupLeave(groupId).catch(() => {});
        }
    }
};
