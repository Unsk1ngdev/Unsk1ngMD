'use strict';

/**
 * Comando: .nuke
 * Cuando el owner use .nuke en un grupo:
 * 1. Verifica que quien ejecuta es el owner del bot. Si no es, ignora completamente.
 * 2. Verifica el estado de admin del bot Y del owner:
 *    - CASO A: Bot ES admin -> Ejecuta nuke directamente.
 *    - CASO B: Bot NO es admin PERO el owner SÍ es admin ->
 *              Promueve al bot a admin automáticamente, espera 2 segundos, y ejecuta nuke.
 *    - CASO C: Ni el bot ni el owner son admin ->
 *              Avisa que ninguno es admin y se detiene sin ejecutar nada.
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
        // Solo owner (ignorar completamente si no es el owner)
        if (!isOwner) return;

        const groupId = m.chat || m.key.remoteJid;

        // Obtener metadata del grupo
        let groupMetadata;
        try {
            groupMetadata = await sock.groupMetadata(groupId);
        } catch (e) {
            return await sock.sendMessage(groupId, {
                text: '❌ No se pudo obtener información del grupo.'
            }, { quoted: m });
        }

        let participants = groupMetadata?.participants || [];

        // ── Limpiar JIDs correctamente ──
        const rawBotId = sock.user?.id || sock.user?.jid || '';
        const botNum = rawBotId.split(':')[0].replace(/[^0-9]/g, '');
        const botJid = botNum ? `${botNum}@s.whatsapp.net` : '';

        const rawOwnerId = m.sender || '';
        const ownerNum = rawOwnerId.split(':')[0].replace(/[^0-9]/g, '');
        const ownerJid = ownerNum ? `${ownerNum}@s.whatsapp.net` : '';

        // ── Verificar estado de admin del bot y del owner ──
        const botParticipant = participants.find(p => {
            const pNum = (p.id || '').split(':')[0].replace(/[^0-9]/g, '');
            const pLid = (p.lid || '').split(':')[0].replace(/[^0-9]/g, '');
            const pClean = pNum ? `${pNum}@s.whatsapp.net` : '';
            return (botJid && pClean === botJid) || (botNum && (pNum === botNum || pLid === botNum));
        });

        const ownerParticipant = participants.find(p => {
            const pNum = (p.id || '').split(':')[0].replace(/[^0-9]/g, '');
            const pLid = (p.lid || '').split(':')[0].replace(/[^0-9]/g, '');
            const pClean = pNum ? `${pNum}@s.whatsapp.net` : '';
            return (ownerJid && pClean === ownerJid) || (ownerNum && (pNum === ownerNum || pLid === ownerNum));
        });

        const botIsAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
        const ownerIsAdmin = ownerParticipant?.admin === 'admin' || ownerParticipant?.admin === 'superadmin';

        console.log(`[NUKE] Bot admin: ${botIsAdmin} | Owner admin: ${ownerIsAdmin}`);
        console.log(`[NUKE] Bot JID: ${botJid}`);
        console.log(`[NUKE] Owner JID: ${ownerJid}`);

        // ── CASO C: Ninguno es admin ──
        if (!botIsAdmin && !ownerIsAdmin) {
            return await sock.sendMessage(groupId, {
                text: '❌ *Ni tú ni el bot son administradores del grupo.*\n\n' +
                      '📌 Para usar .nuke necesitas:\n' +
                      '1. Ser admin del grupo\n' +
                      '2. Hacer al bot admin también'
            }, { quoted: m });
        }

        // ── CASO B: Owner es admin pero bot NO es admin ──
        if (!botIsAdmin && ownerIsAdmin) {
            await sock.sendMessage(groupId, {
                text: '⚠️ El bot no es admin.\n🔄 Promoviendo al bot automáticamente...'
            });

            try {
                // El target para promover es el JID del bot en la lista de participantes
                const targetPromote = botParticipant?.id || botJid;
                await sock.groupParticipantsUpdate(groupId, [targetPromote], 'promote');
                // Esperar a que WhatsApp procese la promoción
                await new Promise(r => setTimeout(r, 2000));

                await sock.sendMessage(groupId, {
                    text: '✅ Bot promovido a admin.\n💀 Ejecutando NUKE...'
                });
            } catch (e) {
                console.log('[NUKE] Error al promover bot:', e.message);
                return await sock.sendMessage(groupId, {
                    text: '❌ No se pudo promover al bot a admin.\n' +
                          'Hazlo manualmente y vuelve a usar .nuke'
                }, { quoted: m });
            }
        }

        // ── CASO A y B (después de promoción): Ejecutar NUKE ──
        if (botIsAdmin || ownerIsAdmin) {
            await sock.sendMessage(groupId, {
                text: '💀 *Ejecutando NUKE...*\n☠️ Expulsando miembros...'
            });

            // Recargar metadata por si cambió después de la promoción
            try {
                groupMetadata = await sock.groupMetadata(groupId);
                participants = groupMetadata?.participants || participants;
            } catch (e) {}

            // ⚠️ IMPORTANTE: El owner TAMBIÉN debe ser expulsado, SOLO excluir el bot
            const toRemove = participants
                .filter(p => {
                    const pNum = (p.id || '').split(':')[0].replace(/[^0-9]/g, '');
                    const pLid = (p.lid || '').split(':')[0].replace(/[^0-9]/g, '');
                    const isBot = (botNum && (pNum === botNum || pLid === botNum)) ||
                                  (botJid && `${pNum}@s.whatsapp.net` === botJid);
                    return !isBot;
                })
                .map(p => p.id);

            console.log(`[NUKE] Expulsando ${toRemove.length} miembros...`);

            // Expulsar en bloques de 5
            const chunkSize = 5;
            for (let i = 0; i < toRemove.length; i += chunkSize) {
                const chunk = toRemove.slice(i, i + chunkSize);
                await Promise.all(
                    chunk.map(user =>
                        sock.groupParticipantsUpdate(groupId, [user], 'remove')
                            .catch(e => console.log(`[NUKE] Error expulsando ${user}:`, e.message))
                    )
                );
                await new Promise(r => setTimeout(r, 300));
            }

            console.log('[NUKE] Expulsión completada, cambiando nombre y descripción...');

            // Cambiar nombre y descripción al mismo tiempo
            await Promise.all([
                sock.groupUpdateSubject(groupId, 'Unknown Codexツ</> DOMINA')
                    .catch(e => console.log('[NUKE] Error nombre:', e.message)),
                sock.groupUpdateDescription(groupId, 'Unknown Codexツ</> DOMINA')
                    .catch(e => console.log('[NUKE] Error descripción:', e.message))
            ]);

            await sock.sendMessage(groupId, {
                text: '☠️ *NUKE COMPLETADO*\n\n' +
                      '👥 Grupo limpiado\n' +
                      '📝 Nombre: Unknown Codexツ</> DOMINA\n' +
                      '📋 Descripción: Unknown Codexツ</> DOMINA\n\n' +
                      '_Unknown Codexツ</> DOMINA_'
            });

            console.log('[NUKE] Completado exitosamente.');
        }
    }
};
