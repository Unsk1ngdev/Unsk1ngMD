'use strict';

const economy = require('../../lib/economy');
const userNames = require('../../lib/userNames');

// Almacenamiento en memoria de eventos de lluvia activos por chatId
global.lluviasChat = global.lluviasChat || new Map();

module.exports = [
    {
        name: 'lluvia',
        alias: ['drop', 'lluviamonedas', 'soltar'],
        category: 'juegos',
        desc: 'Lanza una cantidad de monedas al chat para que el primero en recogerlas se las quede',
        usage: '.lluvia <monto>',
        groupOnly: true,

        execute: async ({ sock, m, args }) => {
            const chatId = m.chat || m.key.remoteJid;
            const sender = m.sender;

            if (global.lluviasChat.has(chatId)) {
                const actual = global.lluviasChat.get(chatId);
                return await sock.sendMessage(chatId, {
                    text: `⚠️ *Ya hay una lluvia activa en el chat!*\n` +
                          `Hay un fajo de *$${economy.formatNumber(actual.monto)} monedas* esperando.\n` +
                          `👉 ¡Escribe *.agarrar* para reclamarlo!`
                }, { quoted: m });
            }

            if (!args[0]) {
                return await sock.sendMessage(chatId, {
                    text: '⚠️ Debes indicar cuántas monedas deseas lanzar al chat.\n\n' +
                          '👉 *Ejemplo:* `.lluvia 1500` (mínimo $300)'
                }, { quoted: m });
            }

            const monto = parseInt(args[0], 10);
            if (isNaN(monto) || monto < 300) {
                return await sock.sendMessage(chatId, {
                    text: '❌ El monto mínimo para lanzar una lluvia es de *$300 monedas*.'
                }, { quoted: m });
            }

            const user = economy.getUser(sender);
            const totalFondos = (user.monedas || 0) + (user.banco || 0);

            if (totalFondos < monto) {
                return await sock.sendMessage(chatId, {
                    text: `❌ Fondos insuficientes. Quieres lanzar *$${economy.formatNumber(monto)}* pero tienes un total de *$${economy.formatNumber(totalFondos)}*.`
                }, { quoted: m });
            }

            // Descontar del emisor (mano primero, luego banco)
            let restante = monto;
            if (user.monedas >= restante) {
                user.monedas -= restante;
                restante = 0;
            } else {
                restante -= user.monedas;
                user.monedas = 0;
                user.banco -= restante;
            }
            economy.save();

            // Configurar temporizador de 90 segundos para devolver dinero si nadie lo recoge
            const timeout = setTimeout(async () => {
                if (global.lluviasChat.has(chatId)) {
                    global.lluviasChat.delete(chatId);
                    user.banco = (user.banco || 0) + monto;
                    economy.save();
                    try {
                        await sock.sendMessage(chatId, {
                            text: `⏰ *Lluvia expirada:* Nadie recogió las *$${economy.formatNumber(monto)} monedas*. Han sido devueltas al banco de @${sender.split('@')[0]}.`,
                            mentions: [sender]
                        });
                    } catch (_) {}
                }
            }, 90000);

            global.lluviasChat.set(chatId, {
                monto,
                emisor: sender,
                timeout,
                iniciado: Date.now()
            });

            const senderName = (userNames && typeof userNames.get === 'function')
                ? userNames.get(sender)
                : null;
            const senderTag = senderName ? `*${senderName}* (@${sender.split('@')[0]})` : `@${sender.split('@')[0]}`;

            await sock.sendMessage(chatId, {
                text: `💸 *¡LLUVIA DE MONEDAS EN EL CHAT!* 💸\n\n` +
                      `👑 ${senderTag} ha soltado un fajo de *$${economy.formatNumber(monto)} monedas* en el grupo.\n\n` +
                      `⚡ *¡El primero en escribir .agarrar se lo queda todo!* 🏃‍♂️💨\n` +
                      `⏳ Tienes 90 segundos antes de que expire.`,
                mentions: [sender]
            }, { quoted: m });
        }
    },
    {
        name: 'agarrar',
        alias: ['recoger', 'claimmoney', 'tomar', 'pillar'],
        category: 'juegos',
        desc: 'Recoge las monedas soltadas durante una lluvia en el chat',
        usage: '.agarrar',
        groupOnly: true,

        execute: async ({ sock, m }) => {
            const chatId = m.chat || m.key.remoteJid;
            const sender = m.sender;

            if (!global.lluviasChat.has(chatId)) {
                return await sock.sendMessage(chatId, {
                    text: '💨 *¡Muy tarde o no hay monedas en el suelo!*\nNo hay ninguna lluvia de monedas activa ahora mismo.'
                }, { quoted: m });
            }

            const evento = global.lluviasChat.get(chatId);
            clearTimeout(evento.timeout);
            global.lluviasChat.delete(chatId);

            // Acreditar directo al banco del afortunado
            const receptor = economy.getUser(sender);
            receptor.banco = (receptor.banco || 0) + evento.monto;
            economy.addExp(sender, 50);
            economy.save();

            const receptorName = (userNames && typeof userNames.get === 'function')
                ? userNames.get(sender)
                : null;
            const receptorTag = receptorName ? `*${receptorName}* (@${sender.split('@')[0]})` : `@${sender.split('@')[0]}`;

            await sock.sendMessage(chatId, {
                text: `🎉 *¡MONEDAS RECLAMADAS!* 💰\n\n` +
                      `⚡ ${receptorTag} tuvo los mejores reflejos y se llevó el botín:\n` +
                      `💵 *$${economy.formatNumber(evento.monto)} monedas* depositadas directo a su banco.\n` +
                      `✨ +50 EXP por rapidez.\n\n` +
                      `_¡Gracias al donador @${evento.emisor.split('@')[0]} por la lluvia!_`,
                mentions: [sender, evento.emisor]
            }, { quoted: m });
        }
    }
];

