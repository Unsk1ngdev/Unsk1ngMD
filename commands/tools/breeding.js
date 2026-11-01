'use strict';

const rpgManager = require('../../lib/rpgManager');
const economy = require('../../lib/economy');

module.exports = {
    name: 'breeding',
    alias: ['criar', 'crianza', 'cruzar', 'criarmascota'],
    category: 'rpg',
    desc: 'Cruza tu mascota con la de otro usuario para engendrar una nueva cría (ambas nivel 3+)',
    usage: '.breeding @usuario',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        // Resolver target
        let targetJid = null;
        if (m.mentionedJid && m.mentionedJid.length > 0) {
            targetJid = m.mentionedJid[0];
        } else if (m.quoted) {
            targetJid = m.quoted.sender || m.quoted.participant;
        }

        if (!targetJid) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🐣 CRIANZA Y CRUCE DE MASCOTAS 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* `.breeding @usuario`',
                    '┃├◆ 💡 *Requisitos:*',
                    '┃   1. Ambos usuarios deben tener una mascota adoptada.',
                    '┃   2. Ambas mascotas deben ser de nivel 3 o superior.',
                    '┃   3. Se requiere un período de descanso de 12 horas entre cruces.',
                    '┃',
                    '┃├◆ 🎁 *Recompensas:* Monedas, EXP y una cría mágica.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        if (targetJid === sender) {
            return await sock.sendMessage(jid, {
                text: '😂 Tu mascota no puede cruzarse consigo misma. Menciona a otro usuario.'
            }, { quoted: m });
        }

        const res = rpgManager.breedPets(sender, targetJid);

        if (res.error === 'BOTH_NEED_PETS') {
            return await sock.sendMessage(jid, {
                text: '❌ Ambos usuarios deben tener una mascota adoptada para poder cruzarlas.\nEscribe `.petshop` para adoptar.'
            }, { quoted: m });
        }

        if (res.error === 'LEVEL_TOO_LOW') {
            return await sock.sendMessage(jid, {
                text: '⚠️ Ambas mascotas deben haber alcanzado al menos el *Nivel 3* para reproducirse.\nEntrena a tu mascota con `.pet train`.'
            }, { quoted: m });
        }

        if (res.error === 'BREEDING_CD') {
            return await sock.sendMessage(jid, {
                text: `⏳ Tus mascotas están descansando del cruce anterior.\n⏱️ Tiempo restante: *${res.timeLeft}*`
            }, { quoted: m });
        }

        await m.react?.('🐣');
        return await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 🐣 ¡EL NACIMIENTO DE UNA CRÍA! 》 ❐',
                '┃',
                `┃├◆ ¡Felicidades @${sender.split('@')[0]} y @${targetJid.split('@')[0]}!`,
                `┃├◆ 🐾 Padres: *${res.parent1.name}* (${res.parent1.species}) + *${res.parent2.name}* (${res.parent2.species})`,
                `┃├◆ ✨ ¡Ha nacido un hermoso *${res.baby.nombre}*!`,
                '┃',
                '┃├◆ 🎁 *Recompensas para ambos dueños:*',
                '┃   💰 +$1,500 monedas',
                '┃   🔮 +350 EXP de crianza',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n'),
            mentions: [sender, targetJid]
        }, { quoted: m });
    }
};

