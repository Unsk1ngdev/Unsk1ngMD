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
        let clearedViaSync = false;

        // 1. Intentar con chatModify solo si la sesión posee las claves de App State de WhatsApp
        const hasAppStateKey = Boolean(sock?.authState?.creds?.myAppStateKeyId);
        if (hasAppStateKey) {
            try {
                await sock.chatModify(
                    { delete: true, lastMessages: [] },
                    jid
                );
                clearedViaSync = true;
            } catch (errSync) {
                logger.warn('[CLEARCHAT] chatModify no disponible o falló:', errSync.message);
            }
        }

        // 2. Si no hay App State Key o chatModify falló, vaciar mediante revocación directa de mensajes
        const recent = recentMessagesManager.getRecent(jid, 100);
        let revocados = 0;

        if (recent && recent.length > 0) {
            const idsABorrar = [];
            for (const msg of recent) {
                try {
                    const deleteKey = {
                        remoteJid: jid,
                        fromMe: Boolean(msg.fromMe),
                        id: msg.id
                    };
                    if (!msg.fromMe && msg.participant) {
                        deleteKey.participant = msg.participant;
                    }
                    await sock.sendMessage(jid, { delete: deleteKey });
                    revocados++;
                    idsABorrar.push(msg.id);
                    await new Promise((r) => setTimeout(r, 80));
                } catch (_) {}
            }
            recentMessagesManager.remove(jid, idsABorrar);
        }

        // 3. Borrar el propio comando .clearchat si es posible
        try {
            await sock.sendMessage(jid, { delete: m.key });
        } catch (_) {}

        // 4. Confirmación limpia sin errores técnicos
        await sock.sendMessage(jid, {
            text: '🧹 *Chat limpiado exitosamente.*\n\n_Unknown Codexツ</>_'
        });
    }
};
