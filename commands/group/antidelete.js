'use strict';

const groupSettings = require('../../lib/groupSettings');

module.exports = {
    name: 'antidelete',
    alias: ['antieliminar', 'nodelete'],
    category: 'grupo',
    desc: 'Activa o desactiva la recuperación de mensajes eliminados en el grupo',
    usage: '.antidelete [on / off]',
    groupOnly: true,
    adminOnly: true,

    execute: async ({ sock, m, args }) => {
        const chatId = m.chat;
        const current = groupSettings.getGroup(chatId);
        const sub = (args[0] || '').toLowerCase().trim();

        let newState;
        if (sub === 'on' || sub === 'activar' || sub === '1') {
            newState = true;
        } else if (sub === 'off' || sub === 'desactivar' || sub === '0') {
            newState = false;
        } else {
            // Alternar estado
            newState = !current.antidelete;
        }

        groupSettings.setSetting(chatId, 'antidelete', newState);

        await sock.sendMessage(chatId, {
            text: `🛡️ *ANTIDELETE:* ${newState ? '🟢 *ACTIVADO*' : '🔴 *DESACTIVADO*'}\n\n` +
                  (newState
                      ? '_Los mensajes eliminados en este grupo serán revelados automáticamente por el bot._'
                      : '_El bot ya no revelará los mensajes que sean borrados._') +
                  `\n\n_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

