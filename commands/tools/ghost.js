'use strict';

const premium = require('../../lib/premium');

module.exports = {
    name: 'ghost',
    alias: ['fantasma', 'ghostmode', 'modofantasma'],
    category: 'herramientas',
    desc: 'Simula desconexión total de WhatsApp de forma indefinida hasta usar .ghost stop (solo owner o premium)',
    usage: '.ghost | .ghost stop',

    execute: async ({ sock, m, args, isOwner, prefix }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender;
        const pfx = prefix || '.';

        if (!isOwner && !premium.isPremium(sender)) {
            return await sock.sendMessage(jid, {
                text: '⭐ Este comando es *Premium*.\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const subCmd = (args[0] || '').toLowerCase().trim();

        // ── 1. Detener ghost mode (.ghost stop / .ghost off / .ghost desactivar) ──
        if (subCmd === 'stop' || subCmd === 'desactivar' || subCmd === 'off') {
            if (!global.ghostMode) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ *El modo ghost no está activo en este momento.*'
                }, { quoted: m });
            }

            global.ghostMode = false;
            if (global.ghostTimer) {
                clearTimeout(global.ghostTimer);
                global.ghostTimer = null;
            }

            // Volver a aparecer disponible en WhatsApp
            try {
                await sock.sendPresenceUpdate('available');
            } catch (_) {}

            return await sock.sendMessage(jid, {
                text: `👻 *[MODO GHOST DESACTIVADO]*\n\n` +
                      `✅ *Estado:* Bot visible y activo nuevamente.\n` +
                      `⚡ Todas las funciones y comandos responden con normalidad.\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // ── 2. Comprobar si ya está activo ──
        if (global.ghostMode) {
            return await sock.sendMessage(jid, {
                text: `⚠️ *El modo ghost ya está activo.*\n\n` +
                      `📵 El bot está simulando desconexión total.\n` +
                      `Para desactivarlo usa: *${pfx}ghost stop*`
            }, { quoted: m });
        }

        // ── 3. Activar ghost mode indefinido (sin tiempo de expiración) ──
        global.ghostMode = true;

        if (global.ghostTimer) {
            clearTimeout(global.ghostTimer);
            global.ghostTimer = null;
        }

        // Aparecer desconectado ante WhatsApp
        try {
            await sock.sendPresenceUpdate('unavailable');
        } catch (_) {}

        return await sock.sendMessage(jid, {
            text: `👻 *[MODO GHOST ACTIVADO]*\n\n` +
                  `📵 *Estado:* Simulación de desconexión total activa.\n` +
                  `🔕 *Comportamiento:* El bot no responderá a ningún comando ni mensaje en ningún chat o grupo.\n` +
                  `⏳ *Duración:* Indefinida (funcionará hasta que ejecutes *${pfx}ghost stop*).\n\n` +
                  `🛑 *Para salir del modo ghost:* Usa *${pfx}ghost stop*\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};
