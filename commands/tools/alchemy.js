'use strict';

const rpgManager = require('../../lib/rpgManager');
const economy = require('../../lib/economy');

module.exports = {
    name: 'alchemy',
    alias: ['alquimia', 'pocion', 'pociones', 'poción', 'brew'],
    category: 'rpg',
    desc: 'Elabora pociones místicas y elixires mágicos (curación, maná, suerte, exp)',
    usage: '.alchemy [pociones] o .alchemy <id_pocion>',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;
        const targetPotion = (args[0] || '').toLowerCase().trim();

        if (!targetPotion) {
            const alchemyRecipes = Object.values(rpgManager.RECETAS).filter(r => r.cat === 'alchemy');
            const listLines = alchemyRecipes.map(r => {
                const reqStr = Object.entries(r.req).map(([k, q]) => `${rpgManager.RPG_ITEMS[k]?.nombre || k} x${q}`).join(', ');
                return `┃ 🧪 *${r.id}:* ${r.name}\n┃    Ingredientes: ${reqStr}\n┃    EXP: +${r.result.exp} EXP\n┃`;
            });

            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🔮 LABORATORIO DE ALQUIMIA 》 ❐',
                    '┃',
                    '┃├◆ 📜 *Fórmulas y pociones disponibles:*',
                    '┃',
                    ...listLines,
                    '┃├◆ 📋 *Uso:* `.alchemy <id_pocion>`',
                    '┃├◆ 📌 *Ejemplo:* `.alchemy pocion_vida`',
                    '┃├◆ 💡 *Uso en combate:* Las pociones de curación se usan',
                    '┃   en `.dungeon pocion` para recuperar vida en la mazmorra.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        const res = rpgManager.craftItem(sender, targetPotion);
        if (res.error === 'RECIPE_NOT_FOUND' || (rpgManager.RECETAS[targetPotion] && rpgManager.RECETAS[targetPotion].cat !== 'alchemy')) {
            return await sock.sendMessage(jid, {
                text: `❌ La poción \`${targetPotion}\` no existe.\nEscribe \`.alchemy\` para ver las fórmulas disponibles.`
            }, { quoted: m });
        }

        if (res.error === 'MISSING_MATERIALS') {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 ⚠️ INGREDIENTES INSUFICIENTES 》 ❐',
                    '┃',
                    `┃├◆ Te faltan componentes para destilar *${targetPotion}*:`,
                    `┃   ❌ ${res.missing}: tienes ${res.has}/${res.needed}`,
                    '┃',
                    '┃├◆ 💡 Reúne ingredientes con minería, huerto y pesca.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        await m.react?.('🧪');
        return await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 ✨ ¡POCIÓN DESTILADA CON ÉXITO! 》 ❐',
                '┃',
                `┃├◆ 🧙‍♂️ *Alquimista:* @${sender.split('@')[0]}`,
                `┃├◆ 🧪 *Has creado:* ${res.crafted.nombre} x${res.cant}`,
                `┃├◆ 🔮 *Experiencia:* +${res.exp} EXP`,
                res.leveledUp ? `┃├◆ 🌟 *¡SUBISTE AL NIVEL ${res.newLevel}!*` : '',
                '┃',
                '┃├◆ 🎒 Guardada en tu inventario.',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].filter(Boolean).join('\n'),
            mentions: [sender]
        }, { quoted: m });
    }
};

