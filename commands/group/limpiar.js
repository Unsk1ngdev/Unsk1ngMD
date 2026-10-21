'use strict';

const recentMessagesManager = require('../../lib/recentMessages');
const logger = require('../../lib/logger');

module.exports = {
    name: 'limpiar',
    alias: ['clean', 'purge', 'borrarmensajes', 'delete', 'del'],
    category: 'grupo',
    desc: 'Elimina mensajes recientes del grupo o el mensaje citado (solo admins y owner)',
    usage: '.limpiar [cantidad (1 a 100)] | respondiendo a un mensaje',
    groupOnly: true,
    adminOnly: true,

    execute: async ({ sock, m, args, isBotAdmin, isAdmin, isOwner }) => {
        if (!m.isGroup) {
            return await sock.sendMessage(m.chat, {
                text: '❌ Solo funciona en grupos.\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        if (!isAdmin && !isOwner) {
            return await sock.sendMessage(m.chat, {
                text: '❌ Solo admins del grupo o el owner pueden usar este comando.\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        if (!isBotAdmin) {
            return await sock.sendMessage(m.chat, {
                text: '❌ Necesito ser administrador del grupo para poder eliminar mensajes.\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const botNum = (sock.user?.id || '').split(':')[0].split('@')[0];
        const botLid = (sock.user?.lid || '').split(':')[0].split('@')[0];
        const currentMsgId = m.key?.id;

        // Caso 1: Se respondió a un mensaje específico sin pasar cantidad -> Borrar SOLO ese mensaje
        if (m.quoted && m.quoted.id && !args[0]) {
            const isBotMsg = Boolean(
                m.quoted.fromMe ||
                (botNum && m.quoted.sender && m.quoted.sender.includes(botNum)) ||
                (botLid && m.quoted.sender && m.quoted.sender.includes(botLid))
            );

            const deleteKey = {
                remoteJid: m.chat,
                fromMe: isBotMsg,
                id: m.quoted.id
            };

            if (!isBotMsg) {
                deleteKey.participant = m.quoted.participant || m.quoted.sender || undefined;
            }

            try {
                await sock.sendMessage(m.chat, { delete: deleteKey });
                recentMessagesManager.remove(m.chat, [m.quoted.id]);
            } catch (err) {
                logger.warn('[LIMPIAR] Error eliminando mensaje citado:', err.message);
                return await sock.sendMessage(m.chat, {
                    text: '⚠️ No se pudo eliminar el mensaje citado. Puede ser demasiado antiguo (máx 48 horas en WhatsApp).\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            // Eliminar el mensaje del comando .limpiar
            try {
                await sock.sendMessage(m.chat, { delete: m.key });
            } catch (_) {}

            return;
        }

        // Caso 2: Borrado masivo (o mensaje citado + N adicionales)
        const parsedCant = parseInt(args[0], 10);
        const cantidad = Math.min(Math.max(parsedCant || 10, 1), 100);

        let aEliminar = recentMessagesManager.getRecent(m.chat, cantidad, currentMsgId);

        // Si citó un mensaje y también puso cantidad, asegurar que el citado esté incluido
        if (m.quoted && m.quoted.id && !aEliminar.some(msg => msg.id === m.quoted.id)) {
            aEliminar.unshift({
                id: m.quoted.id,
                remoteJid: m.chat,
                fromMe: Boolean(m.quoted.fromMe),
                participant: m.quoted.participant || m.quoted.sender || undefined
            });
            if (aEliminar.length > cantidad) {
                aEliminar = aEliminar.slice(0, cantidad);
            }
        }

        if (aEliminar.length === 0) {
            return await sock.sendMessage(m.chat, {
                text: '⚠️ No hay mensajes recientes vigentes registrados en la memoria para eliminar.\n' +
                      '💡 _Recuerda que WhatsApp solo permite a los administradores revocar mensajes de menos de 48 horas._\n\n' +
                      '_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        let eliminados = 0;
        const idsEliminados = [];

        // Eliminar de forma secuencial de más reciente a más antiguo
        for (const msg of aEliminar) {
            try {
                const msgSender = (msg.participant || '').split(':')[0].split('@')[0];
                const isMsgFromMe = Boolean(
                    msg.fromMe ||
                    (botNum && msgSender && msgSender === botNum) ||
                    (botLid && msgSender && msgSender === botLid)
                );

                const deleteKey = {
                    remoteJid: m.chat,
                    fromMe: isMsgFromMe,
                    id: msg.id
                };

                if (!isMsgFromMe) {
                    deleteKey.participant = msg.participant;
                }

                await sock.sendMessage(m.chat, { delete: deleteKey });
                eliminados++;
                idsEliminados.push(msg.id);
                await new Promise((resolve) => setTimeout(resolve, 130));
            } catch (err) {
                logger.warn('[LIMPIAR] No se pudo revocar mensaje:', err.message);
            }
        }

        // Actualizar almacenamiento
        recentMessagesManager.remove(m.chat, idsEliminados);

        // Eliminar el mensaje con el comando .limpiar
        try {
            await sock.sendMessage(m.chat, { delete: m.key });
        } catch (_) {}

        // Confirmación
        let confirmText = `🗑️ *${eliminados}* mensajes eliminados exitosamente.\n\n_Unknown Codexツ</>_`;
        if (eliminados < cantidad) {
            confirmText = `🗑️ Se eliminaron *${eliminados}* de *${cantidad}* mensajes solicitados (todos los disponibles dentro del límite de 48h de WhatsApp).\n\n_Unknown Codexツ</>_`;
        }

        await sock.sendMessage(m.chat, { text: confirmText });
    }
};
