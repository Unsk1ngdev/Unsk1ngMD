'use strict';

const recentMessagesManager = require('../../lib/recentMessages');
const logger = require('../../lib/logger');

module.exports = {
    name: 'limpiar',
    alias: ['clean', 'purge', 'borrarmensajes'],
    category: 'grupo',
    desc: 'Elimina la cantidad exacta de mensajes recientes del grupo (solo admins y owner)',
    usage: '.limpiar [cantidad (1 a 100)] | respondiendo a un mensaje',
    groupOnly: true,
    adminOnly: true,

    execute: async ({ sock, m, args, isBotAdmin, isAdmin, isOwner }) => {
        if (!m.isGroup) {
            return await sock.sendMessage(m.chat, {
                text: '❌ Solo funciona en grupos.'
            }, { quoted: m });
        }

        if (!isAdmin && !isOwner) {
            return await sock.sendMessage(m.chat, {
                text: '❌ Solo admins del grupo o el owner pueden usar este comando.'
            }, { quoted: m });
        }

        if (!isBotAdmin) {
            return await sock.sendMessage(m.chat, {
                text: '❌ Necesito ser administrador del grupo para poder eliminar mensajes de otros miembros.'
            }, { quoted: m });
        }

        // 1. Determinar cantidad solicitada (soporta hasta 100 mensajes)
        const parsedCant = parseInt(args[0], 10);
        const cantidad = Math.min(Math.max(parsedCant || 10, 1), 100);

        // 2. Extraer mensajes a eliminar
        const currentMsgId = m.key?.id;
        let aEliminar = recentMessagesManager.getRecent(m.chat, cantidad, currentMsgId);

        // Si el usuario citó un mensaje específico y no está en la lista, incluirlo
        if (m.quoted && m.quoted.id && !aEliminar.some(msg => msg.id === m.quoted.id)) {
            aEliminar.unshift({
                id: m.quoted.id,
                remoteJid: m.chat,
                fromMe: Boolean(m.quoted.fromMe),
                participant: m.quoted.sender || undefined
            });
        }

        if (aEliminar.length === 0) {
            return await sock.sendMessage(m.chat, {
                text: '⚠️ No hay mensajes recientes registrados en la memoria para eliminar.\n' +
                      '💡 _Los mensajes se registran automáticamente mientras el bot está activo en el grupo._'
            }, { quoted: m });
        }

        let eliminados = 0;
        const idsEliminados = [];

        // 3. Eliminar de forma secuencial con intervalo controlado (120ms)
        // Esto evita que WhatsApp sature el WebSocket o descarte paquetes de revocación en ráfaga
        for (const msg of aEliminar) {
            try {
                const deleteKey = {
                    remoteJid: m.chat,
                    fromMe: Boolean(msg.fromMe),
                    id: msg.id
                };
                if (!msg.fromMe && msg.participant) {
                    deleteKey.participant = msg.participant;
                }

                await sock.sendMessage(m.chat, { delete: deleteKey });
                eliminados++;
                idsEliminados.push(msg.id);
                await new Promise((resolve) => setTimeout(resolve, 120));
            } catch (err) {
                logger.warn('[LIMPIAR] No se pudo revocar mensaje:', err.message);
            }
        }

        // 4. Actualizar memoria y almacenamiento persistente
        recentMessagesManager.remove(m.chat, idsEliminados);

        // 5. Eliminar también el mensaje con el comando .limpiar
        try {
            await sock.sendMessage(m.chat, { delete: m.key });
        } catch (_) {}

        // 6. Mensaje de confirmación detallado
        let confirmText = `🗑️ *${eliminados}* mensajes eliminados exitosamente.\n\n_Unknown Codexツ</>_`;
        if (eliminados < cantidad) {
            confirmText = `🗑️ Se eliminaron *${eliminados}* mensajes de *${cantidad}* solicitados (todos los que estaban disponibles en el historial reciente).\n\n_Unknown Codexツ</>_`;
        }

        await sock.sendMessage(m.chat, { text: confirmText });
    }
};
