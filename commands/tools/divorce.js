'use strict';

const coupleManager = require('../../lib/coupleManager');

module.exports = {
    name: 'divorce',
    alias: ['divorcio', 'separarse', 'cortarrelacion'],
    category: 'herramientas',
    desc: 'Termina tu matrimonio o relación de pareja actual y vuelve a la soltería',
    usage: '.divorce',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        const res = coupleManager.breakUp(sender);

        if (res.error === 'NOT_IN_COUPLE') {
            return await sock.sendMessage(jid, {
                text: '💔 No estás casado(a) ni en ninguna relación amorosa actualmente.\nUsa `.marry @usuario` para proponer matrimonio.'
            }, { quoted: m });
        }

        await m.react?.('💔');
        return await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 💔 DIVORCIO COMPLETADO 》 ❐',
                '┃',
                `┃├◆ La unión matrimonial entre @${res.userPhone} y @${res.exPartnerPhone} ha terminado oficialmente.`,
                '┃├◆ ⚖️ Los papeles de divorcio han sido firmados y ambos vuelven a la soltería.',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n'),
            mentions: [`${res.userPhone}@s.whatsapp.net`, `${res.exPartnerPhone}@s.whatsapp.net`]
        }, { quoted: m });
    }
};

