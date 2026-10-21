'use strict';

const recentMessagesManager = require('../../lib/recentMessages');
const logger = require('../../lib/logger');

module.exports = {
    name: 'clearchat',
    alias: ['limpiarchat', 'clear', 'vaciar'],
    category: 'sistema',
    desc: 'Limpia o vacía el historial de mensajes del chat actual (solo owner)',
    usage: '.clearchat',
    ownerOnly: true,

    execute: async ({ sock, m, isOwner }) => {
        if (!isOwner) return;

        const jid = m.chat || m.key.remoteJid;
        const isGroup = Boolean(jid?.endsWith('@g.us'));
        const botNum = (sock.user?.id || '').split(':')[0].split('@')[0];
        const botLid = (sock.user?.lid || '').split(':')[0].split('@')[0];

        // Verificar si el bot es admin en caso de grupo
        let isBotAdmin = false;
        if (isGroup) {
            try {
                const groupMeta = await sock.groupMetadata(jid);
                const botParticipant = groupMeta?.participants?.find(p => p.id && p.id.includes(botNum));
                isBotAdmin = Boolean(botParticipant?.admin);
            } catch (_) {}
        }

        const recent = recentMessagesManager.getRecent(jid, 100, m.key?.id);
        let revocados = 0;
        const idsABorrar = [];

        if (recent && recent.length > 0) {
            for (const msg of recent) {
                try {
                    const msgSender = (msg.participant || '').split(':')[0].split('@')[0];
                    const isMsgFromMe = Boolean(
                        msg.fromMe ||
                        (botNum && msgSender && msgSender === botNum) ||
                        (botLid && msgSender && msgSender === botLid)
                    );

                    // Si no es mensaje del bot y estamos en grupo pero el bot NO es admin, no puede borrarlo
                    if (!isMsgFromMe && isGroup && !isBotAdmin) {
                        continue;
                    }

                    // En chat privado (DM), solo se pueden borrar los mensajes propios del bot
                    if (!isMsgFromMe && !isGroup) {
                        continue;
                    }

                    const deleteKey = {
                        remoteJid: jid,
                        fromMe: isMsgFromMe,
                        id: msg.id
                    };

                    if (!isMsgFromMe && isGroup) {
                        deleteKey.participant = msg.participant;
                    }

                    await sock.sendMessage(jid, { delete: deleteKey });
                    revocados++;
                    idsABorrar.push(msg.id);
                    await new Promise((r) => setTimeout(r, 120));
                } catch (err) {
                    logger.warn('[CLEARCHAT] Error revocando mensaje:', err.message);
                }
            }
            recentMessagesManager.remove(jid, idsABorrar);
        }

        // Vaciar la conversación local de la sesión si WhatsApp AppState está disponible
        const hasAppStateKey = Boolean(sock?.authState?.creds?.myAppStateKeyId);
        if (hasAppStateKey) {
            try {
                await sock.chatModify({ delete: true, lastMessages: [] }, jid);
            } catch (_) {}
        }

        // Borrar el propio comando .clearchat si es posible
        try {
            await sock.sendMessage(jid, { delete: m.key });
        } catch (_) {}

        // Confirmación
        let confirmText = `🧹 *Chat limpiado exitosamente.*\n_Se eliminaron ${revocados} mensajes recientes vigentes._\n\n_Unknown Codexツ</>_`;
        if (isGroup && !isBotAdmin) {
            confirmText = `🧹 *Limpieza parcial completada.*\n_Se eliminaron ${revocados} mensajes propios del bot. Para eliminar los mensajes de otros miembros, el bot debe ser administrador del grupo._\n\n_Unknown Codexツ</>_`;
        }

        await sock.sendMessage(jid, { text: confirmText });
    }
};
