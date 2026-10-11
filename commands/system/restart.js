'use strict';

module.exports = {
    name: 'reiniciar',
    alias: ['restart', 'reboot'],
    category: 'sistema',
    desc: 'Reinicia el bot mediante salida controlada process.exit(0)',
    usage: '.reiniciar',
    ownerOnly: true,

    execute: async ({ sock, m, isOwner }) => {
        if (!isOwner) return;

        const jid = m.chat || m.key.remoteJid;

        await sock.sendMessage(jid, {
            text: '🔄 *Reiniciando bot...*\n\n' +
                  '⏱️ Vuelvo en unos segundos.\n\n' +
                  '_Unknown Codexツ</>_'
        }, { quoted: m });

        setTimeout(() => {
            process.exit(0);
        }, 2000);
    }
};
