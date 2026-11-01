'use strict';

const rpgManager = require('../../lib/rpgManager');
const economy = require('../../lib/economy');

module.exports = {
    name: 'blacksmith',
    alias: ['herrero', 'herreria', 'forja', 'forjar'],
    category: 'rpg',
    desc: 'Forja espadas, armaduras y escudos legendarios con minerales y maderas (aumenta ATQ y DEF permanentemente)',
    usage: '.blacksmith [equipo] o .blacksmith <id_equipo>',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;
        const targetEquip = (args[0] || '').toLowerCase().trim();

        if (!targetEquip) {
            const smithRecipes = Object.values(rpgManager.RECETAS).filter(r => r.cat === 'blacksmith');
            const listLines = smithRecipes.map(r => {
                const reqStr = Object.entries(r.req).map(([k, q]) => `${rpgManager.RPG_ITEMS[k]?.nombre || k} x${q}`).join(', ');
                const meta = rpgManager.RPG_ITEMS[r.id];
                const bonus = meta.bonusAtq ? `+${meta.bonusAtq} ATQ` : `+${meta.bonusDef} DEF`;
                return `┃ 🛡️ *${r.id}:* ${r.name}\n┃    Materiales: ${reqStr}\n┃    Bonificación permanente: ${bonus} | EXP: +${r.result.exp}\n┃`;
            });

            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 ⚒️ HERRERÍA Y FORJA DE ARMAS 》 ❐',
                    '┃',
                    '┃├◆ 📜 *Planos de forja disponibles:*',
                    '┃',
                    ...listLines,
                    '┃├◆ 📋 *Uso:* `.blacksmith <id_equipo>`',
                    '┃├◆ 📌 *Ejemplo:* `.blacksmith espada_hierro`',
                    '┃├◆ 💡 Cada arma o armadura forjada aumenta permanentemente',
                    '┃   tus estadísticas de Ataque y Defensa para duelos y mazmorras.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        const res = rpgManager.craftItem(sender, targetEquip);
        if (res.error === 'RECIPE_NOT_FOUND' || (rpgManager.RECETAS[targetEquip] && rpgManager.RECETAS[targetEquip].cat !== 'blacksmith')) {
            return await sock.sendMessage(jid, {
                text: `❌ El equipo \`${targetEquip}\` no está en los planos de la forja.\nEscribe \`.blacksmith\` para ver las armas y armaduras disponibles.`
            }, { quoted: m });
        }

        if (res.error === 'MISSING_MATERIALS') {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 ⚠️ MINERALES O MADERA INSUFICIENTES 》 ❐',
                    '┃',
                    `┃├◆ Para forjar *${targetEquip}* necesitas:`,
                    `┃   ❌ ${res.missing}: tienes ${res.has}/${res.needed}`,
                    '┃',
                    '┃├◆ 💡 Consigue lingotes en `.mining` y maderas en `.woodcut`.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        const ecoUser = economy.getUser(sender);
        await m.react?.('⚒️');

        return await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 ⚔️ ¡EQUIPO FORJADO CON ÉXITO! 》 ❐',
                '┃',
                `┃├◆ ⚒️ *Herrero:* @${sender.split('@')[0]}`,
                `┃├◆ 🛡️ *Has forjado:* ${res.crafted.nombre}`,
                res.crafted.bonusAtq ? `┃├◆ 💥 *Aumento permanente de Ataque:* +${res.crafted.bonusAtq} ATQ (Total: ${ecoUser.ataque})` : '',
                res.crafted.bonusDef ? `┃├◆ 🛡️ *Aumento permanente de Defensa:* +${res.crafted.bonusDef} DEF (Total: ${ecoUser.defensa})` : '',
                `┃├◆ 🔮 *Experiencia:* +${res.exp} EXP`,
                res.leveledUp ? `┃├◆ 🌟 *¡SUBISTE AL NIVEL ${res.newLevel}!*` : '',
                '┃',
                '┃├◆ ⚔️ ¡Estás mucho más preparado para `.dungeon` y duelos!',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].filter(Boolean).join('\n'),
            mentions: [sender]
        }, { quoted: m });
    }
};

