/**
 * Helper de normalización y chequeo de administradores en grupos de WhatsApp
 * Robusto contra sufijos de dispositivo (:1, :2), identificadores @lid y @s.whatsapp.net
 */
const cleanJid = (id) => (id ? id.replace(/:.*@/, '@').split('@')[0] : '');

/**
 * Función definitiva para abrir o cerrar grupos delegando la validación del bot a los servidores de WhatsApp
 */
async function toggleGroup(sock, jid, m, senderJid, action) {
    const owners = ['584160666286@s.whatsapp.net', '18494509905@s.whatsapp.net'];
    const cleanSender = senderJid ? senderJid.replace(/:.*@/, '@') : '';

    // 1. Si el que ejecuta es el Owner, bypass total
    let canExecute = owners.includes(cleanSender) || owners.some(o => o.split('@')[0] === cleanSender.split('@')[0]);

    if (!canExecute) {
        try {
            const meta = await sock.groupMetadata(jid);
            const user = meta.participants.find(p => p.id.replace(/:.*@/, '@') === cleanSender);
            canExecute = user?.admin === 'admin' || user?.admin === 'superadmin';
        } catch (_) {}
    }

    if (!canExecute) {
        return await sock.sendMessage(jid, { text: '❌ Este comando es exclusivo para administradores del grupo.' }, { quoted: m });
    }

    // 2. Ejecutar la acción directo en WhatsApp
    try {
        const setting = action === 'cerrar' ? 'announcement' : 'not_announcement';
        await sock.groupSettingUpdate(jid, setting);
        await sock.sendMessage(jid, { 
            text: action === 'cerrar' 
                ? '🔒 *Grupo cerrado.* Solo administradores pueden enviar mensajes.' 
                : '🔓 *Grupo abierto.* Todos los participantes pueden enviar mensajes.' 
        }, { quoted: m });
    } catch (err) {
        // Si WhatsApp rechaza con 403 o similar, es porque el bot realmente no tiene la insignia de admin
        await sock.sendMessage(jid, { 
            text: '❌ WhatsApp rechazó la acción. Asegúrate de que el número del bot tenga otorgado el rango de Administrador en el grupo.' 
        }, { quoted: m });
    }
}

async function checkGroupPermissions(sock, jid, senderJid, existingMetadata = null) {
    let groupMetadata = existingMetadata;
    if (!groupMetadata || !groupMetadata.participants || groupMetadata.participants.length === 0) {
        try {
            groupMetadata = await sock.groupMetadata(jid);
        } catch (e) {
            groupMetadata = null;
        }
    }

    const participants = groupMetadata?.participants || [];

    // Limpiar JID de remitente y de la instancia del bot (remover sufijos :1, etc.)
    const botNumber = cleanJid(sock.user?.id || sock.user?.jid);
    const botLid = cleanJid(sock.user?.lid);
    const senderNumber = cleanJid(senderJid);

    // Buscar participante sin importar si viene como @s.whatsapp.net o @lid
    const botMember = participants.find(p => {
        const pNumber = cleanJid(p.id);
        const pLid = cleanJid(p.lid);
        return (
            (botNumber && (pNumber === botNumber || pLid === botNumber)) ||
            (botLid && (pNumber === botLid || pLid === botLid))
        );
    });

    const senderMember = participants.find(p => {
        const pNumber = cleanJid(p.id);
        const pLid = cleanJid(p.lid);
        return (
            (senderNumber && (pNumber === senderNumber || pLid === senderNumber))
        );
    });

    const isBotAdmin = botMember?.admin === 'admin' || botMember?.admin === 'superadmin';
    const isSenderAdmin = senderMember?.admin === 'admin' || senderMember?.admin === 'superadmin';

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
    toggleGroup,
    checkGroupPermissions
};
