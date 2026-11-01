'use strict';

const rpgManager = require('../../lib/rpgManager');
const economy = require('../../lib/economy');

module.exports = {
    name: 'petshop',
    alias: ['tiendamascotas', 'mascotashop', 'comprarmascota'],
    category: 'rpg',
    desc: 'Tienda de adopción de mascotas mágicas (gato, perro, zorro, lobo, dragón, fénix)',
    usage: '.petshop [ver catálogo] o .petshop comprar <especie> [nombre]',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;
        const sub = (args[0] || '').toLowerCase().trim();

        if (sub === 'comprar' || sub === 'buy' || sub === 'adoptar') {
            const speciesId = (args[1] || '').toLowerCase().trim();
            const petName = args.slice(2).join(' ').trim();

            if (!speciesId || !rpgManager.PET_SPECIES[speciesId]) {
                return await sock.sendMessage(jid, {
                    text: '❌ Debes especificar una especie válida.\n📌 Ejemplo: `.petshop comprar dragon Ignis`'
                }, { quoted: m });
            }

            const res = rpgManager.buyPet(sender, speciesId, petName);

            if (res.error === 'ALREADY_HAVE_PET') {
                return await sock.sendMessage(jid, {
                    text: '⚠️ Ya tienes una mascota adoptada. Cuida de ella con `.pet`.'
                }, { quoted: m });
            }

            if (res.error === 'NO_MONEY') {
                return await sock.sendMessage(jid, {
                    text: `❌ Monedas insuficientes. Necesitas $${economy.formatNumber(res.needed)}, pero tienes $${economy.formatNumber(res.has)}.`
                }, { quoted: m });
            }

            await m.react?.('🎉');
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🐾 ¡NUEVA MASCOTA ADOPTADA! 》 ❐',
                    '┃',
                    `┃├◆ ¡Felicidades @${sender.split('@')[0]}!`,
                    `┃├◆ ${res.pet.emoji} *Nombre:* ${res.pet.name}`,
                    `┃├◆ 🐕 *Especie:* ${res.pet.species}`,
                    `┃├◆ ⭐ *Nivel inicial:* ${res.pet.level}`,
                    '┃',
                    '┃├◆ 💡 Consulta y cuida a tu nuevo compañero con: `.pet`',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n'),
                mentions: [sender]
            }, { quoted: m });
        }

        // Catálogo de la tienda
        const speciesList = Object.values(rpgManager.PET_SPECIES).map(s => {
            return `┃ ${s.emoji} *${s.id}:* ${s.nombre}\n┃    💰 Precio: $${economy.formatNumber(s.precio)} monedas\n┃    ✨ Habilidad: ${s.hab}\n┃`;
        });

        return await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 🏪 TIENDA OFICIAL DE MASCOTAS 》 ❐',
                '┃',
                '┃├◆ 🐾 *Mascotas disponibles para adopción:*',
                '┃',
                ...speciesList,
                '┃├◆ 📋 *Uso:* `.petshop comprar <especie> [nombre]`',
                '┃├◆ 📌 *Ejemplo 1:* `.petshop comprar gato Michi`',
                '┃├◆ 📌 *Ejemplo 2:* `.petshop comprar dragon Shenlong`',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n')
        }, { quoted: m });
    }
};

