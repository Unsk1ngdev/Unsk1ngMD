'use strict';

/**
 * Comando: .rechazar
 *
 * Rechaza una propuesta de noviazgo y manda al pretendiente a la friendzone.
 */

const coupleManager = require('../../lib/coupleManager');

module.exports = {
    name: 'rechazar',
    alias: ['rechazo', 'no', 'friendzone'],
    category: 'herramientas',
    desc: 'Rechaza una propuesta amorosa pendiente.',
    usage: '.rechazar',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        const res = coupleManager.rejectProposal(sender);

        if (res.error === 'NO_PROPOSAL') {
            return await sock.sendMessage(jid, {
                text: '😅 No tienes ninguna propuesta de amor pendiente por rechazar.\n\n_Unknown Codexツ</>_',
            }, { quoted: m });
        }

        try {
            await m.react?.('🥀');
        } catch (_) {}

        const rejectedCard = [
            '┏❐ 《 💔 ¡SOLDADO CAÍDO! 🪖🥀 》 ❐',
            '┃',
            `┃├◆ 😢 @${res.targetPhone} ha RECHAZADO la propuesta`,
            `┃   amorosa de @${res.fromPhone}...`,
            '┃',
            '┃├◆ 💬 *Sentencia del jurado:*',
            '┃   _«Te quiero mucho, pero solo como amigo(a)...»_',
            '┃',
            '┃├◆ ⚰️ Un minuto de silencio por el corazón roto.',
            '┃   Directo a la Friendzone sin escalas.',
            '┗❐\n',
            '_Unknown Codexツ</>_'
        ].join('\n');

        await sock.sendMessage(jid, {
            text: rejectedCard,
            mentions: [res.fromJid, res.targetJid]
        });
    }
};

