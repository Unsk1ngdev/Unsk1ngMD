const acertijoManager = require('../../lib/acertijo');

module.exports = [
    {
        name: 'acertijo',
        alias: ['acertijos', 'riddle', 'adivinanza'],
        category: 'juegos',
        desc: 'Inicia un divertido juego de acertijos con límite de tiempo de 60 segundos',
        usage: '.acertijo',
        execute: async ({ sock, m, args }) => {
            const sub = (args && args[0] ? args[0] : '').toLowerCase();
            if (sub === 'stop' || sub === 'cancel' || sub === 'cancelar') {
                const cancelled = acertijoManager.cancelGame(m.chat);
                if (cancelled) {
                    return await sock.sendMessage(m.chat, { text: '🧩 Partida de acertijos cancelada.' }, { quoted: m });
                }
                return await sock.sendMessage(m.chat, { text: 'ℹ️ No hay ninguna partida de acertijo activa en este chat.' }, { quoted: m });
            }
            await acertijoManager.startGame(sock, m);
        }
    },
    {
        name: 'cancelacertijo',
        alias: ['stopacertijo', 'stopriddle'],
        category: 'juegos',
        desc: 'Cancela la partida de acertijos activa en el chat',
        usage: '.cancelacertijo',
        execute: async ({ sock, m }) => {
            const cancelled = acertijoManager.cancelGame(m.chat);
            if (cancelled) {
                await sock.sendMessage(m.chat, { text: '🧩 Partida de acertijos cancelada con éxito.' }, { quoted: m });
            } else {
                await sock.sendMessage(m.chat, { text: 'ℹ️ No hay ninguna partida de acertijo activa en este chat.' }, { quoted: m });
            }
        }
    }
];
