'use strict';

const coupleManager = require('../../lib/coupleManager');
const economy = require('../../lib/economy');

module.exports = {
    name: 'marry',
    alias: ['casarse', 'matrimonio', 'boda', 'proponer'],
    category: 'herramientas',
    desc: 'Propuesta formal de matrimonio a otro usuario en el grupo (se acepta con .aceptar o se rechaza con .rechazar)',
    usage: '.marry @usuario (o citando su mensaje)',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        let targetJid = null;
        if (m.mentionedJid && m.mentionedJid.length > 0) {
            targetJid = m.mentionedJid[0];
        } else if (m.quoted) {
            targetJid = m.quoted.sender || m.quoted.participant;
        }

        if (!targetJid) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 💍 PROPUESTA DE MATRIMONIO 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* `.marry @usuario`',
                    '┃├◆ 📌 *Ejemplo:* `.marry @amor`',
                    '┃',
                    '┃├◆ 💡 El usuario citado recibirá tu propuesta formal',
                    '┃   y podrá responder con `.aceptar` o `.rechazar`.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        const res = coupleManager.propose(sender, targetJid, jid);

        if (res.error === 'SELF_PROPOSAL') {
            return await sock.sendMessage(jid, {
                text: '😂 No puedes casarte contigo mismo(a). ¡Busca a tu media naranja!'
            }, { quoted: m });
        }

        if (res.error === 'ALREADY_COUPLE') {
            return await sock.sendMessage(jid, {
                text: `💍 Ya estás casado(a) o en una relación con @${res.partnerPhone}.\nSi deseas separarte, usa \`.divorce\`.`,
                mentions: [`${res.partnerPhone}@s.whatsapp.net`]
            }, { quoted: m });
        }

        if (res.error === 'TARGET_ALREADY_COUPLE') {
            return await sock.sendMessage(jid, {
                text: `💔 Esa persona ya está en una relación con @${res.partnerPhone}. ¡Respeta el matrimonio ajeno!`,
                mentions: [`${res.partnerPhone}@s.whatsapp.net`]
            }, { quoted: m });
        }

        if (res.error === 'PROPOSAL_PENDING') {
            return await sock.sendMessage(jid, {
                text: '⏳ Esa persona ya tiene una propuesta pendiente en espera. Espera a que responda.'
            }, { quoted: m });
        }

        await m.react?.('💍');
        return await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 💍 ¡PETICIÓN FORMAL DE MATRIMONIO! 》 ❐',
                '┃',
                `┃├◆ 👰 @${sender.split('@')[0]} se ha puesto de rodillas frente a ti, @${targetJid.split('@')[0]}.`,
                '┃├◆ 💎 Ha sacado un anillo brillante y te pregunta:',
                '┃   _¿Aceptas unir tu destino en sagrado matrimonio?_',
                '┃',
                '┃├◆ ⏱️ Tienes *5 minutos* para decidir.',
                '┃   👉 Escribe: `.aceptar` (Para dar el SÍ y casarse)',
                '┃   👉 Escribe: `.rechazar` (Para romperle el corazón)',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n'),
            mentions: [sender, targetJid]
        }, { quoted: m });
    }
};

