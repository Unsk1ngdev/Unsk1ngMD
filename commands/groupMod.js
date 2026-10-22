const groupSettings = require('../lib/groupSettings');
const database = require('../lib/database');

/**
 * Normaliza cualquier JID o LID eliminando sufijos de dispositivo (:1, :2) y símbolos
 */
const cleanPhone = (id) => (id ? id.replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '') : '');

/**
 * Extrae el JID objetivo desde menciones o mensaje citado
 */
const getTargetJid = (m) => {
    if (m.mentionedJid && m.mentionedJid.length > 0) {
        return m.mentionedJid[0];
    }
    if (m.quoted && m.quoted.sender) {
        return m.quoted.sender;
    }
    return null;
};

/**
 * Valida si quien ejecuta la acción es el Owner o un Administrador del grupo
 */
const verifyAdminOrOwner = async (sock, jid, senderJid) => {
    if (database.isOwner(senderJid)) return true;

    try {
        const meta = await sock.groupMetadata(jid);
        const senderNum = cleanPhone(senderJid);
        const participant = meta.participants?.find(p => 
            cleanPhone(p.id) === senderNum || cleanPhone(p.lid) === senderNum
        );
        return participant?.admin === 'admin' || participant?.admin === 'superadmin';
    } catch (_) {
        return false;
    }
};

module.exports = [
    // 1. .promote
    {
        name: 'promote',
        alias: ['daradmin', 'promover'],
        category: 'grupo',
        desc: 'Otorga rango de administrador a un miembro del grupo',
        usage: '.promote [@mención o responder mensaje]',
        groupOnly: true,
        execute: async ({ sock, m }) => {
            const hasPermission = await verifyAdminOrOwner(sock, m.chat, m.sender);
            if (!hasPermission) {
                return await m.reply('❌ Este comando es exclusivo para administradores del grupo.');
            }

            const targetJid = getTargetJid(m);
            if (!targetJid) {
                return await m.reply('❌ Debes mencionar a un usuario (@usuario) o responder a su mensaje para promoverlo.');
            }

            const botNum = cleanPhone(sock.user?.id || sock.user?.jid);
            const targetNum = cleanPhone(targetJid);

            if (targetNum === botNum) {
                return await m.reply('❌ No puedo alterar mi propio rol.');
            }

            try {
                await sock.groupParticipantsUpdate(m.chat, [targetJid], 'promote');
                await sock.sendMessage(m.chat, {
                    text: `⭐ ¡Felicidades @${targetNum}! Ahora eres Administrador del grupo.`,
                    mentions: [targetJid]
                }, { quoted: m });
            } catch (err) {
                const errStr = String(err?.message || err);
                const is403 = err?.data === 403 || err?.output?.statusCode === 403 || errStr.includes('403') || errStr.toLowerCase().includes('admin');
                if (is403) {
                    return await m.reply('❌ Necesito ser Administrador del grupo para poder otorgar rangos.');
                }
                throw new Error(`Error al promover administrador: ${err.message}`);
            }
        }
    },

    // 2. .demote
    {
        name: 'demote',
        alias: ['quitaradmin', 'degradar'],
        category: 'grupo',
        desc: 'Remueve el rango de administrador a un miembro del grupo',
        usage: '.demote [@mención o responder mensaje]',
        groupOnly: true,
        execute: async ({ sock, m }) => {
            const hasPermission = await verifyAdminOrOwner(sock, m.chat, m.sender);
            if (!hasPermission) {
                return await m.reply('❌ Este comando es exclusivo para administradores del grupo.');
            }

            const targetJid = getTargetJid(m);
            if (!targetJid) {
                return await m.reply('❌ Debes mencionar a un usuario (@usuario) o responder a su mensaje para degradarlo.');
            }

            const botNum = cleanPhone(sock.user?.id || sock.user?.jid);
            const targetNum = cleanPhone(targetJid);

            if (targetNum === botNum) {
                return await m.reply('❌ No puedo alterar mi propio rol.');
            }

            if (database.isOwner(targetJid)) {
                return await m.reply('❌ No se puede degradar al Creador/Owner del bot.');
            }

            try {
                await sock.groupParticipantsUpdate(m.chat, [targetJid], 'demote');
                await sock.sendMessage(m.chat, {
                    text: `🔻 @${targetNum} ha sido degradado a miembro común.`,
                    mentions: [targetJid]
                }, { quoted: m });
            } catch (err) {
                const errStr = String(err?.message || err);
                const is403 = err?.data === 403 || err?.output?.statusCode === 403 || errStr.includes('403') || errStr.toLowerCase().includes('admin');
                if (is403) {
                    return await m.reply('❌ Necesito ser Administrador del grupo para poder remover rangos.');
                }
                throw new Error(`Error al degradar administrador: ${err.message}`);
            }
        }
    },

    // 3. .kick / .ban
    {
        name: 'kick',
        alias: ['ban', 'expulsar', 'sacar'],
        category: 'grupo',
        desc: 'Expulsa a un participante del grupo mediante mención o respondiendo a su mensaje',
        usage: '.kick [@mención o responder mensaje]',
        groupOnly: true,
        execute: async ({ sock, m }) => {
            const hasPermission = await verifyAdminOrOwner(sock, m.chat, m.sender);
            if (!hasPermission) {
                return await m.reply('❌ Este comando es exclusivo para administradores del grupo.');
            }

            const targetJid = getTargetJid(m);
            if (!targetJid) {
                return await m.reply('❌ Debes mencionar a un usuario (@usuario) o responder a su mensaje para expulsarlo.');
            }

            const botNum = cleanPhone(sock.user?.id || sock.user?.jid);
            const targetNum = cleanPhone(targetJid);

            if (targetNum === botNum) {
                return await m.reply('❌ No puedo auto-expulsarme.');
            }

            if (database.isOwner(targetJid)) {
                return await m.reply('❌ No se puede expulsar al Creador/Owner del bot.');
            }

            try {
                await sock.groupParticipantsUpdate(m.chat, [targetJid], 'remove');
                await sock.sendMessage(m.chat, {
                    text: `👋 @${targetNum} ha sido expulsado del grupo.`,
                    mentions: [targetJid]
                }, { quoted: m });
            } catch (err) {
                const errStr = String(err?.message || err);
                const is403 = err?.data === 403 || err?.output?.statusCode === 403 || errStr.includes('403') || errStr.toLowerCase().includes('admin');
                if (is403) {
                    return await m.reply('❌ Necesito ser Administrador del grupo para expulsar miembros.');
                }
                throw new Error(`No se pudo expulsar al participante: ${err.message}`);
            }
        }
    },

    // 4. .antilink
    {
        name: 'antilink',
        alias: ['antienlaces', 'antienlace'],
        category: 'grupo',
        desc: 'Activa o desactiva la expulsión inmediata de usuarios que envíen enlaces no autorizados',
        usage: '.antilink [on / off]',
        groupOnly: true,
        execute: async ({ sock, m, args }) => {
            const hasPermission = await verifyAdminOrOwner(sock, m.chat, m.sender);
            if (!hasPermission) {
                return await m.reply('❌ Este comando es exclusivo para administradores del grupo.');
            }

            const option = (args[0] || '').toLowerCase().trim();
            if (option !== 'on' && option !== 'off') {
                const isEnabled = groupSettings.isAntilinkEnabled(m.chat);
                return await m.reply(
                    `🛡️ *ANTI-ENLACES AUTOMATIZADO*\n\n` +
                    `📌 *Estado actual:* ${isEnabled ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}\n\n` +
                    `💡 *Uso:*\n` +
                    `• *.antilink on*  - Activa la eliminación de mensajes y expulsión inmediata de spammers\n` +
                    `• *.antilink off* - Desactiva el filtro`
                );
            }

            const enable = option === 'on';
            groupSettings.setSetting(m.chat, 'antilink', enable);

            await m.reply(
                `🛡️ *ANTI-ENLACES:* Ha sido *${enable ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}* en este grupo.\n` +
                `${enable ? '⚠️ Cualquier miembro no-admin que envíe enlaces será eliminado inmediatamente.' : 'ℹ️ El envío de enlaces vuelve a estar permitido.'}`
            );
        }
    },

    // 5. .antispam
    {
        name: 'antispam',
        alias: ['spamfilter'],
        category: 'grupo',
        desc: 'Activa o desactiva el filtro de spam (Modo Advertencia: borra mensajes y avisa sin expulsar)',
        usage: '.antispam [on / off]',
        groupOnly: true,
        execute: async ({ sock, m, args }) => {
            const hasPermission = await verifyAdminOrOwner(sock, m.chat, m.sender);
            if (!hasPermission) {
                return await m.reply('❌ Este comando es exclusivo para administradores del grupo.');
            }

            const rawOpt = (args[0] || '').toLowerCase().trim();
            const onValues = ['on', 'activar', 'enable', '1', 'si', 'sí', 'true', 'encender', 'prendido', 'prender'];
            const offValues = ['off', 'desactivar', 'disable', '0', 'no', 'false', 'apagar', 'apagado'];

            let enable = null;
            if (onValues.includes(rawOpt)) enable = true;
            else if (offValues.includes(rawOpt)) enable = false;

            if (enable === null) {
                const isEnabled = groupSettings.isAntispamEnabled(m.chat);
                const isKick = groupSettings.isAntispamKickEnabled(m.chat);
                return await m.reply(
                    `⏱️ *ANTI-SPAM (MODO ADVERTENCIA)*\n\n` +
                    `📌 *Estado actual:* ${isEnabled ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}\n` +
                    `⚡ *Modo Expulsión (Kick):* ${isKick ? 'ACTIVADO 🚨 (usa .antispamkick off para desactivar)' : 'DESACTIVADO (Solo borra y avisa) 🛡️'}\n\n` +
                    `💡 *Uso:*\n` +
                    `• *.antispam on*  - Borra ráfagas de spam y advierte (no expulsará a nadie)\n` +
                    `• *.antispam off* - Desactiva la protección completamente\n` +
                    `• *.antispamkick on* - Activa la expulsión automática si continúan haciendo spam`
                );
            }

            groupSettings.setSetting(m.chat, 'antispam', enable);

            if (!enable) {
                // Al apagar antispam, limpiar cualquier tracker en memoria y apagar también kick
                groupSettings.setSetting(m.chat, 'antispamkick', false);
                try {
                    const antispamMiddleware = require('../middlewares/antispam');
                    if (typeof antispamMiddleware.resetChat === 'function') {
                        antispamMiddleware.resetChat(m.chat);
                    }
                } catch (_) {}
            }

            await m.reply(
                enable
                    ? `⏱️ *ANTI-SPAM ACTIVADO ✅*\n\n> 🛡️ *Modo:* Borrado de mensajes y advertencias (no expulsará a nadie).\n> 💡 _Si deseas que además expulse a quienes continúen haciendo spam, activa *.antispamkick on*_`
                    : `⏱️ *ANTI-SPAM DESACTIVADO ❌*\n\n> El filtro de spam ha sido apagado completamente en este grupo.`
            );
        }
    },

    // 6. .antispamkick
    {
        name: 'antispamkick',
        alias: ['spamkick'],
        category: 'grupo',
        desc: 'Activa o desactiva la expulsión automática por spam repetido',
        usage: '.antispamkick [on / off]',
        groupOnly: true,
        execute: async ({ sock, m, args }) => {
            const hasPermission = await verifyAdminOrOwner(sock, m.chat, m.sender);
            if (!hasPermission) {
                return await m.reply('❌ Este comando es exclusivo para administradores del grupo.');
            }

            const rawOpt = (args[0] || '').toLowerCase().trim();
            const onValues = ['on', 'activar', 'enable', '1', 'si', 'sí', 'true', 'encender', 'prendido', 'prender'];
            const offValues = ['off', 'desactivar', 'disable', '0', 'no', 'false', 'apagar', 'apagado'];

            let enable = null;
            if (onValues.includes(rawOpt)) enable = true;
            else if (offValues.includes(rawOpt)) enable = false;

            if (enable === null) {
                const isKick = groupSettings.isAntispamKickEnabled(m.chat);
                const isAntispam = groupSettings.isAntispamEnabled(m.chat);
                return await m.reply(
                    `🚨 *ANTI-SPAM ESTRICTO (KICK)*\n\n` +
                    `📌 *Estado actual:* ${isKick ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}\n` +
                    `🛡️ *Anti-Spam Base:* ${isAntispam ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}\n\n` +
                    `💡 *Uso:*\n` +
                    `• *.antispamkick on*  - Borra ráfagas de spam y expulsa al infractor si continúa\n` +
                    `• *.antispamkick off* - Desactiva la expulsión (solo borrará y advertirá)\n\n` +
                    `_Nota: Para expulsar infractores, el bot debe tener rango de administrador._`
                );
            }

            if (enable) {
                // Si activan kick, asegurarse de que antispam base también esté activado
                groupSettings.setSetting(m.chat, 'antispam', true);
            }
            groupSettings.setSetting(m.chat, 'antispamkick', enable);

            await m.reply(
                enable
                    ? `🚨 *ANTI-SPAM KICK ACTIVADO ✅*\n\n> ⚡ *Modo Estricto:* Se expulsará automáticamente a los miembros que ignoren las advertencias de spam.\n> ⚠️ _Asegúrate de que el bot sea Administrador del grupo para poder expulsar._`
                    : `🚨 *ANTI-SPAM KICK DESACTIVADO ❌*\n\n> 🛡️ El bot ya *NO* expulsará a nadie por spam. Solo borrará los mensajes repetidos y advertirá.`
            );
        }
    },

    // 7. .bienvenido/a
    {
        name: 'bienvenido/a',
        alias: ['bienvenida', 'bienvenido', 'bienvenida/o', 'welcome'],
        category: 'grupo',
        desc: 'Activa o desactiva la bienvenida automática con foto y descripción para nuevos miembros',
        usage: '.bienvenido/a [on / off]',
        groupOnly: true,
        execute: async ({ sock, m, args }) => {
            const hasPermission = await verifyAdminOrOwner(sock, m.chat, m.sender);
            if (!hasPermission) {
                return await m.reply('❌ Este comando es exclusivo para administradores del grupo.');
            }

            const option = (args[0] || '').toLowerCase().trim();
            if (option !== 'on' && option !== 'off') {
                const isEnabled = groupSettings.isBienvenidaEnabled(m.chat);
                return await m.reply(
                    `👋 *BIENVENIDO/A DE GRUPO*\n\n` +
                    `📌 *Estado actual:* ${isEnabled ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}\n\n` +
                    `💡 *Uso:*\n` +
                    `• *.bienvenido/a on*  - Envía saludo con foto de perfil y descripción a quien ingrese\n` +
                    `• *.bienvenido/a off* - Desactiva el mensaje de bienvenida`
                );
            }

            const enable = option === 'on';
            groupSettings.setSetting(m.chat, 'bienvenida', enable);

            await m.reply(`👋 *BIENVENIDO/A:* Los mensajes automáticos para nuevos miembros han sido *${enable ? 'ACTIVADOS ✅' : 'DESACTIVADOS ❌'}*.`);
        }
    }
];
