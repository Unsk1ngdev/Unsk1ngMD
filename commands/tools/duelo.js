'use strict';

module.exports = {
    name: 'duelo',
    alias: ['pvp', 'batalla', 'pelea'],
    category: 'herramientas',
    desc: 'Simulador de combate anime entre dos usuarios con stats y habilidades',
    usage: '.duelo @usuario',

    execute: async ({ sock, m, args }) => {
        const chatId = m.chat || m.key.remoteJid;
        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        let retado = mentioned[0] || m.message?.extendedTextMessage?.contextInfo?.participant;

        if (!retado && args[0]) {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw.length >= 7) {
                retado = `${raw}@s.whatsapp.net`;
            }
        }

        if (!retado) {
            return await sock.sendMessage(chatId, {
                text: '❌ Menciona a alguien para el duelo.\nEjemplo: *.duelo @usuario*\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const senderClean = m.sender.replace(/:\d+/, '');
        const retadoClean = retado.replace(/:\d+/, '');

        if (retadoClean === senderClean) {
            return await sock.sendMessage(chatId, {
                text: '❌ No puedes retarte a ti mismo.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        // Personajes de anime con stats
        const personajes = [
            { nombre: 'Goku', poder: 9500, habilidad: 'Kamehameha 💥', imagen: '🔵' },
            { nombre: 'Vegeta', poder: 9000, habilidad: 'Final Flash ⚡', imagen: '👑' },
            { nombre: 'Naruto', poder: 8500, habilidad: 'Rasengan 🌀', imagen: '🍥' },
            { nombre: 'Sasuke', poder: 8200, habilidad: 'Chidori ⚡', imagen: '🔵' },
            { nombre: 'Luffy', poder: 8000, habilidad: 'Gear 5 🌟', imagen: '⚓' },
            { nombre: 'Gojo', poder: 9800, habilidad: 'Infinity ∞', imagen: '🟣' },
            { nombre: 'Levi', poder: 7500, habilidad: 'Espadas Relámpago ⚔️', imagen: '⚔️' },
            { nombre: 'Tanjiro', poder: 7000, habilidad: 'Respiración Solar ☀️', imagen: '🌸' },
            { nombre: 'Saitama', poder: 99999, habilidad: 'Un Golpe 👊', imagen: '👊' },
            { nombre: 'Eren', poder: 8800, habilidad: 'Titan Fundacional 🔥', imagen: '💀' },
            { nombre: 'Ichigo', poder: 8600, habilidad: 'Getsuga Tensho 🌙', imagen: '🗡️' },
            { nombre: 'Deku', poder: 7800, habilidad: 'One For All 💚', imagen: '💚' },
            { nombre: 'Bakugo', poder: 7600, habilidad: 'Explosión 💥', imagen: '🧨' },
            { nombre: 'Light', poder: 6000, habilidad: 'Death Note ✍️', imagen: '📓' },
            { nombre: 'Killua', poder: 7400, habilidad: 'Godspeed ⚡', imagen: '⚡' }
        ];

        const p1 = personajes[Math.floor(Math.random() * personajes.length)];
        let p2;
        do {
            p2 = personajes[Math.floor(Math.random() * personajes.length)];
        } while (p2.nombre === p1.nombre);

        const retador = '+' + senderClean.replace('@s.whatsapp.net', '');
        const retadoNum = '+' + retadoClean.replace('@s.whatsapp.net', '');

        // Animación del duelo
        await sock.sendMessage(chatId, {
            text: `⚔️ *¡DUELO INICIADO!*\n\n` +
                  `🔵 ${retador}\n` +
                  `   Invocó a: *${p1.nombre}* ${p1.imagen}\n` +
                  `   Poder: *${p1.poder}*\n` +
                  `   Habilidad: *${p1.habilidad}*\n\n` +
                  `🔴 ${retadoNum}\n` +
                  `   Invocó a: *${p2.nombre}* ${p2.imagen}\n` +
                  `   Poder: *${p2.poder}*\n` +
                  `   Habilidad: *${p2.habilidad}*\n\n` +
                  `⚔️ _Combate en progreso..._`
        }, { quoted: m });

        await new Promise(r => setTimeout(r, 2000));

        // Calcular ganador con factor de aleatoriedad
        const bonus1 = Math.random() * 1000;
        const bonus2 = Math.random() * 1000;
        const total1 = p1.poder + bonus1;
        const total2 = p2.poder + bonus2;

        const ganador = total1 > total2 ? retador : retadoNum;
        const perdedor = total1 > total2 ? retadoNum : retador;
        const personajeGanador = total1 > total2 ? p1 : p2;
        const diferencia = Math.abs(Math.round(total1 - total2));

        await sock.sendMessage(chatId, {
            text: `💥 *¡RESULTADO DEL DUELO!*\n\n` +
                  `${personajeGanador.habilidad}\n\n` +
                  `🏆 *¡${ganador} GANÓ!*\n` +
                  `   Con *${personajeGanador.nombre}*\n\n` +
                  `💀 *${perdedor} fue derrotado*\n` +
                  `   Por *${diferencia}* puntos de diferencia\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

