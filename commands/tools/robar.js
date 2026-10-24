'use strict';

const economy = require('../../lib/economy');
const userNames = require('../../lib/userNames');

const ROB_COOLDOWN_MS = 20 * 60 * 1000; // 20 minutos de enfriamiento

module.exports = {
    name: 'robar',
    alias: ['asaltar', 'rob', 'steal'],
    category: 'juegos',
    desc: 'Intenta asaltar las monedas en mano de otro usuario (el banco es intocable)',
    usage: '.robar @usuario',
    groupOnly: true,

    execute: async ({ sock, m, args }) => {
        const chatId = m.chat || m.key.remoteJid;
        const sender = m.sender;

        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        let target = mentioned[0];

        if (!target && args[0]) {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw.length >= 7) target = `${raw}@s.whatsapp.net`;
        }
        if (!target && m.quoted?.sender) {
            target = m.quoted.sender;
        }

        if (!target) {
            return await sock.sendMessage(chatId, {
                text: '🦹‍♂️ *¡Alto ahí!* Debes mencionar o responder al mensaje del usuario que deseas asaltar.\n\n' +
                      '👉 *Ejemplo:* `.robar @usuario`'
            }, { quoted: m });
        }

        const cleanSender = sender.replace(/:\d+/, '');
        const cleanTarget = target.replace(/:\d+/, '');

        if (cleanSender === cleanTarget) {
            return await sock.sendMessage(chatId, {
                text: '❌ No puedes robarte a ti mismo.'
            }, { quoted: m });
        }

        const ladron = economy.getUser(sender);
        const victima = economy.getUser(target);

        // 1. Comprobar Cooldown del ladrón
        const ahora = Date.now();
        const tiempoPasado = ahora - (ladron.lastRob || 0);
        if (tiempoPasado < ROB_COOLDOWN_MS) {
            const restante = ROB_COOLDOWN_MS - tiempoPasado;
            return await sock.sendMessage(chatId, {
                text: `⏳ La policía aún te está buscando. Debes esperar *${economy.formatDuration(restante)}* para volver a asaltar.`
            }, { quoted: m });
        }

        // 2. Comprobar si la víctima tiene Escudo Anti-Robo activo
        if (victima.escudoAntiRobo && victima.escudoAntiRobo > ahora) {
            ladron.lastRob = ahora;
            economy.save();
            const duracionRestante = economy.formatDuration(victima.escudoAntiRobo - ahora);
            return await sock.sendMessage(chatId, {
                text: `🛡️ *¡ASALTO REPELIDO!*\n\n` +
                      `@${target.split('@')[0]} tiene un *Seguro Anti-Robo* activo de la tienda.\n` +
                      `Su dinero está totalmente blindado (restan ${duracionRestante} de protección).\n\n` +
                      `🚨 ¡El ladrón @${sender.split('@')[0]} ha tenido que huir con las manos vacías!`,
                mentions: [target, sender]
            }, { quoted: m });
        }

        // 3. Comprobar si la víctima tiene dinero en mano
        const dineroVictimaMano = victima.monedas || 0;
        if (dineroVictimaMano < 100) {
            return await sock.sendMessage(chatId, {
                text: `💨 *¡Bolsillos vacíos!*\n\n` +
                      `@${target.split('@')[0]} apenas tiene *$${economy.formatNumber(dineroVictimaMano)}* monedas en mano.\n` +
                      `💡 _Todo su dinero está a salvo guardado en el banco. ¡Elige a una víctima con más efectivo en mano!_`,
                mentions: [target]
            }, { quoted: m });
        }

        ladron.lastRob = ahora;

        // 4. Cálculo de probabilidad basado en Ataque vs Defensa
        const ataqueladron = ladron.ataque || 15;
        const defensavictima = victima.defensa || 10;
        let probExito = 50 + Math.floor((ataqueladron - defensavictima) / 3);
        probExito = Math.max(25, Math.min(75, probExito)); // Tope entre 25% y 75%

        const tirada = Math.floor(Math.random() * 100) + 1;
        const exito = tirada <= probExito;

        if (exito) {
            // Éxito: roba entre el 12% y el 25% del dinero en mano
            const porcentaje = (Math.floor(Math.random() * 14) + 12) / 100;
            const botin = Math.max(50, Math.floor(dineroVictimaMano * porcentaje));

            victima.monedas -= botin;
            ladron.monedas = (ladron.monedas || 0) + botin;

            economy.addExp(sender, 40);
            economy.save();

            return await sock.sendMessage(chatId, {
                text: `🦹‍♂️ *¡ASALTO EXITOSO!* 💰\n\n` +
                      `El sigilo de @${sender.split('@')[0]} dio frutos:\n` +
                      `Le robó *$${economy.formatNumber(botin)} monedas* en mano a @${target.split('@')[0]}!\n\n` +
                      `⚡ *EXP ganada por robo:* +40 EXP\n` +
                      `💡 _Tip: Guarda tu dinero en el banco (.depositar all) o compra un escudo en .tienda para no ser asaltado._`,
                mentions: [sender, target]
            }, { quoted: m });
        } else {
            // Fracaso: atrapado y paga una multa a la víctima
            const multa = Math.max(200, Math.floor((ladron.monedas || 0) * 0.15));
            const efectivoPagar = Math.min(ladron.monedas || 0, multa);

            if (efectivoPagar > 0) {
                ladron.monedas -= efectivoPagar;
                victima.monedas = (victima.monedas || 0) + efectivoPagar;
            }

            economy.save();

            return await sock.sendMessage(chatId, {
                text: `🚨 *¡ATRAPADO CON LAS MANOS EN LA MASA!* 👮‍♂️\n\n` +
                      `@${sender.split('@')[0]} fue descubierto intentando robar a @${target.split('@')[0]}.\n\n` +
                      `💥 La víctima se defendió y le obligó a pagar una compensación de *$${economy.formatNumber(efectivoPagar)} monedas*.\n` +
                      `¡Mejor suerte la próxima vez!`,
                mentions: [sender, target]
            }, { quoted: m });
        }
    }
};

