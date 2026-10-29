'use strict';

const tictactoeManager = require('../../lib/tictactoe');
const userNames = require('../../lib/userNames');

/**
 * Normaliza y obtiene el JID limpio
 */
function cleanJid(id) {
    if (!id) return '';
    return id.replace(/:.*@/, '@').split('@')[0] + '@s.whatsapp.net';
}

module.exports = {
    name: 'tictactoe',
    alias: ['ttt', 'tresenraya', 'tateti'],
    category: 'juegos',
    desc: 'Juega al clásico Tres en Raya (Tic-Tac-Toe) interactivo con otro miembro del grupo',
    usage: '.ttt [@usuario para retar] | .ttt [1-9] para jugar | .ttt stop para cancelar',
    groupOnly: true,

    execute: async ({ sock, m, args }) => {
        const chatId = m.chat;
        const sender = cleanJid(m.sender);
        const senderName = m.pushName || userNames.get(sender) || `@${sender.split('@')[0]}`;
        const input = (args[0] || '').toLowerCase().trim();

        const activeGame = tictactoeManager.getGame(chatId);

        // 1. Cancelar partida
        if (input === 'stop' || input === 'cancel' || input === 'cancelar') {
            if (!activeGame) {
                return await sock.sendMessage(chatId, {
                    text: 'ℹ️ No hay ninguna partida activa en este grupo.\nInicia una con *.ttt*'
                }, { quoted: m });
            }
            if (activeGame.playerX !== sender && activeGame.playerO !== sender) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Solo los jugadores participantes pueden cancelar la partida.'
                }, { quoted: m });
            }
            tictactoeManager.cancelGame(chatId);
            return await sock.sendMessage(chatId, {
                text: '🛑 Partida de Tres en Raya cancelada con éxito.'
            }, { quoted: m });
        }

        // 2. Realizar un movimiento (1 a 9)
        const movePos = parseInt(input);
        if (!isNaN(movePos) && movePos >= 1 && movePos <= 9) {
            if (!activeGame) {
                return await sock.sendMessage(chatId, {
                    text: 'ℹ️ No hay ninguna partida en curso. Crea una con *.ttt*'
                }, { quoted: m });
            }
            if (activeGame.status === 'WAITING') {
                return await sock.sendMessage(chatId, {
                    text: '⏳ La partida aún espera a que el segundo jugador se una.\nEscribe *.ttt join* para unirte.'
                }, { quoted: m });
            }

            const result = tictactoeManager.playMove(chatId, sender, movePos - 1);

            if (result.error === 'NOT_YOUR_TURN') {
                return await sock.sendMessage(chatId, {
                    text: `⏳ No es tu turno. Le toca a @${result.currentTurn.split('@')[0]}.`,
                    mentions: [result.currentTurn]
                }, { quoted: m });
            }
            if (result.error === 'INVALID_POSITION') {
                return await sock.sendMessage(chatId, {
                    text: '⚠️ Esa casilla ya está ocupada o no es válida. Elige otra casilla del 1 al 9.'
                }, { quoted: m });
            }

            // Partida finalizada
            if (result.finished) {
                if (result.isTie) {
                    return await sock.sendMessage(chatId, {
                        text: `🤝 *¡EMPATE EN TRES EN RAYA!*\n\n${result.boardText}\n\n_¡Bien jugado por ambos! Partida finalizada._\n\n_Unknown Codexツ</>_`
                    });
                } else {
                    return await sock.sendMessage(chatId, {
                        text: `🏆 *¡TENEMOS UN GANADOR!*\n\n` +
                              `🎉 Felicidades *${result.winnerName}* (@${result.winner.split('@')[0]}), has dominado el tablero ❌⭕\n\n` +
                              `${result.boardText}\n\n` +
                              `_Unknown Codexツ</>_`,
                        mentions: [result.winner]
                    });
                }
            }

            // Siguiente turno
            return await sock.sendMessage(chatId, {
                text: `🎮 *TRES EN RAYA (TIC-TAC-TOE)*\n\n` +
                      `${result.boardText}\n\n` +
                      `👉 Turno de: *${result.nextTurnName}* (@${result.nextTurn.split('@')[0]})\n` +
                      `💬 Responde con el número de casilla (ej: *.ttt 5*)`,
                mentions: [result.nextTurn]
            });
        }

        // 3. Unirse a una partida en espera
        if (input === 'join' || input === 'unirse') {
            if (!activeGame || activeGame.status !== 'WAITING') {
                return await sock.sendMessage(chatId, {
                    text: 'ℹ️ No hay ninguna partida abierta esperando rival. Inicia una con *.ttt*'
                }, { quoted: m });
            }
            if (activeGame.playerX === sender) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Ya eres el Jugador X, no puedes jugar contra ti mismo.'
                }, { quoted: m });
            }

            const updatedGame = tictactoeManager.joinGame(chatId, sender, senderName);
            const initialBoard = tictactoeManager.renderBoard(updatedGame.board);

            return await sock.sendMessage(chatId, {
                text: `⚔️ *¡DESAFÍO ACEPTADO!*\n\n` +
                      `❌ *Jugador X:* ${updatedGame.playerXName}\n` +
                      `⭕ *Jugador O:* ${updatedGame.playerOName}\n\n` +
                      `${initialBoard}\n\n` +
                      `👉 Inicia *${updatedGame.playerXName}* con ❌\n` +
                      `💬 Juega escribiendo: *.ttt [1-9]*`,
                mentions: [updatedGame.playerX, updatedGame.playerO]
            });
        }

        // 4. Crear nueva partida
        if (activeGame) {
            return await sock.sendMessage(chatId, {
                text: `⚠️ Ya hay una partida en curso en este grupo.\nUsa *.ttt [1-9]* para mover o *.ttt stop* para cancelar.`
            }, { quoted: m });
        }

        let targetJid = null;
        let targetName = null;
        if (m.mentionedJid && m.mentionedJid.length > 0) {
            targetJid = cleanJid(m.mentionedJid[0]);
            targetName = userNames.get(targetJid) || `@${targetJid.split('@')[0]}`;
        } else if (m.quoted && m.quoted.sender) {
            targetJid = cleanJid(m.quoted.sender);
            targetName = userNames.get(targetJid) || `@${targetJid.split('@')[0]}`;
        }

        if (targetJid && targetJid !== sender) {
            // Reto directo a alguien
            const newGame = tictactoeManager.createGame({
                chatId,
                playerX: sender,
                playerXName: senderName,
                playerO: targetJid,
                playerOName: targetName,
                onTimeout: async () => {
                    try {
                        await sock.sendMessage(chatId, { text: '⏰ Partida de Tres en Raya cancelada por inactividad.' });
                    } catch (_) {}
                }
            });

            const initialBoard = tictactoeManager.renderBoard(newGame.board);
            return await sock.sendMessage(chatId, {
                text: `🎮 *NUEVA PARTIDA: TRES EN RAYA*\n\n` +
                      `❌ *Jugador X:* ${senderName} (@${sender.split('@')[0]})\n` +
                      `⭕ *Jugador O:* ${targetName} (@${targetJid.split('@')[0]})\n\n` +
                      `${initialBoard}\n\n` +
                      `👉 Turno de: *${senderName}* (❌)\n` +
                      `💬 Escribe *.ttt [1-9]* para colocar tu ficha.`,
                mentions: [sender, targetJid]
            });
        } else {
            // Partida abierta esperando rival
            const newGame = tictactoeManager.createGame({
                chatId,
                playerX: sender,
                playerXName: senderName,
                playerO: null,
                playerOName: null,
                onTimeout: async () => {
                    try {
                        await sock.sendMessage(chatId, { text: '⏰ Partida de Tres en Raya cancelada por falta de rival.' });
                    } catch (_) {}
                }
            });

            const initialBoard = tictactoeManager.renderBoard(newGame.board);
            return await sock.sendMessage(chatId, {
                text: `🎮 *SALA DE TRES EN RAYA CREADA*\n\n` +
                      `❌ Creador: *${senderName}*\n\n` +
                      `${initialBoard}\n\n` +
                      `👉 ¿Quién se atreve a retarlo? Escribe *.ttt join* para unirte con ⭕!\n\n` +
                      `_Unknown Codexツ</>_`,
                mentions: [sender]
            });
        }
    }
};

