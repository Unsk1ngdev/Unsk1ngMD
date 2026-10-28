'use strict';

const groupSettings = require('../../lib/groupSettings');

module.exports = {
    name: 'antibadword',
    alias: ['antitoxico', 'antimalaspalabras', 'badwords'],
    category: 'grupo',
    desc: 'Activa o desactiva el filtro automático de malas palabras e insultos en el grupo',
    usage: '.antibadword [on / off]',
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
            newState = !current.antibadword;
        }

        groupSettings.setSetting(chatId, 'antibadword', newState);

        await sock.sendMessage(chatId, {
            text: `🛡️ *ANTIBADWORD (FILTRO DE INSULTOS):* ${newState ? '🟢 *ACTIVADO*' : '🔴 *DESACTIVADO*'}\n\n` +
                  (newState
                      ? '_El bot advertirá o borrará automáticamente los mensajes que contengan insultos graves._'
                      : '_Filtro de malas palabras desactivado en este grupo._') +
                  `\n\n_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

