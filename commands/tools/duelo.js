'use strict';

const economy = require('../../lib/economy');
const userNames = require('../../lib/userNames');

module.exports = {
    name: 'duelo',
    alias: ['pvp', 'batalla', 'pelea'],
    category: 'juegos',
    desc: 'Combate anime RPG con tus estadísticas de ataque, defensa, nivel y apuesta opcional',
    usage: '.duelo @usuario [apuesta opcional]',
    groupOnly: true,

    execute: async ({ sock, m, args }) => {
        const chatId = m.chat || m.key.remoteJid;
        const sender = m.sender;
        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        let retado = mentioned[0] || m.message?.extendedTextMessage?.contextInfo?.participant;

        let betArg = null;
        for (const a of args) {
            const num = parseInt(a, 10);
            if (!isNaN(num) && num > 0 && !a.startsWith('@')) {
                betArg = num;
                break;
            }
        }

        if (!retado && args[0]) {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw.length >= 7) {
                retado = `${raw}@s.whatsapp.net`;
            }
        }

        if (!retado) {
            return await sock.sendMessage(chatId, {
                text: '⚔️ *¡Desafío de Combate RPG!* ⚔️\n\n' +
                      'Menciona a tu contrincante para iniciar el duelo.\n' +
                      '👉 *Ejemplo:* `.duelo @usuario` o con apuesta `.duelo @usuario 1000`\n\n' +
                      '_Tus espadas, escudos, nivel y rango de .tienda aumentan tu poder de combate._'
            }, { quoted: m });
        }

        const senderClean = sender.replace(/:\d+/, '');
        const retadoClean = retado.replace(/:\d+/, '');

        if (retadoClean === senderClean) {
            return await sock.sendMessage(chatId, {
                text: '❌ No puedes retarte a ti mismo en duelo.'
            }, { quoted: m });
        }

        const user1 = economy.getUser(sender);
        const user2 = economy.getUser(retado);

        // Validación de apuesta si se especificó
        let apuestaMonto = 0;
        if (betArg && betArg >= 100) {
            apuestaMonto = betArg;
            const fondos1 = (user1.monedas || 0) + (user1.banco || 0);
            const fondos2 = (user2.monedas || 0) + (user2.banco || 0);

            if (fondos1 < apuestaMonto) {
                return await sock.sendMessage(chatId, {
                    text: `❌ No tienes suficientes fondos para apostar *$${economy.formatNumber(apuestaMonto)}*. Tu saldo total es *$${economy.formatNumber(fondos1)}*.`
                }, { quoted: m });
            }

            if (fondos2 < apuestaMonto) {
                return await sock.sendMessage(chatId, {
                    text: `❌ El rival @${retado.split('@')[0]} no tiene suficientes fondos para cubrir la apuesta de *$${economy.formatNumber(apuestaMonto)}* (tiene *$${economy.formatNumber(fondos2)}*).`,
                    mentions: [retado]
                }, { quoted: m });
            }
        }

        // Personajes de invocación anime
        const personajes = [
            { nombre: 'Goku', poder: 9500, habilidad: 'Kamehameha 💥', imagen: '🔵' },
            { nombre: 'Vegeta', poder: 9000, habilidad: 'Final Flash ⚡', imagen: '👑' },
            { nombre: 'Naruto', poder: 8500, habilidad: 'Rasengan 🌀', imagen: '🍥' },
            { nombre: 'Sasuke', poder: 8200, habilidad: 'Chidori ⚡', imagen: '🔵' },
            { nombre: 'Luffy', poder: 8000, habilidad: 'Gear 5 🌟', imagen: '⚓' },
            { nombre: 'Gojo', poder: 9800, habilidad: 'Infinity ∞', imagen: '🟣' },
            { nombre: 'Levi', poder: 7500, habilidad: 'Espadas Relámpago ⚔️', imagen: '⚔️' },
            { nombre: 'Tanjiro', poder: 7000, habilidad: 'Respiración Solar ☀️', imagen: '🌸' },
            { nombre: 'Saitama', poder: 12000, habilidad: 'Golpe Grave 👊', imagen: '👊' },
            { nombre: 'Eren', poder: 8800, habilidad: 'Titán Fundacional 🔥', imagen: '💀' },
            { nombre: 'Ichigo', poder: 8600, habilidad: 'Getsuga Tensho 🌙', imagen: '🗡️' },
            { nombre: 'Deku', poder: 7800, habilidad: 'One For All 💚', imagen: '💚' },
            { nombre: 'Sukuna', poder: 9700, habilidad: 'Expansión de Dominio ⛩️', imagen: '⛩️' },
            { nombre: 'Killua', poder: 7600, habilidad: 'Godspeed ⚡', imagen: '⚡' }
        ];

        const p1 = personajes[Math.floor(Math.random() * personajes.length)];
        let p2;
        do {
            p2 = personajes[Math.floor(Math.random() * personajes.length)];
        } while (p2.nombre === p1.nombre);

        // Bonificaciones de stats RPG reales del jugador
        const bonusStat1 = (user1.ataque * 40) + (user1.defensa * 25) + (user1.level * 100);
        const bonusStat2 = (user2.ataque * 40) + (user2.defensa * 25) + (user2.level * 100);

        const rank1 = economy.getUserRank(sender);
        const rank2 = economy.getUserRank(retado);

        const name1 = (userNames && typeof userNames.get === 'function') ? userNames.get(sender) : null;
        const tag1 = name1 ? `*${name1}* (@${sender.split('@')[0]})` : `@${sender.split('@')[0]}`;

        const name2 = (userNames && typeof userNames.get === 'function') ? userNames.get(retado) : null;
        const tag2 = name2 ? `*${name2}* (@${retado.split('@')[0]})` : `@${retado.split('@')[0]}`;

        let apuestaTexto = apuestaMonto > 0 ? `💰 *Bote de Apuesta:* *$${economy.formatNumber(apuestaMonto * 2)} monedas*\n\n` : '';

        // Anuncio inicial del combate
        await sock.sendMessage(chatId, {
            text: `⚔️ *¡COMBATE A MUERTE INICIADO!* ⚔️\n\n` +
                  apuestaTexto +
                  `🔵 *RETADOR:* ${tag1}\n` +
                  `   🎖️ Rango: ${rank1.nombre} (Nv. ${user1.level})\n` +
                  `   🗡️ Atq: ${user1.ataque} | 🛡️ Def: ${user1.defensa}\n` +
                  `   Invocó a: *${p1.nombre}* ${p1.imagen}\n\n` +
                  `🔴 *DEFENSOR:* ${tag2}\n` +
                  `   🎖️ Rango: ${rank2.nombre} (Nv. ${user2.level})\n` +
                  `   🗡️ Atq: ${user2.ataque} | 🛡️ Def: ${user2.defensa}\n` +
                  `   Invocó a: *${p2.nombre}* ${p2.imagen}\n\n` +
                  `💥 _Los luchadores chocan espadas y poderes... Calculando impacto..._`,
            mentions: [sender, retado]
        }, { quoted: m });

        await new Promise(r => setTimeout(r, 2000));

        // Cálculo de daño final: poder del personaje + stats RPG + factor de azar controlado
        const azar1 = Math.floor(Math.random() * 800);
        const azar2 = Math.floor(Math.random() * 800);
        const score1 = p1.poder + bonusStat1 + azar1;
        const score2 = p2.poder + bonusStat2 + azar2;

        const p1Gana = score1 >= score2;
        const winnerJid = p1Gana ? sender : retado;
        const loserJid = p1Gana ? retado : sender;
        const winnerTag = p1Gana ? tag1 : tag2;
        const loserTag = p1Gana ? tag2 : tag1;
        const pjGanador = p1Gana ? p1 : p2;
        const diffPuntos = Math.abs(score1 - score2);

        // Otorgar EXP al ganador
        economy.addExp(winnerJid, 80);

        let transaccionTexto = '';
        if (apuestaMonto > 0) {
            const loserUser = economy.getUser(loserJid);
            const winnerUser = economy.getUser(winnerJid);

            // Cobrar del perdedor
            let cobro = apuestaMonto;
            if (loserUser.monedas >= cobro) {
                loserUser.monedas -= cobro;
            } else {
                cobro -= loserUser.monedas;
                loserUser.monedas = 0;
                loserUser.banco = Math.max(0, loserUser.banco - cobro);
            }

            // Ganador recibe el pozo directamente a su banco
            winnerUser.banco = (winnerUser.banco || 0) + apuestaMonto;
            economy.save();

            transaccionTexto = `\n💰 *¡POZO GANADO!* ${winnerTag} se lleva *$${economy.formatNumber(apuestaMonto)} monedas* del rival (depositadas al banco).`;
        } else {
            economy.save();
        }

        const resultadoMensaje =
            `💥 *¡BATALLA FINALIZADA!* 💥\n\n` +
            `⚡ *Ataque definitivo:* ${pjGanador.habilidad}\n\n` +
            `🏆 *¡VICTORIA PARA:* ${winnerTag}!\n` +
            `   Invocación: *${pjGanador.nombre}*\n` +
            `   Diferencia de impacto: *+${economy.formatNumber(diffPuntos)}* pts de combate\n` +
            `   ✨ *EXP ganada:* +80 EXP\n` +
            transaccionTexto + `\n\n` +
            `💀 ${loserTag} ha caído derrotado en el campo de batalla.\n\n` +
            `_Unknown Codexツ</>_`;

        await sock.sendMessage(chatId, {
            text: resultadoMensaje,
            mentions: [sender, retado]
        }, { quoted: m });
    }
};
