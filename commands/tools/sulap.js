'use strict';

const logger = require('../../lib/logger');
const database = require('../../lib/database');
const userNames = require('../../lib/userNames');

function cleanPhone(jid) {
    if (!jid) return '';
    return String(jid).replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '');
}

module.exports = {
    name: 'sulap',
    alias: ['magia', 'trucodemagia', 'desaparecer', 'magic'],
    category: 'diversión',
    desc: 'Truco de magia en el grupo: expulsa dramáticamente al usuario mencionado y lo reaparece (re-añade) en segundos',
    usage: '.sulap @usuario',
    groupOnly: true,

    execute: async ({ sock, m, args, isAdmin, isOwner, isBotAdmin, groupMetadata, participants, groupAdmins }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        // 1. Obtener objetivo mencionado, citado o indicado por número
        let targetJid = (m.mentionedJid && m.mentionedJid[0]) ||
                        m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
                        m.quoted?.sender ||
                        m.message?.extendedTextMessage?.contextInfo?.participant;

        if (!targetJid && args && args[0]) {
            const rawNumber = args[0].replace(/[^0-9]/g, '');
            if (rawNumber.length >= 7) {
                targetJid = `${rawNumber}@s.whatsapp.net`;
            }
        }

        // Si no se proporcionó objetivo, mostrar el menú explicativo y de uso
        if (!targetJid) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🎩 EL GRAN TRUCO DE MAGIA 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* `.sulap @usuario`',
                    '┃├◆ 📌 *Ejemplo:* `.sulap @1849xxxxxxx` (o citando su mensaje)',
                    '┃',
                    '┃├◆ 🪄 El bot hará desaparecer al usuario del grupo',
                    '┃  y lo hará reaparecer mágicamente segundos después.',
                    '┃',
                    '┃├◆ ⚠️ *Requisito:* Quien ejecuta el comando y el bot',
                    '┃  deben ser Administradores del grupo.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // Obtener o refrescar metadatos del grupo
        let currentMetadata = groupMetadata;
        if (!currentMetadata || !Array.isArray(currentMetadata.participants) || currentMetadata.participants.length === 0) {
            try {
                currentMetadata = await sock.groupMetadata(jid);
            } catch (_) {}
        }
        const allParticipants = currentMetadata?.participants || participants || [];

        // 2. Verificación infalible de permisos de Administrador o Owner
        const senderNum = cleanPhone(sender);
        const participantNum = cleanPhone(m.key?.participant);
        const senderMember = allParticipants.find(p => {
            const pId = cleanPhone(p.id);
            const pLid = cleanPhone(p.lid);
            return (pId && (pId === senderNum || pId === participantNum)) ||
                   (pLid && (pLid === senderNum || pLid === participantNum));
        });

        const isSenderAdmin = Boolean(
            isAdmin ||
            isOwner ||
            Boolean(m.fromMe) ||
            database.isOwner(sender, sock) ||
            database.isOwner(m.key?.participant, sock) ||
            (senderMember && (senderMember.admin === 'admin' || senderMember.admin === 'superadmin')) ||
            (senderMember && [senderMember.id, senderMember.lid, senderMember.jid, senderMember.phoneNumber].some(id => database.isOwner(id, sock)))
        );

        if (!isSenderAdmin) {
            return await sock.sendMessage(jid, {
                text: '❌ Este truco de magia solo puede ser ejecutado por un *Administrador* o por el *Owner* del bot.'
            }, { quoted: m });
        }

        const targetNum = cleanPhone(targetJid);
        const botNum = cleanPhone(sock.user?.id || sock.user?.jid);

        // 3. Prohibir hacer desaparecer al propio bot o al owner
        if (targetNum === botNum || targetJid === sock.user?.id || targetJid === sock.user?.jid) {
            return await sock.sendMessage(jid, { text: '🎩 El mago no puede desaparecerse a sí mismo.' }, { quoted: m });
        }
        if (database.isOwner(targetJid, sock) || database.isOwner(`${targetNum}@s.whatsapp.net`, sock)) {
            return await sock.sendMessage(jid, { text: '🛡️ El Creador del bot tiene un aura mágica impenetrable.' }, { quoted: m });
        }

        // 4. Prohibir desaparecer a otros administradores si WhatsApp lo restringe
        const targetMember = allParticipants.find(p => {
            const pId = cleanPhone(p.id);
            const pLid = cleanPhone(p.lid);
            return pId === targetNum || pLid === targetNum || p.id === targetJid || p.lid === targetJid;
        });

        if (targetMember && (targetMember.admin === 'admin' || targetMember.admin === 'superadmin')) {
            return await sock.sendMessage(jid, {
                text: '⚠️ No se puede realizar el truco con un Administrador del grupo (WhatsApp prohíbe que se expulse a un admin).'
            }, { quoted: m });
        }

        // Resolver el ID exacto que WhatsApp reconoce en este grupo
        const expelJid = targetMember?.id || targetJid;
        const targetTag = `@${targetNum || expelJid.split('@')[0]}`;

        await m.react?.('🎩');

        // Fase 1: Anuncio dramático
        await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 🎩 EL GRAN TRUCO DE MAGIA 》 ❐',
                '┃',
                '┃ 🎩✨ *Damas y caballeros, presten atención...*',
                `┃ 👁️ Para el truco de hoy, nuestro voluntario es: ${targetTag}`,
                '┃',
                '┃ 🪄 *¡Abra Cadabra, patas de cabra!* 🐇💨',
                '┃ *En 3... 2... 1...*',
                '┃ 💥 *¡DESAPARECE!*',
                '┗❐'
            ].join('\n'),
            mentions: [expelJid, targetJid]
        }, { quoted: m });

        // Pausa breve para suspenso (1.5 segundos)
        await new Promise(r => setTimeout(r, 1500));

        // Fase 2: Expulsar temporalmente
        try {
            await sock.groupParticipantsUpdate(jid, [expelJid], 'remove');
        } catch (kickErr) {
            logger.warn(`[SULAP] Error al remover participante: ${kickErr.message}`);
            return await sock.sendMessage(jid, {
                text: '⚠️ El truco no se pudo completar: Asegúrate de que el bot tenga rango de *Administrador* en este grupo.'
            }, { quoted: m });
        }

        // Pausa de desaparición (2.5 segundos)
        await new Promise(r => setTimeout(r, 2500));

        // Fase 3: Reaparecer
        await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 ✨ ¡Y LA MAGIA SUCEDE! 》 ❐',
                '┃',
                '┃ 🪄 *¡Chasquido de dedos mágico!* ✨',
                `┃ 🎩 ¡Miren quién regresa del vacío cósmico!`,
                `┃ 👉 *¡Bienvenido de vuelta, ${targetTag}!* 👏🎉`,
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n'),
            mentions: [expelJid, targetJid]
        });

        // Re-añadir al participante
        try {
            const addRes = await sock.groupParticipantsUpdate(jid, [expelJid], 'add');
            const status = addRes && addRes[0] ? addRes[0].status : null;
            if (status === '403') {
                const code = await sock.groupInviteCode(jid).catch(() => null);
                if (code) {
                    await sock.sendMessage(expelJid, {
                        text: `🎩✨ ¡El truco de magia en el grupo te espera! Regresa tocando este enlace:\nhttps://chat.whatsapp.com/${code}`
                    }).catch(() => {});
                }
            }
        } catch (addErr) {
            logger.warn(`[SULAP] Error al re-añadir: ${addErr.message}`);
            const code = await sock.groupInviteCode(jid).catch(() => null);
            if (code) {
                await sock.sendMessage(jid, {
                    text: `🎩 El participante desapareció, pero debido a la privacidad de WhatsApp debe reingresar tocando este enlace:\nhttps://chat.whatsapp.com/${code}`
                }).catch(() => {});
            }
        }
    }
};
