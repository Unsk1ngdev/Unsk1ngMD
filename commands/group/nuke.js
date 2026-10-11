'use strict';

/**
 * Comando: .nuke
 * Cuando el owner use .nuke en un grupo:
 * 1. Verifica que quien ejecuta es el owner del bot. Si no es, ignora completamente.
 * 2. Verifica el estado de admin del bot Y del owner con detección ultra-robusta:
 *    - CASO A: Bot ES admin -> Ejecuta nuke directamente.
 *    - CASO B: Bot NO es admin PERO el owner SÍ es admin ->
 *              Promueve al bot a admin automáticamente, espera 2 segundos, y ejecuta nuke.
 *    - CASO C: Ni el bot ni el owner son admin ->
 *              Avisa con mensaje explicativo y no ejecuta nada.
 * 3. Expulsa a TODOS excepto al bot en bloques de 5 (el owner TAMBIÉN es expulsado).
 * 4. Cambia el nombre a: Unknown Codexツ</> DOMINA
 * 5. Cambia la descripción a: Unknown Codexツ</> DOMINA
 * 6. Envía confirmación final.
 */

// Helper para comparar números de forma flexible (ignora sufijos :X, prefijos de país y variantes)
const matchNum = (id1, id2) => {
    if (!id1 || !id2) return false;
    const n1 = id1.toString().replace(/[^0-9]/g, '');
    const n2 = id2.toString().replace(/[^0-9]/g, '');
    if (!n1 || !n2) return false;
    if (n1 === n2) return true;
    if (n1.length >= 8 && n2.length >= 8) {
        return n1.slice(-8) === n2.slice(-8);
    }
    return false;
};

module.exports = {
    name: 'nuke',
    alias: ['nukear', 'destruir'],
    category: 'grupo',
    desc: 'Expulsa a todos los miembros y domina el grupo (solo owner)',
    usage: '.nuke',
    groupOnly: true,
    adminOnly: false,
    ownerOnly: false, // Manejo manual para ignorar silenciosamente si no es owner

    execute: async ({ sock, m, isOwner, isBotAdmin, isAdmin }) => {
        // 1. Solo owner (ignorar completamente si no es el owner)
        if (!isOwner) return;

        const groupId = m.chat || m.key.remoteJid;

        // Obtener metadata fresca del grupo
        let groupMetadata;
        try {
            groupMetadata = await sock.groupMetadata(groupId);
        } catch (e) {
            return await sock.sendMessage(groupId, {
                text: '❌ No se pudo obtener información del grupo.'
            }, { quoted: m });
        }

        let participants = groupMetadata?.participants || [];

        // ── Limpiar JIDs del bot y del owner ──
        const rawBotId = sock.user?.id || sock.user?.jid || '';
        const botNum = rawBotId.split(':')[0].replace(/[^0-9]/g, '');
        const botJid = botNum ? `${botNum}@s.whatsapp.net` : '';
        const botLid = sock.user?.lid ? sock.user.lid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') : '';

        const rawOwnerId = m.sender || '';
        const ownerNum = rawOwnerId.split(':')[0].replace(/[^0-9]/g, '');
        const ownerJid = ownerNum ? `${ownerNum}@s.whatsapp.net` : '';

        // ── Buscar participante del bot con coincidencia profunda ──
        const botParticipant = participants.find(p => {
            const pId = p.id || '';
            const pLid = p.lid || '';
            return pId === botJid ||
                   (botLid && (pId.includes(botLid) || pLid.includes(botLid))) ||
                   matchNum(pId, botNum) ||
                   matchNum(pLid, botNum);
        });

        // ── Buscar participante del owner con coincidencia profunda ──
        const ownerParticipant = participants.find(p => {
            const pId = p.id || '';
            const pLid = p.lid || '';
            return pId === ownerJid ||
                   matchNum(pId, ownerNum) ||
                   matchNum(pLid, ownerNum);
        });

        // Detección inicial
        let botIsAdminDetected = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin' || isBotAdmin;
        let ownerIsAdminDetected = ownerParticipant?.admin === 'admin' || ownerParticipant?.admin === 'superadmin';

        // Si el owner es el ejecutor y hay algún admin en el grupo con el mismo número:
        if (!ownerIsAdminDetected) {
            const anyAdminIsOwner = participants.some(p =>
                (p.admin === 'admin' || p.admin === 'superadmin') && matchNum(p.id, ownerNum)
            );
            if (anyAdminIsOwner || isAdmin) {
                ownerIsAdminDetected = true;
            }
        }

        console.log(`[NUKE] Bot admin: ${botIsAdminDetected} | Owner admin: ${ownerIsAdminDetected}`);
        console.log(`[NUKE] Bot ID: ${rawBotId} | Owner ID: ${rawOwnerId}`);

        // ── CASO B: Owner es admin pero bot NO es admin (auto-promoción) ──
        if (!botIsAdminDetected && ownerIsAdminDetected) {
            await sock.sendMessage(groupId, {
                text: '⚠️ El bot no es admin.\n🔄 Promoviendo al bot automáticamente...'
            }, { quoted: m });

            try {
                const targetPromote = botParticipant?.id || botJid;
                await sock.groupParticipantsUpdate(groupId, [targetPromote], 'promote');
                await new Promise(r => setTimeout(r, 2000));

                await sock.sendMessage(groupId, {
                    text: '✅ Bot promovido a admin.\n💀 Ejecutando NUKE...'
                });
                botIsAdminDetected = true;
            } catch (e) {
                console.log('[NUKE] Error al promover bot:', e.message);
                // Si la promoción falló en la API, avisamos pero permitimos intentar la expulsión
                // en caso de que ya tuviera permisos a nivel de WhatsApp
            }
        }

        // ── Preparar lista de expulsión (TODOS excepto el bot, el owner TAMBIÉN es expulsado) ──
        // Recargar metadata fresca
        try {
            groupMetadata = await sock.groupMetadata(groupId);
            participants = groupMetadata?.participants || participants;
        } catch (_) {}

        const toRemove = participants
            .filter(p => {
                const pId = p.id || '';
                const pLid = p.lid || '';
                const isBot = pId === botJid ||
                              (botLid && (pId.includes(botLid) || pLid.includes(botLid))) ||
                              matchNum(pId, botNum) ||
                              matchNum(pLid, botNum);
                return !isBot; // Solo conservar el bot
            })
            .map(p => p.id);

        if (toRemove.length === 0) {
            return await sock.sendMessage(groupId, {
                text: '⚠️ No hay miembros que expulsar en este grupo.'
            }, { quoted: m });
        }

        // Anuncio de inicio
        await sock.sendMessage(groupId, {
            text: '💀 *Ejecutando NUKE...*\n☠️ Expulsando miembros...'
        });

        // ── Expulsión en bloques de 5 ──
        let expelled = 0;
        let notAuthorized = false;

        const chunkSize = 5;
        for (let i = 0; i < toRemove.length; i += chunkSize) {
            const chunk = toRemove.slice(i, i + chunkSize);
            const results = await Promise.allSettled(
                chunk.map(user => sock.groupParticipantsUpdate(groupId, [user], 'remove'))
            );

            for (const res of results) {
                if (res.status === 'fulfilled') {
                    expelled++;
                } else {
                    const errStr = (res.reason?.message || res.reason?.toString() || '').toLowerCase();
                    if (errStr.includes('403') || errStr.includes('not-authorized') || errStr.includes('forbidden')) {
                        notAuthorized = true;
                    }
                }
            }

            // ── CASO C: Si WhatsApp rechazó el primer bloque y no se expulsó a nadie ──
            if (notAuthorized && expelled === 0) {
                return await sock.sendMessage(groupId, {
                    text: '❌ *Ni tú ni el bot son administradores del grupo.*\n\n' +
                          '📌 Para usar .nuke necesitas:\n' +
                          '1. Ser admin del grupo\n' +
                          '2. Hacer al bot admin también'
                }, { quoted: m });
            }

            if (i + chunkSize < toRemove.length) {
                await new Promise(r => setTimeout(r, 300)); // Pausa anti-ban
            }
        }

        console.log(`[NUKE] Expulsión completada (${expelled} miembros expulsados).`);

        // ── Cambiar nombre y descripción al mismo tiempo ──
        await Promise.allSettled([
            sock.groupUpdateSubject(groupId, 'Unknown Codexツ</> DOMINA'),
            sock.groupUpdateDescription(groupId, 'Unknown Codexツ</> DOMINA')
        ]);

        // ── Confirmación final ──
        await sock.sendMessage(groupId, {
            text: '☠️ *NUKE COMPLETADO*\n\n' +
                  '👥 Grupo limpiado\n' +
                  '📝 Nombre: Unknown Codexツ</> DOMINA\n' +
                  '📋 Descripción: Unknown Codexツ</> DOMINA\n\n' +
                  '_Unknown Codexツ</> DOMINA_'
        });

        console.log('[NUKE] Completado exitosamente.');
    }
};
