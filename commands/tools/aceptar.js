'use strict';

/**
 * Comando: .aceptar
 *
 * Acepta una propuesta amorosa pendiente y oficializa la relación de pareja.
 */

const coupleManager = require('../../lib/coupleManager');

module.exports = {
    name: 'aceptar',
    alias: ['acepto', 'si', 'sí'],
    category: 'herramientas',
    desc: 'Acepta una propuesta de noviazgo/matrimonio pendiente.',
    usage: '.aceptar',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        const res = coupleManager.acceptProposal(sender);

        if (res.error === 'NO_PROPOSAL') {
            return await sock.sendMessage(jid, {
                text: [
                    '😅 *[SIN PROPUESTAS PENDIENTES]*',
                    'Nadie te ha propuesto noviazgo recientemente (o la propuesta ya expiró).',
                    '¡Toma tú la iniciativa usando `.ligar @usuario`!',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        try {
            await m.react?.('👩‍❤️‍💋‍👨');
        } catch (_) {}

        const weddingCard = [
            '┏❐ 《 🥂🎉 ¡HABEMUS PAREJA OFICIAL! 💍❤️ 》 ❐',
            '┃',
            `┃├◆ 👩‍❤️‍👨 ¡Felicidades a @${res.user2Phone} y @${res.user1Phone}!`,
            '┃   Han iniciado oficialmente su relación de pareja virtual.',
            '┃',
            `┃├◆ 📅 *Fecha de Aniversario:* ${res.weddingDate}`,
            '┃├◆ 💖 *Nivel de Amor:* 100% (¡Amor a primera vista!)',
            '┃├◆ 📜 *Estado:* Casados y comprometidos ante el bot',
            '┃',
            '┃├◆ 💡 *Comandos útiles de pareja:*',
            '┃  • `.pareja` ➔ Ver el estado y días juntos',
            '┃  • `.romper` ➔ Terminar la relación (esperemos que no)',
            '┗❐\n',
            '¡Que vivan los novios! 🍾🥂\n\n_Unknown Codexツ</>_'
        ].join('\n');

        await sock.sendMessage(jid, {
            text: weddingCard,
            mentions: [res.user1Jid, res.user2Jid]
        });
    }
};

