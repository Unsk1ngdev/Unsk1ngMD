'use strict';

/**
 * Comando: .stalkear @usuario | .stalkear stop
 * Premium + Owner: Monitorea cuando un número entra/sale de línea.
 * Requiere que index.js registre el evento presence.update.
 */

const premium  = require('../../lib/premium');
const stalkear = require('../../lib/stalkear');

module.exports = {
    name: 'stalkear',
    alias: ['stalker', 'espiar', 'monitorear'],
    category: 'tools',
    desc: 'Monitorea la conexión de un número y notifica en privado (Premium)',
    usage: '.stalkear @usuario | .stalkear stop',
    groupOnly: false,
    adminOnly: false,

    execute: async ({ sock, m, args, isOwner }) => {
        // Verificar acceso premium o owner
        if (!isOwner && !premium.isPremium(m.sender)) {
            return await sock.sendMessage(m.chat, {
                text: '⭐ Este comando es exclusivo para miembros *Premium*.\n\n💎 Contacta al owner para obtener acceso.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const subCmd = (args[0] || '').toLowerCase();

        // Detener todos los monitoreos activos
        if (subCmd === 'stop' || subCmd === 'detener' || subCmd === 'off') {
            const activos = stalkear.all();
            if (activos.length === 0) {
                return await sock.sendMessage(m.chat, {
                    text: '⚠️ No hay monitoreos activos.'
                }, { quoted: m });
            }

            let cancelados = 0;
            for (const [targetJid] of activos) {
                stalkear.remove(targetJid);
                try { await sock.unsubscribePresence(targetJid); } catch (_) {}
                cancelados++;
            }

            return await sock.sendMessage(m.chat, {
                text: '✅ *' + cancelados + '* monitoreo(s) detenido(s).\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        // Resolver JID objetivo
        let targetJid = null;
        if (m.mentionedJid && m.mentionedJid.length > 0) {
            targetJid = m.mentionedJid[0];
        } else if (m.quoted && m.quoted.sender) {
            targetJid = m.quoted.sender;
        } else if (args[0]) {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw.length >= 7) targetJid = raw + '@s.whatsapp.net';
        }

        if (!targetJid) {
            return await sock.sendMessage(m.chat, {
                text: '❌ Uso:\n*.stalkear @usuario* — Activar monitoreo\n*.stalkear stop* — Desactivar todos'
            }, { quoted: m });
        }

        // Verificar que el número existe en WhatsApp
        const check = await sock.onWhatsApp(targetJid).catch(() => null);
        if (!check || !check[0] || !check[0].exists) {
            return await sock.sendMessage(m.chat, {
                text: '❌ Ese número no está registrado en WhatsApp.'
            }, { quoted: m });
        }

        const validJid = check[0].jid;
        const number   = validJid.split('@')[0];

        if (stalkear.isActive(validJid)) {
            return await sock.sendMessage(m.chat, {
                text: '⚠️ Ya estás monitoreando a *+' + number + '*.\nUsa *.stalkear stop* para desactivar.'
            }, { quoted: m });
        }

        // Activar monitoreo
        const ownerJid = m.sender.includes('@') ? m.sender : m.sender + '@s.whatsapp.net';
        stalkear.add(validJid, ownerJid);

        try {
            await sock.presenceSubscribe(validJid);
        } catch (err) {
            console.warn('[stalkear] presenceSubscribe falló:', err.message);
        }

        await sock.sendMessage(m.chat, {
            text: [
                '👁️ *Monitoreo activado*',
                '',
                '📱 Número: *+' + number + '*',
                '🔔 Recibirás notificaciones privadas cuando entre y salga de línea.',
                '',
                'Para detener: *.stalkear stop*',
                '',
                '_Unknown Codexツ</>_'
            ].join('\n')
        }, { quoted: m });
    }
};

