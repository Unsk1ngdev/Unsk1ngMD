'use strict';

const economy = require('../../lib/economy');
const rpgManager = require('../../lib/rpgManager');

module.exports = [
    // ── 1. COMANDO HOURLY (CADA HORA) ──
    {
        name: 'hourly',
        alias: ['horario', 'bonohora', 'cadahora'],
        category: 'herramientas',
        desc: 'Reclama tu recompensa económica cada 60 minutos',
        usage: '.hourly',

        execute: async ({ sock, m }) => {
            const jid = m.chat || m.key.remoteJid;
            const sender = m.sender || m.key.participant || jid;

            const cd = rpgManager.checkCooldown(sender, 'hourly_reward', 60 * 60 * 1000);
            if (!cd.ready) {
                return await sock.sendMessage(jid, {
                    text: [
                        '⏳ *[RECOMPENSA HORARIA YA RECLAMADA]*',
                        '',
                        `Ya recogiste tu pago de esta hora, @${sender.split('@')[0]}.`,
                        `⏱️ Regresa en: *${cd.timeLeft}*`,
                        '',
                        '_Unknown Codexツ</>_'
                    ].join('\n'),
                    mentions: [sender]
                }, { quoted: m });
            }

            const coins = Math.floor(Math.random() * 801) + 700; // $700 - $1,500
            const exp = 60;

            economy.addCoins(sender, coins);
            const expRes = economy.addExp(sender, exp);

            await m.react?.('⏰');
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 ⏰ RECOMPENSA HORARIA COBRADA 》 ❐',
                    '┃',
                    `┃├◆ ¡Hola @${sender.split('@')[0]}!`,
                    `┃├◆ 💰 *Monedas ganadas:* +$${economy.formatNumber(coins)}`,
                    `┃├◆ 🔮 *Experiencia:* +${exp} EXP`,
                    expRes.leveledUp ? `┃├◆ 🌟 *¡SUBISTE AL NIVEL ${expRes.level}!*` : '',
                    '┃',
                    '┃├◆ 💡 Puedes volver a reclamar en 1 hora.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].filter(Boolean).join('\n'),
                mentions: [sender]
            }, { quoted: m });
        }
    },

    // ── 2. COMANDO WEEKLY (CADA 7 DÍAS) ──
    {
        name: 'weekly',
        alias: ['semanal', 'bonosemanal', 'semana'],
        category: 'herramientas',
        desc: 'Reclama tu gran paquete de bonificación semanal (cada 7 días)',
        usage: '.weekly',

        execute: async ({ sock, m }) => {
            const jid = m.chat || m.key.remoteJid;
            const sender = m.sender || m.key.participant || jid;

            const cd = rpgManager.checkCooldown(sender, 'weekly_reward', 7 * 24 * 60 * 60 * 1000);
            if (!cd.ready) {
                return await sock.sendMessage(jid, {
                    text: [
                        '⏳ *[BONO SEMANAL EN ESPERA]*',
                        '',
                        `Ya reclamaste el paquete de esta semana, @${sender.split('@')[0]}.`,
                        `⏱️ Tiempo restante: *${cd.timeLeft}*`,
                        '',
                        '_Unknown Codexツ</>_'
                    ].join('\n'),
                    mentions: [sender]
                }, { quoted: m });
            }

            const coins = Math.floor(Math.random() * 15001) + 20000; // $20,000 - $35,000
            const exp = 800;

            // Regalo de materiales de alto valor
            rpgManager.addItem(sender, 'diamante', 2);
            rpgManager.addItem(sender, 'oro', 3);
            rpgManager.addItem(sender, 'pocion_vida', 2);

            economy.addCoins(sender, coins);
            const expRes = economy.addExp(sender, exp);

            await m.react?.('👑');
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 👑 ¡GRAN PAQUETE SEMANAL RECLAMADO! 》 ❐',
                    '┃',
                    `┃├◆ ¡Felicidades por tu constancia, @${sender.split('@')[0]}!`,
                    `┃├◆ 💰 *Monedas recibidas:* +$${economy.formatNumber(coins)}`,
                    `┃├◆ 🔮 *Experiencia:* +${exp} EXP`,
                    '┃',
                    '┃├◆ 💎 *Cofre de materiales incluido:*',
                    '┃   • Diamante Puro x2',
                    '┃   • Lingote de Oro x3',
                    '┃   • Poción de Curación Mayor x2',
                    expRes.leveledUp ? `┃├◆ 🌟 *¡SUBISTE AL NIVEL ${expRes.level}!*` : '',
                    '┃',
                    '┃├◆ 💡 Regresa dentro de 7 días para tu próximo megapaquete.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].filter(Boolean).join('\n'),
                mentions: [sender]
            }, { quoted: m });
        }
    }
];

