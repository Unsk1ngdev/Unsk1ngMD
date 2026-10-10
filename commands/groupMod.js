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
        desc: 'Activa o desactiva el filtro de spam (Modo Advertencia: borra mensajes y avisa)',
        usage: '.antispam [on / off]',
        groupOnly: true,
        execute: async ({ sock, m, args }) => {
            const hasPermission = await verifyAdminOrOwner(sock, m.chat, m.sender);
            if (!hasPermission) {
                return await m.reply('❌ Este comando es exclusivo para administradores del grupo.');
            }

            const option = (args[0] || '').toLowerCase().trim();
            if (option !== 'on' && option !== 'off') {
                const isEnabled = groupSettings.isAntispamEnabled(m.chat);
                return await m.reply(
                    `⏱️ *ANTI-SPAM (MODO ADVERTENCIA)*\n\n` +
                    `📌 *Estado actual:* ${isEnabled ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}\n\n` +
                    `💡 *Uso:*\n` +
                    `• *.antispam on*  - Detecta ráfagas de más de 5 mensajes en 3 seg, los borra y advierte\n` +
                    `• *.antispam off* - Desactiva la protección`
                );
            }

            const enable = option === 'on';
            groupSettings.setSetting(m.chat, 'antispam', enable);

            await m.reply(`⏱️ *ANTI-SPAM:* Modo Advertencia *${enable ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}*.`);
        }
    },

    // 6. .antispamkick
    {
        name: 'antispamkick',
        alias: ['spamkick'],
        category: 'grupo',
        desc: 'Activa o desactiva el modo estricto de spam (borra mensajes y expulsa al infractor)',
        usage: '.antispamkick [on / off]',
        groupOnly: true,
        execute: async ({ sock, m, args }) => {
            const hasPermission = await verifyAdminOrOwner(sock, m.chat, m.sender);
            if (!hasPermission) {
                return await m.reply('❌ Este comando es exclusivo para administradores del grupo.');
            }

            const option = (args[0] || '').toLowerCase().trim();
            if (option !== 'on' && option !== 'off') {
                const isEnabled = groupSettings.isAntispamKickEnabled(m.chat);
                return await m.reply(
                    `🚨 *ANTI-SPAM ESTRICTO (KICK)*\n\n` +
                    `📌 *Estado actual:* ${isEnabled ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}\n\n` +
                    `💡 *Uso:*\n` +
                    `• *.antispamkick on*  - Borra mensajes repetidos y expulsa automáticamente al usuario\n` +
                    `• *.antispamkick off* - Desactiva el modo estricto`
                );
            }

            const enable = option === 'on';
            groupSettings.setSetting(m.chat, 'antispamkick', enable);

            await m.reply(`🚨 *ANTI-SPAM KICK:* Modo Estricto *${enable ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}* en este grupo.`);
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
