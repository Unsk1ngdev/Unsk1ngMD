'use strict';

const rpgManager = require('../../lib/rpgManager');
const economy = require('../../lib/economy');

module.exports = {
    name: 'garden',
    alias: ['huerto', 'granja', 'plantar', 'cosechar'],
    category: 'rpg',
    desc: 'Siembra y cosecha cultivos en tiempo real en tu huerto virtual',
    usage: '.garden [ver] | .garden plant <semilla> | .garden harvest [cosechar]',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;
        const sub = (args[0] || '').toLowerCase().trim();

        // 1. Plantar (.garden plant <semilla>)
        if (sub === 'plant' || sub === 'plantar' || sub === 'sembrar') {
            let seedArg = (args[1] || '').toLowerCase().trim();
            if (seedArg && !seedArg.startsWith('semilla_')) {
                seedArg = 'semilla_' + seedArg;
            }

            if (!seedArg || !rpgManager.RPG_ITEMS[seedArg]) {
                return await sock.sendMessage(jid, {
                    text: [
                        '┏❐ 《 🌱 SEMILLAS DISPONIBLES 》 ❐',
                        '┃',
                        '┃├◆ 🌾 `trigo` (3 minutos de crecimiento)',
                        '┃├◆ 🍅 `tomate` (8 minutos de crecimiento)',
                        '┃├◆ 🥕 `zanahoria` (15 minutos de crecimiento)',
                        '┃├◆ 🍏 `manzana_dorada` (30 minutos de crecimiento)',
                        '┃',
                        '┃├◆ 📋 *Uso:* `.garden plant <semilla>`',
                        '┃├◆ 📌 *Ejemplo:* `.garden plant trigo`',
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                }, { quoted: m });
            }

            const res = rpgManager.plantCrop(sender, seedArg);
            if (res.error === 'NO_SEEDS') {
                return await sock.sendMessage(jid, {
                    text: `❌ No tienes ${rpgManager.RPG_ITEMS[seedArg].nombre} en tu inventario.\n💡 Puedes obtener semillas en expediciones, misiones o pesca.`
                }, { quoted: m });
            }
            if (res.error === 'GARDEN_FULL') {
                return await sock.sendMessage(jid, {
                    text: '⚠️ Tu huerto está lleno (máximo 4 parcelas). Cosecha primero con `.garden harvest`.'
                }, { quoted: m });
            }

            await m.react?.('🌱');
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🌱 CULTIVO SEMBRADO CON ÉXITO 》 ❐',
                    '┃',
                    `┃├◆ Sembraste: ${res.seedMeta.nombre}`,
                    `┃├◆ ⏱️ Tiempo para madurar: *${Math.floor(res.seedMeta.tiempoMs / 60000)} minutos*`,
                    '┃├◆ 💡 Consulta el estado en cualquier momento con `.garden`',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // 2. Cosechar (.garden harvest / .garden cosechar)
        if (sub === 'harvest' || sub === 'cosechar' || sub === 'recolectar') {
            const res = rpgManager.harvestGarden(sender);
            if (res.error === 'EMPTY_GARDEN') {
                return await sock.sendMessage(jid, {
                    text: '⚠️ Tu huerto está vacío. Siembra semillas primero con `.garden plant trigo`.'
                }, { quoted: m });
            }
            if (res.error === 'NOT_READY_YET') {
                return await sock.sendMessage(jid, {
                    text: '⏳ Tus cultivos aún están madurando. Escribe `.garden` para ver el tiempo restante.'
                }, { quoted: m });
            }

            await m.react?.('🌾');
            const lines = res.harvested.map(h => `┃  • ${h.crop.nombre} x${h.count}`);

            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🌾 ¡COSECHA COMPLETADA! 》 ❐',
                    '┃',
                    '┃├◆ 🧺 *Productos recolectados:*',
                    ...lines,
                    '┃',
                    `┃├◆ 💰 *Ganancias:* +$${economy.formatNumber(res.coinsEarned)} monedas`,
                    `┃├◆ 🔮 *Experiencia:* +${res.expEarned} EXP`,
                    res.leveledUp ? `┃├◆ 🌟 *¡SUBISTE AL NIVEL ${res.newLevel}!*` : '',
                    '┃',
                    '┃├◆ 🍲 Úsalos en la cocina con `.cook` o cocínalos en banquetes.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].filter(Boolean).join('\n')
            }, { quoted: m });
        }

        // 3. Ver estado del huerto (.garden)
        const plots = rpgManager.getGardenStatus(sender);
        const invSeeds = rpgManager.getInventoryList(sender).filter(i => i.tipo === 'semilla');

        const plotLines = plots.length > 0
            ? plots.map(p => `┃ 🌿 *Parcela ${p.idx}:* ${p.name}\n┃    ⏱️ ${p.timeLeft}`)
            : ['┃ ℹ️ No tienes cultivos plantados actualmente.'];

        const seedsText = invSeeds.length > 0
            ? invSeeds.map(s => `${s.nombre} (x${s.cantidad})`).join(', ')
            : 'Sin semillas en inventario';

        return await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 🏡 TU HUERTO EN TIEMPO REAL 》 ❐',
                '┃',
                `┃├◆ 👤 *Granjero:* @${sender.split('@')[0]}`,
                '┃',
                ...plotLines,
                '┃',
                `┃├◆ 🎒 *Semillas en mochila:* ${seedsText}`,
                '┃',
                '┃├◆ 🎮 *Acciones:*',
                '┃   👉 `.garden plant trigo` (Sembrar)',
                '┃   👉 `.garden harvest` (Cosechar lo que esté listo)',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n'),
            mentions: [sender]
        }, { quoted: m });
    }
};

