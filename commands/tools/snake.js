'use strict';

const snakeManager = require('../../lib/snake');
const userNames = require('../../lib/userNames');

/**
 * Normaliza el JID eliminando sufijos de dispositivo
 */
function cleanJid(id) {
    if (!id) return '';
    return id.replace(/:.*@/, '@').split('@')[0] + '@s.whatsapp.net';
}

module.exports = {
    name: 'snake',
    alias: ['serpiente', 'vibora', 'snakegame'],
    category: 'juegos',
    desc: 'Juego clásico de la serpiente (Snake) interactivo por turnos en el chat con emojis',
    usage: '.snake [iniciar] | .snake w/a/s/d [mover] | .snake stop [cancelar]',

    execute: async ({ sock, m, args }) => {
        const chatId = m.chat || m.key.remoteJid;
        const sender = cleanJid(m.sender || m.key.participant || chatId);
        const senderName = m.pushName || userNames.get(sender) || `@${sender.split('@')[0]}`;
        const input = (args && args[0] ? args[0] : '').toLowerCase().trim();

        const activeGame = snakeManager.getGame(chatId, sender);

        // 1. Cancelar partida activa
        if (input === 'stop' || input === 'cancel' || input === 'cancelar' || input === 'salir') {
            if (!activeGame) {
                return await sock.sendMessage(chatId, {
                    text: 'ℹ️ No tienes ninguna partida de Snake activa en este chat.\nInicia una con *.snake*'
                }, { quoted: m });
            }
            snakeManager.cancelGame(chatId, sender);
            return await sock.sendMessage(chatId, {
                text: '🛑 Partida de Snake cancelada con éxito.'
            }, { quoted: m });
        }

        // 2. Si ya hay partida y el usuario envió una dirección (w, a, s, d, etc.)
        if (activeGame && input && snakeManager.parseDirection(input)) {
            const result = snakeManager.makeMove(chatId, sender, input);

            if (result.error === 'OPPOSITE_DIRECTION') {
                return await sock.sendMessage(chatId, {
                    text: `${result.message}\n\n${result.boardText}\n\n_Usa: w (arriba), s (abajo), a (izquierda), d (derecha)_`
                }, { quoted: m });
            }

            if (result.finished) {
                const game = result.game;
                const finalMsg = result.won
                    ? [
                        '┏❐ 《 🏆 ¡VICTORIA TOTAL EN SNAKE! 》 ❐',
                        '┃',
                        `┃├◆ 🐍 *Jugador:* ${senderName}`,
                        `┃├◆ 🍎 *Manzanas comidas:* ${game.apples}`,
                        `┃├◆ ⭐ *Puntuación final:* ${game.score} pts`,
                        `┃├◆ 🕹️ *Movimientos:* ${game.moves}`,
                        '┃',
                        '┃├◆ 🌟 ¡Has conquistado el tablero por completo!',
                        '┗❐\n',
                        result.boardText,
                        '\n_Unknown Codexツ</>_'
                    ].join('\n')
                    : [
                        '┏❐ 《 💥 GAME OVER - SNAKE 》 ❐',
                        '┃',
                        `┃├◆ ☠️ *Causa:* ${result.message}`,
                        `┃├◆ 🐍 *Jugador:* ${senderName}`,
                        `┃├◆ 🍎 *Manzanas:* ${game.apples}`,
                        `┃├◆ ⭐ *Puntuación:* ${game.score} pts`,
                        `┃├◆ 🕹️ *Movimientos:* ${game.moves}`,
                        '┃',
                        '┃├◆ 🔄 ¿Quieres revancha? Escribe *.snake*',
                        '┗❐\n',
                        result.boardText,
                        '\n_Unknown Codexツ</>_'
                    ].join('\n');

                await m.react?.(result.won ? '🏆' : '💀');
                return await sock.sendMessage(chatId, { text: finalMsg }, { quoted: m });
            }

            // Movimiento exitoso en curso
            const game = result.game;
            const eatNotice = result.ateFood ? ' ¡+10 pts! 🍎😋' : '';

            const statusMsg = [
                '┏❐ 《 🐍 JUEGO DE LA SERPIENTE 》 ❐',
                '┃',
                result.boardText,
                '┃',
                `┃├◆ 🍎 *Manzanas:* ${game.apples} | ⭐ *Puntos:* ${game.score}${eatNotice}`,
                `┃├◆ 📏 *Largo:* ${game.snake.length} | 🕹️ *Paso:* #${game.moves}`,
                '┃',
                '┃├◆ 🕹️ *Controles de dirección:*',
                '┃   ⬆️ `.snake w` (Arriba)',
                '┃   ⬇️ `.snake s` (Abajo)',
                '┃   ⬅️ `.snake a` (Izquierda)',
                '┃   ➡️ `.snake d` (Derecha)',
                '┃   🛑 `.snake stop` (Rendirse)',
                '┗❐'
            ].join('\n');

            if (result.ateFood) {
                await m.react?.('🍎');
            }

            return await sock.sendMessage(chatId, { text: statusMsg }, { quoted: m });
        }

        // 3. Si no hay partida activa o puso ".snake" / ".snake start" / ".snake play"
        if (activeGame) {
            // Ya tiene partida, mostrarle su tablero actual
            const board = snakeManager.renderBoard(activeGame);
            return await sock.sendMessage(chatId, {
                text: [
                    '┏❐ 《 🐍 YA TIENES UNA PARTIDA ACTIVA 》 ❐',
                    '┃',
                    board,
                    '┃',
                    `┃├◆ 🍎 *Manzanas:* ${activeGame.apples} | ⭐ *Puntos:* ${activeGame.score}`,
                    '┃',
                    '┃├◆ 🕹️ *Envía tu siguiente movimiento:*',
                    '┃   `.snake w` (Arriba)',
                    '┃   `.snake s` (Abajo)',
                    '┃   `.snake a` (Izquierda)',
                    '┃   `.snake d` (Derecha)',
                    '┃   O escribe `.snake stop` para salir.',
                    '┗❐'
                ].join('\n')
            }, { quoted: m });
        }

        // Iniciar nueva partida
        const newGame = snakeManager.createGame({
            chatId,
            userId: sender,
            userName: senderName,
            onTimeout: async () => {
                try {
                    await sock.sendMessage(chatId, {
                        text: `⏰ Partida de Snake de @${sender.split('@')[0]} finalizada por inactividad (2 minutos sin jugar).`,
                        mentions: [sender]
                    });
                } catch (_) {}
            }
        });

        const initialBoard = snakeManager.renderBoard(newGame);

        await m.react?.('🐍');
        await sock.sendMessage(chatId, {
            text: [
                '┏❐ 《 🐍 ¡NUEVA PARTIDA DE SNAKE! 》 ❐',
                '┃',
                initialBoard,
                '┃',
                `┃├◆ 👤 *Jugador:* ${senderName}`,
                `┃├◆ 🍎 *Come manzanas* para crecer y sumar puntos.`,
                `┃├◆ ⚠️ *Cuidado:* ¡No choques contra los bordes ni tu cuerpo!`,
                '┃',
                '┃├◆ 🕹️ *Cómo mover la serpiente:*',
                '┃   ⬆️ `.snake w` (Arriba)',
                '┃   ⬇️ `.snake s` (Abajo)',
                '┃   ⬅️ `.snake a` (Izquierda)',
                '┃   ➡️ `.snake d` (Derecha)',
                '┃   🛑 `.snake stop` (Finalizar)',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n'),
            mentions: [sender]
        }, { quoted: m });
    }
};

