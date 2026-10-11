'use strict';

const premium = require('../../lib/premium');

module.exports = {
    name: 'ghost',
    alias: ['fantasma', 'invisible', 'ghostmode'],
    category: 'herramientas',
    desc: 'Simula desconexión real de WhatsApp durante un tiempo determinado (solo owner o premium)',
    usage: '.ghost [segundos] | .ghost stop',

    execute: async ({ sock, m, args, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender;

        if (!isOwner && !premium.isPremium(sender)) {
            return await sock.sendMessage(jid, {
                text: '⭐ Este comando es *Premium*.\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const ownerJid = '18494509905@s.whatsapp.net';
        const subCmd = (args[0] || '').toLowerCase().trim();

        // ── Detener ghost mode ──
        if (subCmd === 'stop' || subCmd === 'desactivar' || subCmd === 'off') {
            if (!global.ghostMode) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ El modo ghost no está activo.'
                }, { quoted: m });
            }

            global.ghostMode = false;
            if (global.ghostTimer) {
                clearTimeout(global.ghostTimer);
                global.ghostTimer = null;
            }

            // Volver a conectarse normalmente
            try {
                await sock.sendPresenceUpdate('available');
            } catch (_) {}

            return await sock.sendMessage(jid, {
                text: '👻 *Modo Ghost desactivado*\n\n' +
                      '✅ Bot visible nuevamente.\n\n' +
                      '_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        if (global.ghostMode) {
            return await sock.sendMessage(jid, {
                text: '⚠️ El modo ghost ya está activo.\nUsa *.ghost stop* para desactivarlo.'
            }, { quoted: m });
        }

        const segundos = parseInt(args[0], 10) || 60;

        if (segundos < 5 || segundos > 3600) {
            return await sock.sendMessage(jid, {
                text: '❌ El tiempo debe ser entre *5* y *3600* segundos.\n' +
                      'Ejemplo: *.ghost 120*'
            }, { quoted: m });
        }

        // Activar ghost mode global
        global.ghostMode = true;

        // Aparecer desconectado
        try {
            await sock.sendPresenceUpdate('unavailable');
        } catch (_) {}

        await sock.sendMessage(jid, {
            text: `👻 *Modo Ghost activado*\n\n` +
                  `⏱️ Duración: *${segundos} segundos*\n` +
                  `🔕 El bot no responderá nada.\n` +
                  `📵 Aparecerás desconectado.\n\n` +
                  `Usa *.ghost stop* para salir antes.\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });

        // Timer para salir automáticamente
        if (global.ghostTimer) clearTimeout(global.ghostTimer);
        global.ghostTimer = setTimeout(async () => {
            global.ghostMode = false;
            global.ghostTimer = null;

            // Volver a conectarse
            try {
                await sock.sendPresenceUpdate('available');
            } catch (_) {}

            // Notificar al owner en privado
            try {
                await sock.sendMessage(ownerJid, {
                    text: `👻 *Modo Ghost finalizado*\n\n` +
                          `⏱️ Duración: *${segundos} segundos*\n` +
                          `✅ Bot visible y activo nuevamente.\n\n` +
                          `_Unknown Codexツ</>_`
                });
            } catch (_) {}
        }, segundos * 1000);
    }
};
