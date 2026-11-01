'use strict';

/**
 * Comando: .ligar @usuario
 *
 * Tira los tejos a otro usuario en un grupo o chat.
 * El usuario mencionado puede responder con .aceptar o .rechazar.
 */

const coupleManager = require('../../lib/coupleManager');

module.exports = {
    name: 'ligar',
    alias: ['proponer', 'declarar', 'casar', 'pedir'],
    category: 'herramientas',
    desc: 'Propón una relación amorosa a otro usuario. Podrá aceptar (.aceptar) o rechazar (.rechazar).',
    usage: '.ligar @usuario (o citando su mensaje)',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        // Resolver target
        let targetJid = null;
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

        if (!targetJid) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 💘 PROPUESTA DE AMOR 》 ❐',
                    '┃',
                    '┃├◆ ¡Tírale los tejos a alguien especial!',
                    '┃',
                    '┃├◆ 📋 *Uso:*',
                    '┃  `.ligar @usuario` (o cita su mensaje)',
                    '┃',
                    '┃├◆ 📌 *Ejemplo:*',
                    '┃  `.ligar @18091234567`',
                    '┃',
                    '┃├◆ 💡 La persona tendrá 5 minutos para',
                    '┃  responder con `.aceptar` o `.rechazar`.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        const senderPhone = coupleManager.cleanNum(sender);
        const targetPhone = coupleManager.cleanNum(targetJid);
        const botPhone = (sock.user?.id || sock.user?.jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');

        if (targetPhone === botPhone) {
            return await sock.sendMessage(jid, {
                text: '🤖 *¡Ay qué halago!* Pero mi único amor es el código y los servidores 💾❤️\n\n_Unknown Codexツ</>_',
            }, { quoted: m });
        }

        const res = coupleManager.propose(sender, targetJid, jid);

        if (res.error === 'SELF_PROPOSAL') {
            return await sock.sendMessage(jid, {
                text: '😂 *¿Tan solitario estás?* No puedes proponerte matrimonio a ti mismo. ¡Elige a alguien del grupo!\n\n_Unknown Codexツ</>_',
            }, { quoted: m });
        }

        if (res.error === 'ALREADY_COUPLE') {
            return await sock.sendMessage(jid, {
                text: `⚠️ *¡Cuidado!* Ya estás en una relación oficial con @${res.partnerPhone}.\nDebes usar \`.romper\` antes de cortejar a alguien más 💔\n\n_Unknown Codexツ</>_`,
                mentions: [`${res.partnerPhone}@s.whatsapp.net`]
            }, { quoted: m });
        }

        if (res.error === 'TARGET_ALREADY_COUPLE') {
            return await sock.sendMessage(jid, {
                text: `🚫 *¡Hombre/Mujer prohibido(a)!* @${targetPhone} ya está en una relación con @${res.partnerPhone}.\n¡Respeta las parejas del grupo! ✋\n\n_Unknown Codexツ</>_`,
                mentions: [targetJid, `${res.partnerPhone}@s.whatsapp.net`]
            }, { quoted: m });
        }

        if (res.error === 'PROPOSAL_PENDING') {
            return await sock.sendMessage(jid, {
                text: `⏳ @${targetPhone} ya tiene una propuesta pendiente de @${res.fromPhone}.\nEspera a que responda o a que expire el tiempo.\n\n_Unknown Codexツ</>_`,
                mentions: [targetJid, `${res.fromPhone}@s.whatsapp.net`]
            }, { quoted: m });
        }

        try {
            await m.react?.('💘');
        } catch (_) {}

        const loveCard = [
            '┏❐ 《 💍 ¡DECLARACIÓN DE AMOR PÚBLICA! 》 ❐',
            '┃',
            `┃├◆ 💘 @${senderPhone} le ha tirado los tejos`,
            `┃   y se le ha declarado a @${targetPhone}...!`,
            '┃',
            '┃├◆ 💬 *La gran pregunta:*',
            '┃   _«¿Aceptas ser mi pareja virtual y compartir',
            '┃   nuestro destino juntos en este grupo?»_',
            '┃',
            '┃├◆ 💌 *Para responder:*',
            '┃   👉 Escribe: `.aceptar` (para decir que SÍ ❤️)',
            '┃   👉 Escribe: `.rechazar` (para mandarlo a la friendzone 💔)',
            '┃',
            '┃├◆ ⏰ *Tiempo límite:* 5 minutos',
            '┗❐\n',
            '_Unknown Codexツ</>_'
        ].join('\n');

        await sock.sendMessage(jid, {
            text: loveCard,
            mentions: [sender, targetJid]
        });
    }
};

