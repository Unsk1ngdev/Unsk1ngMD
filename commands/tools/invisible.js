'use strict';

const premium = require('../../lib/premium');
const database = require('../../lib/database');

module.exports = {
    name: 'invisible',
    alias: ['invisibletxt', 'msginvisible', 'ghostmsg', 'fantasmamsg'],
    category: 'herramientas',
    desc: 'Envía un mensaje sin aparecer en línea ni marcar visto (solo owner o premium)',
    usage: '.invisible [texto]',

    execute: async ({ sock, m, args, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        // Verificación de permisos (Owner o Premium)
        const isPrem = isOwner || database.isOwner(sender, sock) || premium.isPremium(sender, sock);
        if (!isPrem) {
            return await sock.sendMessage(jid, {
                text: '> ♱ Solo _owner_ o _premium_ pueden usar este comando.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const msgText = (args || []).join(' ').trim();
        if (!msgText) {
            return await sock.sendMessage(jid, {
                text: '> ♱ Escribe el mensaje: *.invisible [texto]*\n> Ejemplo: *.invisible Hola a todos*'
            }, { quoted: m });
        }

        try {
            // 1. Marcar mensajes previos como leídos silenciosamente si está soportado
            if (typeof sock.readMessages === 'function' && m.key) {
                await sock.readMessages([m.key]).catch(() => {});
            }

            // 2. Establecer presencia en 'unavailable' (offline / no conectado)
            await sock.sendPresenceUpdate('unavailable', jid).catch(() => {});
            await new Promise(resolve => setTimeout(resolve, 400));

            // 3. Enviar el mensaje solicitado de manera discreta
            await sock.sendMessage(jid, { text: msgText });

            // 4. Reafirmar presencia offline inmediatamente tras el envío
            await sock.sendPresenceUpdate('unavailable', jid).catch(() => {});

        } catch (err) {
            await sock.sendMessage(jid, {
                text: `> ❌ Error al enviar mensaje invisible: ${err.message}`
            }, { quoted: m });
        }
    }
};

