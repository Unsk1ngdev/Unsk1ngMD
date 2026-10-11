'use strict';

const crypto = require('crypto');

/**
 * Comando: .nuke
 * Cuando el owner use .nuke en un grupo:
 * 1. Verifica que quien ejecuta es el owner del bot. Si no es, ignora completamente.
 * 2. Si el bot necesita ser promovido, lo hace en SILENCIO (sin enviar mensajes).
 * 3. Actualiza el NOMBRE y DESCRIPCIÓN a: Unknown Codexツ</> DOMINA (con fallbacks garantizados).
 * 4. Expulsa a TODOS los miembros del grupo PRIMERO (en bloques de 5 a máxima velocidad).
 * 5. Re-asegura el NOMBRE y DESCRIPCIÓN.
 * 6. Envía el mensaje de confirmación final en el grupo.
 * 7. Expulsa al OWNER del grupo.
 * 8. El BOT se auto-expulsa / sale del grupo.
 */

const sleep = ms => new Promise(r => setTimeout(r, ms));

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

/**
 * Actualiza el nombre del grupo probando con múltiples variantes y métodos
 * para evitar bloqueos por caracteres reservados en WhatsApp (<, >) o timeouts
 */
const updateGroupSubject = async (sock, groupId) => {
    const candidates = [
        'Unknown Codexツ</> DOMINA',
        'Unknown Codexツ＜/＞ DOMINA',
        'Unknown Codexツ DOMINA',
        'Unknown Codex DOMINA'
    ];

    for (const title of candidates) {
        // Intento 1: API estándar Baileys
        try {
            await sock.groupUpdateSubject(groupId, title);
            console.log(`[NUKE] Nombre cambiado con éxito a: "${title}" (vía groupUpdateSubject)`);
            return true;
        } catch (e1) {
            console.warn(`[NUKE] groupUpdateSubject falló con "${title}":`, e1.message);
        }

        await sleep(250);

        // Intento 2: Consulta IQ directa al protocolo w:g2
        try {
            await sock.query({
                tag: 'iq',
                attrs: {
                    type: 'set',
                    xmlns: 'w:g2',
                    to: groupId
                },
                content: [
                    {
                        tag: 'subject',
                        attrs: {},
                        content: Buffer.from(title, 'utf-8')
                    }
                ]
            });
            console.log(`[NUKE] Nombre cambiado con éxito a: "${title}" (vía IQ directo)`);
            return true;
        } catch (e2) {
            console.warn(`[NUKE] IQ directo subject falló con "${title}":`, e2.message);
        }

        await sleep(250);
    }
    return false;
};

/**
 * Actualiza la descripción del grupo probando con múltiples variantes y métodos
 */
const updateGroupDescription = async (sock, groupId) => {
    const candidates = [
        'Unknown Codexツ</> DOMINA',
        'Unknown Codexツ＜/＞ DOMINA',
        'Unknown Codexツ DOMINA',
        'Unknown Codex DOMINA'
    ];

    // Intentar obtener descId anterior si existe
    let prevDescId = null;
    try {
        const meta = await sock.groupMetadata(groupId);
        prevDescId = meta?.descId || null;
    } catch (_) {}

    for (const desc of candidates) {
        // Intento 1: API estándar Baileys
        try {
            await sock.groupUpdateDescription(groupId, desc);
            console.log(`[NUKE] Descripción cambiada con éxito a: "${desc}" (vía groupUpdateDescription)`);
            return true;
        } catch (e1) {
            console.warn(`[NUKE] groupUpdateDescription falló con "${desc}":`, e1.message);
        }

        await sleep(250);

        // Intento 2: IQ directo con prevDescId si existe
        const descId = '3EB0' + crypto.randomBytes(12).toString('hex').toUpperCase();
        try {
            const attrs = { id: descId };
            if (prevDescId) attrs.prev = prevDescId;

            await sock.query({
                tag: 'iq',
                attrs: {
                    type: 'set',
                    xmlns: 'w:g2',
                    to: groupId
                },
                content: [
                    {
                        tag: 'description',
                        attrs,
                        content: [{ tag: 'body', attrs: {}, content: Buffer.from(desc, 'utf-8') }]
                    }
                ]
            });
            console.log(`[NUKE] Descripción cambiada con éxito a: "${desc}" (vía IQ con prev)`);
            return true;
        } catch (e2) {
            console.warn(`[NUKE] IQ description con prev falló con "${desc}":`, e2.message);
        }

        await sleep(250);

        // Intento 3: IQ directo sin prevDescId
        try {
            await sock.query({
                tag: 'iq',
                attrs: {
                    type: 'set',
                    xmlns: 'w:g2',
                    to: groupId
                },
                content: [
                    {
                        tag: 'description',
                        attrs: { id: descId },
                        content: [{ tag: 'body', attrs: {}, content: Buffer.from(desc, 'utf-8') }]
                    }
                ]
            });
            console.log(`[NUKE] Descripción cambiada con éxito a: "${desc}" (vía IQ sin prev)`);
            return true;
        } catch (e3) {
            console.warn(`[NUKE] IQ description sin prev falló con "${desc}":`, e3.message);
        }

        await sleep(250);
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
            await sleep(1000);
            try {
                groupMetadata = await sock.groupMetadata(groupId);
                participants = groupMetadata?.participants || participants;
            } catch (_) {}
        }

        // ── Desbloquear ajustes de edición de info de grupo ──
        await sock.groupSettingUpdate(groupId, 'unlocked').catch(() => {});
        await sleep(300);

        // ── ACTUALIZACIÓN TEMPRANA: Cambiar nombre y descripción de inmediato ──
        console.log('[NUKE] Aplicando nombre y descripción preventivos antes de expulsar...');
        await updateGroupSubject(sock, groupId);
        await sleep(400);
        await updateGroupDescription(sock, groupId);
        await sleep(400);

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
            await sleep(250); // Pausa mínima anti-ban
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

        // Pausa breve tras las expulsiones
        await sleep(1000);

        // ── PASO 2 y 3: Re-asegurar nombre y descripción tras las expulsiones ──
        console.log('[NUKE] Re-confirmando nombre y descripción tras expulsiones...');
        await updateGroupSubject(sock, groupId);
        await sleep(500);
        await updateGroupDescription(sock, groupId);
        await sleep(800);

        // ── PASO 4: Enviar mensaje de confirmación final en el grupo ──
        await sock.sendMessage(groupId, {
            text: '☠️ *NUKE COMPLETADO*\n\n' +
                  '👥 Grupo limpiado\n' +
                  '📝 Nombre: Unknown Codexツ</> DOMINA\n' +
                  '📋 Descripción: Unknown Codexツ</> DOMINA\n\n' +
                  '_Unknown Codexツ</> DOMINA_'
        }).catch(() => {});

        await sleep(1500);

        // ── PASO 5: Expulsar al owner ahora que todos los demás ya salieron ──
        console.log('[NUKE] Expulsando al owner...');
        const ownerToRemove = ownerParticipant?.id || m.sender;
        await sock.groupParticipantsUpdate(groupId, [ownerToRemove], 'remove').catch(() => {});

        // ── PASO 6: El bot se auto-expulsa / sale del grupo después de confirmar ──
        console.log('[NUKE] Bot saliendo del grupo...');
        await sleep(3000);
        await sock.groupLeave(groupId).catch(() => {});

        console.log('[NUKE] Operación finalizada exitosamente.');
    }
};
