'use strict';

/**
 * Comando: .pareja [@usuario]
 *
 * Muestra el estado de tu relación amorosa o la de otro usuario.
 */

const coupleManager = require('../../lib/coupleManager');

module.exports = {
    name: 'pareja',
    alias: ['mipareja', 'novios', 'statuspareja', 'matrimonio'],
    category: 'herramientas',
    desc: 'Consulta el estado, tiempo juntos y nivel de amor de tu pareja o la de alguien más.',
    usage: '.pareja [@usuario]',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        // Si se menciona o cita a alguien, consultar la pareja de esa persona
        let targetJid = sender;
        if (m.mentionedJid && m.mentionedJid.length > 0) {
            targetJid = m.mentionedJid[0];
        } else if (m.quoted?.sender) {
            targetJid = m.quoted.sender;
        } else if (args[0]) {
            const num = args[0].replace(/\D/g, '');
            if (num.length >= 7) {
                targetJid = `${num}@s.whatsapp.net`;
            }
        }

        const isSelf = targetJid === sender;
        const info = coupleManager.getCouple(targetJid);
        const targetPhone = coupleManager.cleanNum(targetJid);

        if (!info) {
            const msg = isSelf
                ? [
                    '🕊️ *[ESTADO CIVIL: SOLTERO/A]*',
                    '',
                    'Actualmente no tienes pareja virtual.',
                    '¡Tírale los tejos a alguien con `.ligar @usuario` para casarte!',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
                : [
                    '🕊️ *[ESTADO CIVIL: SOLTERO/A]*',
                    '',
                    `@${targetPhone} está completamente soltero(a) y sin compromisos.`,
                    '¡Aprovecha y lánzale una propuesta con `.ligar`! 😉',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n');

            return await sock.sendMessage(jid, {
                text: msg,
                mentions: isSelf ? [] : [targetJid]
            }, { quoted: m });
        }

        const timeString = coupleManager.formatTimeTogether(info.since);
        const lovePercent = info.love;
        const filledBars = Math.round(lovePercent / 10);
        const loveBar = '█'.repeat(filledBars) + '░'.repeat(10 - filledBars);

        try {
            await m.react?.('❤️');
        } catch (_) {}

        const coupleCard = [
            '┏❐ 《 💖 ESTADO DE PAREJA VIRTUAL 💖 》 ❐',
            '┃',
            `┃├◆ 👩‍❤️‍👨 *Miembros:* @${info.userPhone} ✖️ @${info.partnerPhone}`,
            `┃├◆ 📅 *Juntos desde:* ${info.weddingDate}`,
            `┃├◆ ⏳ *Tiempo de relación:* ${timeString}`,
            `┃├◆ 📊 *Nivel de Amor:* ${lovePercent}%`,
            `┃   [${loveBar}]`,
            '┃',
            '┃├◆ 💬 *Veredicto:*',
            '┃   _«Una de las parejas más envidiadas del grupo.»_ 🔥',
            '┃',
            '┃├◆ ⚙️ *Acciones:*',
            '┃  • `.romper` ➔ Terminar el noviazgo',
            '┗❐\n',
            '_Unknown Codexツ</>_'
        ].join('\n');

        await sock.sendMessage(jid, {
            text: coupleCard,
            mentions: [`${info.userPhone}@s.whatsapp.net`, info.partnerJid]
        });
    }
};

