'use strict';

const rpgManager = require('../../lib/rpgManager');
const economy = require('../../lib/economy');

module.exports = {
    name: 'lottery',
    alias: ['loteria', 'rifa', 'sorteogrupal', 'lotto'],
    category: 'juegos',
    desc: 'Sistema de lotería grupal con pozo acumulado en tiempo real',
    usage: '.lottery [ver] | .lottery buy <boletos> | .lottery draw [sortear]',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;
        const sub = (args[0] || '').toLowerCase().trim();

        // 1. Comprar boletos (.lottery buy <cantidad>)
        if (sub === 'buy' || sub === 'comprar' || sub === 'boleto') {
            const count = Math.max(1, parseInt(args[1], 10) || 1);
            const res = rpgManager.buyLotteryTicket(jid, sender, count);

            if (res.error === 'NO_MONEY') {
                return await sock.sendMessage(jid, {
                    text: `❌ No tienes suficientes monedas para comprar ${count} boletos ($${economy.formatNumber(res.needed)} requeridas).\nTu saldo en mano: $${economy.formatNumber(res.has)}`
                }, { quoted: m });
            }

            await m.react?.('🎟️');
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🎟️ BOLETOS DE LOTERÍA COMPRADOS 》 ❐',
                    '┃',
                    `┃├◆ 👤 *Comprador:* @${sender.split('@')[0]}`,
                    `┃├◆ 🎫 *Boletos adquiridos:* +${res.ticketsBought}`,
                    `┃├◆ 📊 *Tus boletos totales:* ${res.totalUserTickets}`,
                    `┃├◆ 💰 *Pozo acumulado total:* $${economy.formatNumber(res.pozo)} monedas`,
                    '┃',
                    '┃├◆ 💡 Escribe `.lottery draw` para realizar el sorteo.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n'),
                mentions: [sender]
            }, { quoted: m });
        }

        // 2. Realizar sorteo (.lottery draw)
        if (sub === 'draw' || sub === 'sortear' || sub === 'jugar' || sub === 'girar') {
            const res = rpgManager.drawLottery(jid);

            if (res.error === 'NO_PARTICIPANTS') {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No hay boletos comprados aún para la lotería.\nCompra boletos primero con `.lottery buy 1` ($500 por boleto).'
                }, { quoted: m });
            }

            await m.react?.('🎉');
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🎰 ¡SORTEO DE LA LOTERÍA GRUPAL! 》 ❐',
                    '┃',
                    '┃├◆ 🎲 Girando la tómbola entre todos los boletos...',
                    '┃',
                    `┃├◆ 👑 *¡Y EL GANADOR SUPREMO ES:* @${res.winnerJid.split('@')[0]}!`,
                    `┃├◆ 💰 *Premio del pozo acumulado:* $${economy.formatNumber(res.prize)} monedas`,
                    `┃├◆ 🎟️ *Boletos totales en juego:* ${res.totalTickets}`,
                    `┃├◆ 🔮 *Bono de Experiencia:* +300 EXP`,
                    res.leveledUp ? `┃├◆ 🌟 *¡EL GANADOR SUBIÓ AL NIVEL ${res.newLevel}!*` : '',
                    '┃',
                    '┃├◆ 🔄 El pozo se reinicia a $5,000 monedas para el próximo sorteo.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].filter(Boolean).join('\n'),
                mentions: [res.winnerJid]
            }, { quoted: m });
        }

        // 3. Ver estado de la lotería
        const lot = rpgManager.getLottery(jid);
        const userTickets = lot.tickets[sender] || 0;
        const totalTickets = Object.values(lot.tickets).reduce((a, b) => a + b, 0);

        return await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 🎰 LOTERÍA DEL GRUPO 》 ❐',
                '┃',
                `┃├◆ 💰 *Pozo acumulado actual:* $${economy.formatNumber(lot.pozo)} monedas`,
                `┃├◆ 🎟️ *Precio por boleto:* $${economy.formatNumber(lot.ticketPrice)} monedas`,
                `┃├◆ 👥 *Participantes activos:* ${Object.keys(lot.tickets).length}`,
                `┃├◆ 🎫 *Boletos en juego:* ${totalTickets}`,
                `┃├◆ 👤 *Tus boletos comprados:* ${userTickets}`,
                '┃',
                lot.lastWinner ? `┃├◆ 🏆 *Último ganador:* @${lot.lastWinner.jid.split('@')[0]} ($${economy.formatNumber(lot.lastWinner.prize)})` : '',
                '┃',
                '┃├◆ 🎮 *Acciones:*',
                '┃   👉 `.lottery buy 1` (Comprar 1 boleto)',
                '┃   👉 `.lottery buy 5` (Comprar 5 boletos)',
                '┃   👉 `.lottery draw` (Efectuar el sorteo)',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].filter(Boolean).join('\n'),
            mentions: lot.lastWinner ? [lot.lastWinner.jid] : []
        }, { quoted: m });
    }
};

