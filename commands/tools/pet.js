'use strict';

const rpgManager = require('../../lib/rpgManager');
const economy = require('../../lib/economy');

module.exports = {
    name: 'pet',
    alias: ['mascota', 'mimascota', 'mypet'],
    category: 'rpg',
    desc: 'Gestiona tu mascota virtual: aliméntala, entrénala o consulta su estado',
    usage: '.pet status | .pet feed [alimentar] | .pet train [entrenar]',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;
        const sub = (args[0] || '').toLowerCase().trim();

        const u = rpgManager.getUserData(sender);

        if (!u.pet) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🐾 MASCOTA VIRTUAL 》 ❐',
                    '┃',
                    '┃├◆ Aún no tienes ninguna mascota adoptada.',
                    '┃├◆ 🏪 Visita la tienda de mascotas escribiendo: `.petshop`',
                    '┃├◆ 🐶 Podrás adoptar perros, gatos, zorros, lobos o dragones.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // 1. Alimentar (.pet feed)
        if (sub === 'feed' || sub === 'alimentar' || sub === 'comida') {
            const res = rpgManager.feedPet(sender);
            if (res.error === 'NO_FOOD_NO_COINS') {
                return await sock.sendMessage(jid, {
                    text: '❌ No tienes comida en tu inventario (pan/sopa) ni $150 monedas para comprar alimento básico.'
                }, { quoted: m });
            }

            await m.react?.('🍖');
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🍖 MASCOTA ALIMENTADA 》 ❐',
                    '┃',
                    `┃├◆ ¡Has alimentado a tu *${u.pet.name}* con ${res.fedWith}!`,
                    `┃├◆ 🍗 *Hambre:* ${u.pet.hambre}/100 (Satisfecho)`,
                    `┃├◆ ❤️ *Felicidad:* ${u.pet.felicidad}/100`,
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // 2. Entrenar (.pet train)
        if (sub === 'train' || sub === 'entrenar' || sub === 'practicar') {
            const res = rpgManager.trainPet(sender);
            if (res.error === 'PET_TIRED') {
                return await sock.sendMessage(jid, {
                    text: `⏳ Tu mascota está descansando del entrenamiento anterior.\n⏱️ Tiempo restante: *${res.timeLeft}*`
                }, { quoted: m });
            }
            if (res.error === 'LOW_ENERGY') {
                return await sock.sendMessage(jid, {
                    text: '⚠️ Tu mascota no tiene suficiente energía para entrenar. Aliméntala primero con `.pet feed`.'
                }, { quoted: m });
            }

            await m.react?.('⚡');
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 ⚡ ENTRENAMIENTO COMPLETADO 》 ❐',
                    '┃',
                    `┃├◆ ¡Tu *${res.pet.name}* completó su sesión de entrenamiento!`,
                    `┃├◆ 🔮 *EXP de Mascota:* ${res.pet.exp}/${res.pet.level * 300}`,
                    res.leveledUp ? `┃├◆ 🌟 *¡TU MASCOTA SUBIÓ AL NIVEL ${res.pet.level}!* 🎉` : '',
                    `┃├◆ 👤 *Bono de EXP para ti:* +100 EXP`,
                    res.ownerLeveledUp ? `┃├◆ 🌟 *¡TÚ SUBISTE AL NIVEL ${res.ownerLevel}!*` : '',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].filter(Boolean).join('\n')
            }, { quoted: m });
        }

        // 3. Estado de la mascota (.pet / .pet status)
        const pet = u.pet;
        const petMeta = rpgManager.PET_SPECIES[pet.id] || { hab: 'Compañero leal' };

        return await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 🐾 PERFIL DE TU MASCOTA 》 ❐',
                '┃',
                `┃├◆ ${pet.emoji} *Nombre:* ${pet.name}`,
                `┃├◆ 🐕 *Especie:* ${pet.species}`,
                `┃├◆ ⭐ *Nivel:* ${pet.level} (${pet.exp}/${pet.level * 300} EXP)`,
                '┃',
                `┃├◆ 🍗 *Hambre:* ${pet.hambre}/100`,
                `┃├◆ ⚡ *Energía:* ${pet.energia}/100`,
                `┃├◆ ❤️ *Felicidad:* ${pet.felicidad}/100`,
                `┃├◆ ✨ *Habilidad Pasiva:* ${petMeta.hab}`,
                '┃',
                '┃├◆ 🎮 *Acciones:*',
                '┃   👉 `.pet feed` (Alimentar)',
                '┃   👉 `.pet train` (Entrenar)',
                '┃   👉 `.breeding @tag` (Cruzar con otra mascota)',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n')
        }, { quoted: m });
    }
};

