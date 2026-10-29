/**
 * Helper de normalización y chequeo de administradores en grupos de WhatsApp
 * Robusto contra sufijos de dispositivo (:1, :2), identificadores @lid y @s.whatsapp.net
 */
'use strict';

/**
 * Normaliza cualquier JID o ID de WhatsApp a su versión limpia
 */
const cleanJid = (id) => {
    if (!id) return '';
    return id.toString().split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
};

/**
 * Extrae todos los identificadores posibles (JID completo, sin dispositivo, user, dígitos)
 */
function getEntityIdentifiers(id, sock = null) {
    if (!id) return [];
    const set = new Set();
    const str = id.toString().trim();
    if (!str) return [];

    set.add(str);

    // Sin sufijo de dispositivo (:1, :2, etc.)
    const noDevice = str.replace(/:\d+@/, '@');
    set.add(noDevice);

    // Parte de usuario antes del @ y sin :
    const userPart = str.split('@')[0].split(':')[0];
    if (userPart) set.add(userPart);

    // Dígitos puros
    const digits = userPart.replace(/[^0-9]/g, '');
    if (digits) set.add(digits);

    // Si está mapeado en userNames (LID <-> Phone)
    try {
        const userNames = require('./userNames');
        const phone = userNames.getPhoneFromLid(str) || userNames.getPhoneFromLid(noDevice);
        if (phone) {
            set.add(phone);
            const pDigits = phone.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
            if (pDigits) set.add(pDigits);
        }
        const lid = userNames.getLidFromPhone(str) || userNames.getLidFromPhone(noDevice);
        if (lid) {
            set.add(lid);
            const lDigits = lid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
            if (lDigits) set.add(lDigits);
        }
    } catch (_) {}

    return Array.from(set).filter(Boolean);
}

/**
 * Extrae todos los identificadores que pertenecen a un participante del array de participantes
 */
function getParticipantIdentifiers(p) {
    if (!p) return [];
    const set = new Set();
    const fields = [p.id, p.lid, p.jid, p.phoneNumber, p.phone_number];

    for (const f of fields) {
        if (!f) continue;
        const str = f.toString().trim();
        if (!str) continue;

        set.add(str);
        set.add(str.replace(/:\d+@/, '@'));
        const user = str.split('@')[0].split(':')[0];
        if (user) set.add(user);
        const digits = user.replace(/[^0-9]/g, '');
        if (digits) set.add(digits);
    }

    return Array.from(set).filter(Boolean);
}

/**
 * Busca un participante en la lista si coincide con cualquiera de los identificadores objetivo
 */
function findMember(participants, targetIds) {
    if (!Array.isArray(participants) || !targetIds || targetIds.length === 0) return null;
    return participants.find(p => {
        const pIds = getParticipantIdentifiers(p);
        return targetIds.some(t => pIds.includes(t));
    }) || null;
}

/**
 * Obtiene los identificadores de la instancia del bot
 */
function getBotIdentifiers(sock) {
    const list = [
        sock?.user?.id,
        sock?.user?.jid,
        sock?.user?.lid
    ].filter(Boolean);

    const set = new Set();
    for (const item of list) {
        for (const id of getEntityIdentifiers(item, sock)) {
            set.add(id);
        }
    }
    return Array.from(set);
}

/**
 * Obtiene los identificadores del remitente (senderJid, m.sender, m.key.participant)
 */
function getSenderIdentifiers(senderJid, m = null) {
    const list = [
        senderJid,
        m?.sender,
        m?.key?.participant
    ].filter(Boolean);

    const set = new Set();
    for (const item of list) {
        for (const id of getEntityIdentifiers(item)) {
            set.add(id);
        }
    }
    return Array.from(set);
}

/**
 * Consulta de forma segura los metadatos de un grupo con timeout estricto para evitar congelamientos
 */
async function fetchGroupMetadataSafe(sock, jid, timeoutMs = 3500) {
    if (!sock || typeof sock.groupMetadata !== 'function') return null;
    try {
        return await Promise.race([
            sock.groupMetadata(jid),
            new Promise((_, reject) => setTimeout(() => reject(new Error('groupMetadata timeout')), timeoutMs))
        ]);
    } catch (_) {
        return null;
    }
}

/**
 * Función definitiva para abrir o cerrar grupos delegando la validación del bot a los servidores de WhatsApp
 */
async function toggleGroup(sock, jid, m, senderJid, action) {
    const database = require('./database');
    let canExecute = database.isOwner(senderJid, sock) || 
                     database.isOwner(m?.key?.participant, sock) || 
                     Boolean(m?.fromMe);

    if (!canExecute) {
        try {
            const meta = await fetchGroupMetadataSafe(sock, jid);
            const senderIds = getSenderIdentifiers(senderJid, m);
            const user = findMember(meta?.participants || [], senderIds);

            if (user) {
                const candidates = [user.jid, user.phone_number, user.phoneNumber, user.id, user.lid].filter(Boolean);
                if (candidates.some(id => database.isOwner(id, sock))) {
                    canExecute = true;
                    if (user.lid) database.registerOwnerLid(user.lid);
                    if (senderJid && senderJid.endsWith('@lid')) database.registerOwnerLid(senderJid);
                } else {
                    canExecute = user?.admin === 'admin' || user?.admin === 'superadmin';
                }
            }
        } catch (_) {}
    }

    if (!canExecute) {
        return await sock.sendMessage(jid, { text: '❌ Este comando es exclusivo para administradores del grupo.' }, { quoted: m });
    }

    // Ejecutar la acción directo en WhatsApp
    try {
        const setting = action === 'cerrar' ? 'announcement' : 'not_announcement';
        await sock.groupSettingUpdate(jid, setting);
        await sock.sendMessage(jid, { 
            text: action === 'cerrar' 
                ? '🔒 *Grupo cerrado.* Solo administradores pueden enviar mensajes.' 
                : '🔓 *Grupo abierto.* Todos los participantes pueden enviar mensajes.' 
        }, { quoted: m });
    } catch (err) {
        await sock.sendMessage(jid, { 
            text: '❌ WhatsApp rechazó la acción. Asegúrate de que el número del bot tenga otorgado el rango de Administrador en el grupo.' 
        }, { quoted: m });
    }
}

/**
 * Verifica permisos del bot y del remitente en el grupo con alta tolerancia a LIDs, sufijos y refresco de caché
 */
async function checkGroupPermissions(sock, jid, senderJid, existingMetadata = null, m = null) {
    let groupMetadata = existingMetadata;
    if (!groupMetadata || !groupMetadata.participants || groupMetadata.participants.length === 0) {
        groupMetadata = await fetchGroupMetadataSafe(sock, jid);
    }

    let participants = groupMetadata?.participants || [];
    const botIds = getBotIdentifiers(sock);
    const senderIds = getSenderIdentifiers(senderJid, m);

    let botMember = findMember(participants, botIds);
    let senderMember = findMember(participants, senderIds);

    let isBotAdmin = botMember?.admin === 'admin' || botMember?.admin === 'superadmin';
    let isSenderAdmin = senderMember?.admin === 'admin' || senderMember?.admin === 'superadmin';

    // Si vino de un caché previo y marcó que no es admin, consultar DIRECTO a WhatsApp
    // para evitar falsos negativos por caché temporal desactualizado
    if ((!isBotAdmin || !isSenderAdmin) && existingMetadata && sock?.groupMetadata) {
        try {
            const freshMeta = await fetchGroupMetadataSafe(sock, jid);
            if (freshMeta?.participants && Array.isArray(freshMeta.participants)) {
                groupMetadata = freshMeta;
                participants = freshMeta.participants;
                botMember = findMember(participants, botIds);
                senderMember = findMember(participants, senderIds);
                isBotAdmin = botMember?.admin === 'admin' || botMember?.admin === 'superadmin';
                isSenderAdmin = senderMember?.admin === 'admin' || senderMember?.admin === 'superadmin';
            }
        } catch (_) {}
    }

    const groupAdmins = participants
        .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
        .map(p => p.id);

    return {
        isBotAdmin: !!isBotAdmin,
        isSenderAdmin: !!isSenderAdmin,
        groupMetadata,
        participants,
        groupAdmins,
        botMember,
        senderMember
    };
}

module.exports = {
    cleanJid,
    getEntityIdentifiers,
    getParticipantIdentifiers,
    findMember,
    toggleGroup,
    checkGroupPermissions
};
