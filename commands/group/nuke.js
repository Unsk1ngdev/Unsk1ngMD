'use strict';

/**
 * Comando: .nuke
 * Cuando el owner use .nuke en un grupo:
 * 1. Verifica que quien ejecuta sea el owner del bot. Si no es, ignora completamente.
 * 2. Verifica que el bot sea administrador del grupo.
 * 3. Expulsa a TODOS los miembros excepto al bot (el owner TAMBIÉN es expulsado).
 * 4. Expulsa en bloques de 5 con Promise.all() y 300ms de pausa anti-ban.
 * 5. Cambia el nombre a: Unknown Codexツ</> DOMINA
 * 6. Cambia la descripción a: Unknown Codexツ</> DOMINA
 * 7. Envía mensaje de confirmación final.
 */

module.exports = {
    name: 'nuke',
    alias: ['nukear', 'destruir'],
    category: 'grupo',
    desc: 'Expulsa a todos los miembros y domina el grupo (solo owner)',
    usage: '.nuke',
    groupOnly: true,
    adminOnly: false,
    ownerOnly: false, // Manejo manual para ignorar silenciosamente si no es owner

    execute: async ({ sock, m, isOwner }) => {
        // 1. Solo owner (ignorar completamente si no es el owner)
        if (!isOwner) return;

        const groupId = m.chat || m.key.remoteJid;

        // Obtener metadata fresca del grupo
        let groupMetadata;
        try {
            groupMetadata = await sock.groupMetadata(groupId);
        } catch (err) {
            console.error('[NUKE] Error obteniendo metadata del grupo:', err.message);
            return;
        }

        const participants = groupMetadata?.participants || [];

        // ── Limpiar JID del bot correctamente ──
        // Algunos bots tienen formato 1234567890:12@s.whatsapp.net o lid
        // se normaliza tanto a 1234567890@s.whatsapp.net como a dígitos numéricos
        const rawBotId = sock.user?.id || sock.user?.jid || '';
        const botNum = rawBotId.split(':')[0].replace(/[^0-9]/g, '');
        const botJid = botNum ? `${botNum}@s.whatsapp.net` : '';

        // ── Verificar que el bot sea admin ──
        const botParticipant = participants.find(p => {
            const pNum = (p.id || '').split(':')[0].replace(/[^0-9]/g, '');
            const pLid = (p.lid || '').split(':')[0].replace(/[^0-9]/g, '');
            const pClean = pNum ? `${pNum}@s.whatsapp.net` : '';
            return (botJid && pClean === botJid) || (botNum && (pNum === botNum || pLid === botNum));
        });

        if (!botParticipant?.admin) {
            return await sock.sendMessage(groupId, {
                text: '❌ El bot necesita ser *administrador* del grupo para ejecutar .nuke'
            }, { quoted: m });
        }

        await sock.sendMessage(groupId, {
            text: '💀 *Ejecutando NUKE...*\n☠️ Preparando expulsión masiva...'
        });

        // ── PASO 1: Obtener TODOS excepto el bot ──
        // ⚠️ IMPORTANTE: El owner TAMBIÉN debe ser expulsado, NO conservar a nadie excepto al bot
        const toRemove = participants
            .filter(p => {
                const pNum = (p.id || '').split(':')[0].replace(/[^0-9]/g, '');
                const pLid = (p.lid || '').split(':')[0].replace(/[^0-9]/g, '');
                const isBot = (botNum && (pNum === botNum || pLid === botNum)) ||
                              (botJid && `${pNum}@s.whatsapp.net` === botJid);
                return !isBot; // Solo excluir el bot
            })
            .map(p => p.id);

        console.log(`[NUKE] Expulsando ${toRemove.length} miembros...`);

        // ── PASO 2: Expulsar en bloques de 5 (rápido y seguro) ──
        const chunkSize = 5;
        for (let i = 0; i < toRemove.length; i += chunkSize) {
            const chunk = toRemove.slice(i, i + chunkSize);
            await Promise.all(
                chunk.map(user =>
                    sock.groupParticipantsUpdate(groupId, [user], 'remove')
                        .catch(e => console.log(`[NUKE] Error expulsando ${user}:`, e.message))
                )
            );
            await new Promise(r => setTimeout(r, 300)); // pausa mínima anti-ban
        }

        console.log('[NUKE] Expulsión completada, cambiando nombre y descripción...');

        // ── PASO 3: Cambiar nombre y descripción al mismo tiempo ──
        await Promise.all([
            sock.groupUpdateSubject(groupId, 'Unknown Codexツ</> DOMINA')
                .catch(e => console.log('[NUKE] Error nombre:', e.message)),
            sock.groupUpdateDescription(groupId, 'Unknown Codexツ</> DOMINA')
                .catch(e => console.log('[NUKE] Error descripción:', e.message))
        ]);

        // ── PASO 4: Confirmación final ──
        await sock.sendMessage(groupId, {
            text: '☠️ *NUKE COMPLETADO*\n\n' +
                  '👥 Grupo limpiado\n' +
                  '📝 Nombre actualizado\n' +
                  '📋 Descripción actualizada\n\n' +
                  '_Unknown Codexツ</> DOMINA_'
        });

        console.log('[NUKE] Completado exitosamente.');
    }
};
