'use strict';

/**
 * Comando: .nuke
 * Cuando el owner use .nuke en un grupo:
 * 1. Verifica que quien ejecuta es el owner del bot. Si no es, ignora completamente.
 * 2. Si el bot necesita ser promovido, lo hace en SILENCIO (sin enviar mensajes).
 * 3. Expulsa a TODOS los miembros del grupo PRIMERO (en bloques de 5 a máxima velocidad).
 * 4. Desbloquea ajustes y cambia el NOMBRE a: Unknown Codexツ</> DOMINA
 * 5. Cambia la DESCRIPCIÓN a: Unknown Codexツ</> DOMINA
 * 6. Envía el mensaje de confirmación final en el grupo.
 * 7. Expulsa al OWNER del grupo.
 * 8. El BOT se auto-expulsa / sale del grupo.
 */

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
    desc: 'Expulsa a todos los miembros, renombra, expulsa al owner y el bot sale del grupo',
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
        } catch (e) {
            return await sock.sendMessage(groupId, {
                text: '❌ No se pudo obtener información del grupo.'
            }, { quoted: m });
        }

        let participants = groupMetadata?.participants || [];

        // ── Identificadores del bot y del owner ──
        const rawBotId = sock.user?.id || sock.user?.jid || '';
        const botNum = rawBotId.split(':')[0].replace(/[^0-9]/g, '');
        const botJid = botNum ? `${botNum}@s.whatsapp.net` : '';
        const botLid = sock.user?.lid ? sock.user.lid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') : '';

        const rawOwnerId = m.sender || '';
        const ownerNum = rawOwnerId.split(':')[0].replace(/[^0-9]/g, '');
        const ownerJid = ownerNum ? `${ownerNum}@s.whatsapp.net` : '';

        // Buscar participante del bot
        const botParticipant = participants.find(p => {
            const pId = p.id || '';
            const pLid = p.lid || '';
            return pId === botJid ||
                   (botLid && (pId.includes(botLid) || pLid.includes(botLid))) ||
                   matchNum(pId, botNum) ||
                   matchNum(pLid, botNum);
        });

        // Buscar participante del owner
        const ownerParticipant = participants.find(p => {
            const pId = p.id || '';
            const pLid = p.lid || '';
            return pId === ownerJid ||
                   matchNum(pId, ownerNum) ||
                   matchNum(pLid, ownerNum);
        });

        // ── Auto-promoción silenciosa (si el bot no es admin pero puede promoverse) ──
        const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
        if (!isBotAdmin) {
            const targetPromote = botParticipant?.id || botJid;
            await sock.groupParticipantsUpdate(groupId, [targetPromote], 'promote').catch(() => {});
            await new Promise(r => setTimeout(r, 1000));
            try {
                groupMetadata = await sock.groupMetadata(groupId);
                participants = groupMetadata?.participants || participants;
            } catch (_) {}
        }

        // ── PASO 1: Separar miembros (TODOS los demás miembros PRIMERO) ──
        // El bot y el owner NO se expulsan en este primer paso
        const othersToRemove = participants
            .filter(p => {
                const pId = p.id || '';
                const pLid = p.lid || '';

                const isBot = pId === botJid ||
                              (botLid && (pId.includes(botLid) || pLid.includes(botLid))) ||
                              matchNum(pId, botNum) ||
                              matchNum(pLid, botNum);

                const isOwnerUser = pId === ownerJid ||
                                   (ownerParticipant && pId === ownerParticipant.id) ||
                                   matchNum(pId, ownerNum) ||
                                   matchNum(pLid, ownerNum);

                return !isBot && !isOwnerUser;
            })
            .map(p => p.id);

        console.log(`[NUKE] Expulsando ${othersToRemove.length} miembros regulares primero...`);

        // Aviso de inicio
        await sock.sendMessage(groupId, {
            text: '💀 *Ejecutando NUKE...*\n☠️ Destruyendo grupo a máxima velocidad...'
        });

        // Expulsar a todos los miembros regulares en bloques de 5 (atómico)
        const chunkSize = 5;
        let notAuthorized = false;
        let expelledCount = 0;

        for (let i = 0; i < othersToRemove.length; i += chunkSize) {
            const chunk = othersToRemove.slice(i, i + chunkSize);
            try {
                // Envío en bloque como array para máxima velocidad y evitar saturar el socket
                await sock.groupParticipantsUpdate(groupId, chunk, 'remove');
                expelledCount += chunk.length;
            } catch (err) {
                const errStr = (err?.message || err?.toString() || '').toLowerCase();
                if (errStr.includes('403') || errStr.includes('not-authorized') || errStr.includes('forbidden')) {
                    notAuthorized = true;
                    break;
                }
                // Fallback uno a uno si algún miembro específico es admin o falla
                for (const user of chunk) {
                    await sock.groupParticipantsUpdate(groupId, [user], 'remove')
                        .then(() => expelledCount++)
                        .catch(() => {});
                }
            }
            await new Promise(r => setTimeout(r, 250)); // Pausa mínima anti-ban
        }

        // Si WhatsApp rechazó totalmente porque el bot no tiene permisos
        if (notAuthorized && expelledCount === 0 && othersToRemove.length > 0) {
            return await sock.sendMessage(groupId, {
                text: '❌ *Ni tú ni el bot son administradores del grupo.*\n\n' +
                      '📌 Para usar .nuke necesitas:\n' +
                      '1. Ser admin del grupo\n' +
                      '2. Hacer al bot admin también'
            }, { quoted: m });
        }

        // Pausa breve para liberar el socket antes de modificar metadatos
        await new Promise(r => setTimeout(r, 1000));

        // ── Desbloquear ajustes de edición de info de grupo ──
        await sock.groupSettingUpdate(groupId, 'unlocked').catch(() => {});
        await new Promise(r => setTimeout(r, 500));

        // ── PASO 2: Cambiar nombre del grupo de forma secuencial y garantizada ──
        const targetTitle = 'Unknown Codexツ</> DOMINA';
        console.log(`[NUKE] Actualizando nombre del grupo a: ${targetTitle}...`);
        try {
            await sock.groupUpdateSubject(groupId, targetTitle);
            console.log('[NUKE] Nombre actualizado con éxito.');
        } catch (err) {
            console.warn('[NUKE] Reintentando cambio de nombre:', err.message);
            await new Promise(r => setTimeout(r, 800));
            await sock.groupUpdateSubject(groupId, targetTitle).catch(e => console.error('[NUKE] Error final nombre:', e.message));
        }

        await new Promise(r => setTimeout(r, 1000));

        // ── PASO 3: Cambiar descripción del grupo de forma secuencial y garantizada ──
        const targetDesc = 'Unknown Codexツ</> DOMINA';
        console.log(`[NUKE] Actualizando descripción del grupo a: ${targetDesc}...`);
        try {
            await sock.groupUpdateDescription(groupId, targetDesc);
            console.log('[NUKE] Descripción actualizada con éxito.');
        } catch (err) {
            console.warn('[NUKE] Reintentando cambio de descripción:', err.message);
            await new Promise(r => setTimeout(r, 800));
            await sock.groupUpdateDescription(groupId, targetDesc).catch(e => console.error('[NUKE] Error final descripción:', e.message));
        }

        await new Promise(r => setTimeout(r, 1000));

        // ── PASO 4: Enviar mensaje de confirmación final en el grupo ──
        await sock.sendMessage(groupId, {
            text: '☠️ *NUKE COMPLETADO*\n\n' +
                  '👥 Grupo limpiado\n' +
                  '📝 Nombre: Unknown Codexツ</> DOMINA\n' +
                  '📋 Descripción: Unknown Codexツ</> DOMINA\n\n' +
                  '_Unknown Codexツ</> DOMINA_'
        }).catch(() => {});

        await new Promise(r => setTimeout(r, 1500));

        // ── PASO 5: Expulsar al owner ahora que todos los demás ya salieron ──
        console.log('[NUKE] Expulsando al owner...');
        const ownerToRemove = ownerParticipant?.id || m.sender;
        await sock.groupParticipantsUpdate(groupId, [ownerToRemove], 'remove').catch(() => {});

        // ── PASO 6: El bot se auto-expulsa / sale del grupo después de confirmar ──
        console.log('[NUKE] Bot saliendo del grupo...');
        await new Promise(r => setTimeout(r, 2000));
        await sock.groupLeave(groupId).catch(() => {});

        console.log('[NUKE] Operación finalizada exitosamente.');
    }
};
