'use strict';

const rpgManager = require('../../lib/rpgManager');
const economy = require('../../lib/economy');

module.exports = {
    name: 'gift',
    alias: ['regalar', 'donar', 'enviaritem', 'regalo'],
    category: 'rpg',
    desc: 'Regala ítems o materiales de tu inventario (o monedas) a otro usuario del grupo',
    usage: '.gift <ítem|monedas> <cantidad> @usuario',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        // Resolver target
        let targetJid = null;
        if (m.mentionedJid && m.mentionedJid.length > 0) {
            targetJid = m.mentionedJid[0];
        } else if (m.quoted) {
            targetJid = m.quoted.sender || m.quoted.participant;
        }

        if (!targetJid || args.length < 2) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🎁 REGALAR ÍTEMS O MONEDAS 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* `.gift <ítem|monedas> <cantidad> @usuario`',
                    '┃├◆ 📌 *Ejemplo 1:* `.gift diamante 1 @amigo`',
                    '┃├◆ 📌 *Ejemplo 2:* `.gift pan 3 @amigo`',
                    '┃├◆ 📌 *Ejemplo 3:* `.gift monedas 5000 @amigo`',
                    '┃',
                    '┃├◆ 💡 Puedes consultar lo que tienes con `.craft` o `.rango`.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        if (targetJid === sender) {
            return await sock.sendMessage(jid, {
                text: '😂 No puedes regalarte ítems a ti mismo.'
            }, { quoted: m });
        }

        const itemArg = (args[0] || '').toLowerCase().trim();
        const count = Math.max(1, parseInt(args[1], 10) || 1);

        // Caso especial: Regalar monedas
        if (['monedas', 'coins', 'plata', 'dinero', 'oro'].includes(itemArg)) {
            const senderEco = economy.getUser(sender);
            if ((senderEco.monedas || 0) < count) {
                return await sock.sendMessage(jid, {
                    text: `❌ No tienes suficientes monedas. Tu saldo en mano: $${economy.formatNumber(senderEco.monedas || 0)}`
                }, { quoted: m });
            }

            economy.removeCoins(sender, count);
            economy.addCoins(targetJid, count);

            await m.react?.('🎁');
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🎁 ¡REGALO DE MONEDAS ENTREGADO! 》 ❐',
                    '┃',
                    `┃├◆ @${sender.split('@')[0]} le ha regalado:`,
                    `┃   💰 *$${economy.formatNumber(count)} monedas* a @${targetJid.split('@')[0]}`,
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n'),
                mentions: [sender, targetJid]
            }, { quoted: m });
        }

        // Regalar ítems del inventario RPG
        const userHas = rpgManager.getItemCount(sender, itemArg);
        if (userHas < count) {
            const itemMeta = rpgManager.RPG_ITEMS[itemArg] || { nombre: itemArg };
            return await sock.sendMessage(jid, {
                text: `❌ No tienes suficientes ${itemMeta.nombre} en tu inventario (tienes ${userHas}/${count}).`
            }, { quoted: m });
        }

        rpgManager.removeItem(sender, itemArg, count);
        rpgManager.addItem(targetJid, itemArg, count);

        const itemMeta = rpgManager.RPG_ITEMS[itemArg] || { nombre: itemArg };
        await m.react?.('🎁');

        return await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 🎁 ¡REGALO ENTREGADO CON ÉXITO! 》 ❐',
                '┃',
                `┃├◆ 👤 *Remitente:* @${sender.split('@')[0]}`,
                `┃├◆ 🎯 *Destinatario:* @${targetJid.split('@')[0]}`,
                `┃├◆ 📦 *Regalo:* ${itemMeta.nombre} x${count}`,
                '┃',
                '┃├◆ 🎒 El ítem ha sido transferido directamente a su inventario.',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n'),
            mentions: [sender, targetJid]
        }, { quoted: m });
    }
};

