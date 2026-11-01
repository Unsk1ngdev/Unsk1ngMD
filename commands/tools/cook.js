'use strict';

const rpgManager = require('../../lib/rpgManager');
const economy = require('../../lib/economy');

module.exports = {
    name: 'cook',
    alias: ['cooking', 'cocinar', 'cocina', 'receta'],
    category: 'rpg',
    desc: 'Cocina platos y alimentos combinando verduras, carnes y pescados',
    usage: '.cook [recetas] o .cook <plato>',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;
        const targetDish = (args[0] || '').toLowerCase().trim();

        if (!targetDish) {
            const cookRecipes = Object.values(rpgManager.RECETAS).filter(r => r.cat === 'cook');
            const listLines = cookRecipes.map(r => {
                const reqStr = Object.entries(r.req).map(([k, q]) => `${rpgManager.RPG_ITEMS[k]?.nombre || k} x${q}`).join(', ');
                return `┃ 🍲 *${r.id}:* ${r.name}\n┃    Ingredientes: ${reqStr}\n┃    EXP: +${r.result.exp} EXP\n┃`;
            });

            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🍳 COCINA DEL CHEF VIRTUAL 》 ❐',
                    '┃',
                    '┃├◆ 📜 *Menú de recetas para cocinar:*',
                    '┃',
                    ...listLines,
                    '┃├◆ 📋 *Uso:* `.cook <nombre_plato>`',
                    '┃├◆ 📌 *Ejemplo:* `.cook pan` o `.cook sopa`',
                    '┃├◆ 💡 Los alimentos cocinados sirven para alimentar',
                    '┃   a tus mascotas (`.pet feed`) y restaurar energía.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        const res = rpgManager.craftItem(sender, targetDish);
        if (res.error === 'RECIPE_NOT_FOUND' || (rpgManager.RECETAS[targetDish] && rpgManager.RECETAS[targetDish].cat !== 'cook')) {
            return await sock.sendMessage(jid, {
                text: `❌ El plato \`${targetDish}\` no está en el recetario.\nEscribe \`.cook\` para ver las recetas culinarias.`
            }, { quoted: m });
        }

        if (res.error === 'MISSING_MATERIALS') {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 ⚠️ TE FALTAN INGREDIENTES 》 ❐',
                    '┃',
                    `┃├◆ Para cocinar *${targetDish}* necesitas:`,
                    `┃   ❌ ${res.missing}: tienes ${res.has}/${res.needed}`,
                    '┃',
                    '┃├◆ 💡 Consigue trigo y verduras con `.garden`,',
                    '┃   pescados con `.fishing` y carnes con `.hunting`.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        await m.react?.('🍳');
        return await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 🍲 ¡PLATO COCINADO CON ÉXITO! 》 ❐',
                '┃',
                `┃├◆ 👨‍🍳 *Cocinero:* @${sender.split('@')[0]}`,
                `┃├◆ 🍱 *Has preparado:* ${res.crafted.nombre} x${res.cant}`,
                `┃├◆ 🔮 *Experiencia:* +${res.exp} EXP`,
                res.leveledUp ? `┃├◆ 🌟 *¡SUBISTE AL NIVEL ${res.newLevel}!*` : '',
                '┃',
                '┃├◆ 🐶 Úsalo para alimentar a tu mascota con `.pet feed`',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].filter(Boolean).join('\n'),
            mentions: [sender]
        }, { quoted: m });
    }
};

