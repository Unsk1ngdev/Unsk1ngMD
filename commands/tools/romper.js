'use strict';

/**
 * Comando: .romper
 *
 * Termina la relación amorosa actual y devuelve a ambos usuarios a la soltería.
 */

const coupleManager = require('../../lib/coupleManager');

module.exports = {
    name: 'romper',
    alias: ['terminar', 'divorcio', 'separar', 'cortar'],
    category: 'herramientas',
    desc: 'Termina tu relación de pareja actual y vuelve a estar soltero(a).',
    usage: '.romper',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        const res = coupleManager.breakUp(sender);

        if (res.error === 'NOT_IN_COUPLE') {
            return await sock.sendMessage(jid, {
                text: [
                    '🕊️ *[ALMA LIBRE]*',
                    'No tienes ninguna pareja activa en este momento.',
                    '¡Usa `.ligar @usuario` si quieres buscar a tu media naranja!',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        try {
            await m.react?.('💔');
        } catch (_) {}

        const breakCard = [
            '┏❐ 《 💔🥀 ¡RUPTURA OFICIAL! 😭 》 ❐',
            '┃',
            `┃├◆ ⚡ @${res.userPhone} ha decidido terminar`,
            `┃   su relación con @${res.partnerPhone}.`,
            '┃',
            `┃├◆ ⏳ *Tiempo que duraron:* ${res.days} día${res.days !== 1 ? 's' : ''}`,
            '┃├◆ 🌧️ *Causa:* Diferencias irreconciliables en el chat.',
            '┃',
            '┃├◆ 🕊️ *Estado actual:*',
            '┃   Ambos vuelven a estar *100% SOLTEROS* y',
            '┃   disponibles en el mercado del bot.',
            '┗❐\n',
            '_Unknown Codexツ</>_'
        ].join('\n');

        await sock.sendMessage(jid, {
            text: breakCard,
            mentions: [sender, res.partnerJid]
        });
    }
};

