'use strict';

const rpgManager = require('../../lib/rpgManager');
const economy = require('../../lib/economy');

module.exports = {
    name: 'craft',
    alias: ['craftear', 'fabricar', 'artesania'],
    category: 'rpg',
    desc: 'Fabrica objetos y herramientas combinando materiales de tu inventario',
    usage: '.craft [ver recetas] o .craft <ítem>',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;
        const targetItem = (args[0] || '').toLowerCase().trim();

        if (!targetItem) {
            const recipes = Object.values(rpgManager.RECETAS);
            const listLines = recipes.map(r => {
                const reqStr = Object.entries(r.req).map(([k, q]) => `${rpgManager.RPG_ITEMS[k]?.nombre || k} x${q}`).join(', ');
                return `┃ 🔨 *${r.id}:* ${r.name}\n┃    📦 Requiere: ${reqStr}\n┃    🔮 Da: +${r.result.exp} EXP\n┃`;
            });

            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🛠️ TALLER DE CRAFTEO Y ARTESANÍA 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Recetas disponibles:*',
                    '┃',
                    ...listLines,
                    '┃├◆ 💡 *Uso:* `.craft <id_receta>`',
                    '┃├◆ 📌 *Ejemplo:* `.craft pan` o `.craft espada_hierro`',
                    '┃├◆ 📌 *Comandos especializados:*',
                    '┃   👉 `.cook` (Cocina)',
                    '┃   👉 `.alchemy` (Pociones)',
                    '┃   👉 `.blacksmith` (Forja)',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        const res = rpgManager.craftItem(sender, targetItem);
        if (res.error === 'RECIPE_NOT_FOUND') {
            return await sock.sendMessage(jid, {
                text: `❌ La receta \`${targetItem}\` no existe.\nEscribe \`.craft\` para ver la lista de recetas disponibles.`
            }, { quoted: m });
        }

        if (res.error === 'MISSING_MATERIALS') {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 ⚠️ MATERIALES INSUFICIENTES 》 ❐',
                    '┃',
                    `┃├◆ Te faltan materiales para fabricar *${targetItem}*:`,
                    `┃   ❌ ${res.missing}: tienes ${res.has}/${res.needed}`,
                    '┃',
                    '┃├◆ 💡 Consigue materiales con:',
                    '┃   ⛏️ `.mining` (Minerales)',
                    '┃   🪓 `.woodcut` (Maderas)',
                    '┃   🎣 `.fishing` (Peces)',
                    '┃   🏹 `.hunting` (Caza)',
                    '┃   🏡 `.garden` (Cultivos)',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        await m.react?.('🔨');
        return await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 ✨ ¡OBJETO FABRICADO CON ÉXITO! 》 ❐',
                '┃',
                `┃├◆ 👤 *Artesano:* @${sender.split('@')[0]}`,
                `┃├◆ 📦 *Has obtenido:* ${res.crafted.nombre} x${res.cant}`,
                `┃├◆ 🔮 *Experiencia:* +${res.exp} EXP`,
                res.leveledUp ? `┃├◆ 🌟 *¡SUBISTE AL NIVEL ${res.newLevel}!*` : '',
                '┃',
                '┃├◆ 🎒 Guardado en tu inventario.',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].filter(Boolean).join('\n'),
            mentions: [sender]
        }, { quoted: m });
    }
};

