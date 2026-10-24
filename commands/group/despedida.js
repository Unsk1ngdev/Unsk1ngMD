'use strict';

const despedidaManager = require('../../lib/despedida');
const database = require('../../lib/database');

const cleanPhone = (id) => (id ? id.replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '') : '');

module.exports = {
    name: 'despedida',
    alias: ['goodbye', 'bye', 'farewell', 'despedidas'],
    category: 'grupo',
    desc: 'Configura o desactiva la despedida automática con foto y tarjeta visual cuando alguien sale del grupo',
    usage: '.despedida [on / off / reset / test / mensaje personalizado]',
    groupOnly: true,

    execute: async ({ sock, m, args, text, prefix, isAdmin, isOwner, groupMetadata }) => {
        const jid = m.chat;

        if (!m.isGroup && !jid.endsWith('@g.us')) {
            return await m.reply('❌ Este comando solo funciona dentro de grupos de WhatsApp.');
        }

        // Validación robusta de administrador o dueño
        let isSenderAdmin = isAdmin || isOwner || database.isOwner(m.sender);
        if (!isSenderAdmin) {
            let meta = groupMetadata;
            if (!meta) {
                try {
                    meta = await sock.groupMetadata(jid);
                } catch (_) {}
            }
            const senderNum = cleanPhone(m.sender);
            const participant = meta?.participants?.find(p =>
                cleanPhone(p.id) === senderNum || cleanPhone(p.lid) === senderNum
            );
            if (participant?.admin === 'admin' || participant?.admin === 'superadmin') {
                isSenderAdmin = true;
            }
        }

        if (!isSenderAdmin) {
            return await m.reply('❌ Este comando es exclusivo para administradores del grupo.');
        }

        const subCmd = (args[0] || '').toLowerCase().trim();
        const pfx = prefix || '.';

        // 1. Sin argumentos o 'ver' / 'info' / 'status': Mostrar panel informativo de configuración
        if (!subCmd || subCmd === 'ver' || subCmd === 'status' || subCmd === 'info') {
            const config = despedidaManager.getConfig(jid);
            const isEnabled = Boolean(config && config.activo);
            const currentMsg = config?.mensaje || despedidaManager.DEFAULT_DESPEDIDA;

            let groupName = 'el grupo';
            try {
                const meta = groupMetadata || await sock.groupMetadata(jid);
                groupName = meta?.subject || groupName;
            } catch (_) {}

            const panel =
                `╭━━━〔 🚪 *DESPEDIDA DE GRUPO* 〕━━━⬣\n` +
                `┃ 📌 *Estado:* ${isEnabled ? '🟢 ACTIVADO' : '🔴 DESACTIVADO'}\n` +
                `┃ 🏛️ *Grupo:* *${groupName}*\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
                `📝 *Mensaje configurado actualmente:*\n` +
                `"${currentMsg}"\n\n` +
                `⚙️ *Opciones de configuración:*\n` +
                `• *${pfx}despedida on* ➔ Activa la despedida automática\n` +
                `• *${pfx}despedida off* ➔ Desactiva la despedida\n` +
                `• *${pfx}despedida reset* ➔ Restablece el diseño por defecto\n` +
                `• *${pfx}despedida test* ➔ Envía una prueba real al chat\n` +
                `• *${pfx}despedida [texto]* ➔ Guarda un mensaje personalizado\n\n` +
                `💡 *Variables disponibles para tu mensaje:*\n` +
                `• *{usuario}* ➔ Menciona al usuario (@usuario)\n` +
                `• *{grupo}* ➔ Nombre del grupo\n` +
                `• *{miembros}* ➔ Miembros restantes en el grupo\n` +
                `• *{desc}* ➔ Descripción del grupo`;

            return await m.reply(panel);
        }

        // 2. Desactivar despedida
        if (subCmd === 'off' || subCmd === 'desactivar' || subCmd === 'disable') {
            despedidaManager.disable(jid);
            return await m.reply(
                `🚪 *DESPEDIDA:* Los mensajes automáticos de despedida han sido *DESACTIVADOS ❌*.\n` +
                `_Ya no se enviará mensaje cuando un miembro abandone el grupo._`
            );
        }

        // 3. Activar despedida (con opción de mensaje opcional: .despedida on [mensaje])
        if (subCmd === 'on' || subCmd === 'activar' || subCmd === 'enable') {
            const extraMsg = args.slice(1).join(' ').trim();
            if (extraMsg) {
                despedidaManager.setConfig(jid, extraMsg);
            } else {
                despedidaManager.enable(jid);
            }
            const config = despedidaManager.getConfig(jid);
            return await m.reply(
                `🚪 *DESPEDIDA:* Los mensajes automáticos de despedida han sido *ACTIVADOS 🟢*.\n\n` +
                `📝 *Mensaje en uso:*\n"${config.mensaje}"\n\n` +
                `💡 _Escribe *${pfx}despedida test* para comprobar cómo se ve._`
            );
        }

        // 4. Restaurar mensaje predeterminado
        if (subCmd === 'reset' || subCmd === 'restaurar' || subCmd === 'defecto') {
            despedidaManager.reset(jid);
            return await m.reply(
                `🔄 *DESPEDIDA RESTAURADA:*\nSe ha restablecido la plantilla visual y tarjeta predeterminada con éxito. ✅\n\n` +
                `💡 _Escribe *${pfx}despedida test* para ver el resultado._`
            );
        }

        // 5. Simulación / Test en vivo
        if (subCmd === 'test' || subCmd === 'probar' || subCmd === 'demo') {
            let meta = groupMetadata;
            if (!meta) {
                try {
                    meta = await sock.groupMetadata(jid);
                } catch (_) {}
            }

            const config = despedidaManager.getConfig(jid) || { mensaje: despedidaManager.DEFAULT_DESPEDIDA };
            const userTag = cleanPhone(m.sender);
            const groupName = meta?.subject || 'este grupo';
            const memberCount = meta?.participants ? meta.participants.length : 1;
            const groupDesc = meta?.desc || '';

            let pfpUrl = null;
            try {
                pfpUrl = await sock.profilePictureUrl(m.sender, 'image');
            } catch (_) {
                try {
                    pfpUrl = await sock.profilePictureUrl(jid, 'image');
                } catch (_) {}
            }

            const renderedText =
                `🧪 *[SIMULACIÓN / PRUEBA DE DESPEDIDA]*\n\n` +
                despedidaManager.formatMessage(config.mensaje, {
                    userTag,
                    groupName,
                    memberCount,
                    groupDesc
                });

            if (pfpUrl) {
                return await sock.sendMessage(jid, {
                    image: { url: pfpUrl },
                    caption: renderedText,
                    mentions: [m.sender]
                }, { quoted: m });
            } else {
                return await sock.sendMessage(jid, {
                    text: renderedText,
                    mentions: [m.sender]
                }, { quoted: m });
            }
        }

        // 6. Configurar mensaje personalizado directo
        const customMessage = text ? text.trim() : args.join(' ').trim();
        despedidaManager.setConfig(jid, customMessage);

        return await m.reply(
            `✅ *¡DESPEDIDA PERSONALIZADA Y ACTIVADA!* 🚪\n\n` +
            `📝 *Nuevo mensaje guardado:*\n"${customMessage}"\n\n` +
            `💡 *Consejo:* Usa *${pfx}despedida test* para ver cómo lucirá cuando alguien salga del grupo.`
        );
    }
};
