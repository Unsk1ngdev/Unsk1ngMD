'use strict';

/**
 * Gestor de partidas de Tres en Raya (Tic-Tac-Toe) en memoria
 */

const games = new Map(); // chatId -> game object

const WIN_COMBOS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Filas
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columnas
    [0, 4, 8], [2, 4, 6]             // Diagonales
];

const NUM_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

function renderBoard(board) {
    const symbols = board.map((val, idx) => {
        if (val === 'X') return '❌';
        if (val === 'O') return '⭕';
        return NUM_EMOJIS[idx];
    });

    return `${symbols[0]} ┃ ${symbols[1]} ┃ ${symbols[2]}\n` +
           `━━━╋━━━╋━━━\n` +
           `${symbols[3]} ┃ ${symbols[4]} ┃ ${symbols[5]}\n` +
           `━━━╋━━━╋━━━\n` +
           `${symbols[6]} ┃ ${symbols[7]} ┃ ${symbols[8]}`;
}

function checkWinner(board) {
    for (const combo of WIN_COMBOS) {
        const [a, b, c] = combo;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a]; // 'X' o 'O'
        }
    }
    if (board.every(cell => cell !== null)) {
        return 'TIE'; // Empate
    }
    return null; // Aún en juego
}

const tictactoeManager = {
    getGame: (chatId) => games.get(chatId),

    createGame: ({ chatId, playerX, playerXName, playerO = null, playerOName = null, onTimeout }) => {
        const timer = setTimeout(() => {
            if (games.has(chatId)) {
                games.delete(chatId);
                if (typeof onTimeout === 'function') onTimeout();
            }
        }, 90000); // 90 segundos de inactividad

        const game = {
            chatId,
            board: Array(9).fill(null),
            playerX,
            playerXName,
            playerO,
            playerOName,
            currentTurn: playerX, // Inicia X
            status: playerO ? 'PLAYING' : 'WAITING',
            timer
        };

        games.set(chatId, game);
        return game;
    },

    joinGame: (chatId, playerO, playerOName) => {
        const game = games.get(chatId);
        if (!game || game.status !== 'WAITING') return null;
        game.playerO = playerO;
        game.playerOName = playerOName;
        game.status = 'PLAYING';
        return game;
    },

    playMove: (chatId, playerJid, positionIndex) => {
        const game = games.get(chatId);
        if (!game || game.status !== 'PLAYING') return { error: 'NO_GAME' };

        if (game.currentTurn !== playerJid) {
            return { error: 'NOT_YOUR_TURN', currentTurn: game.currentTurn };
        }

        if (positionIndex < 0 || positionIndex > 8 || game.board[positionIndex] !== null) {
            return { error: 'INVALID_POSITION' };
        }

        const symbol = (playerJid === game.playerX) ? 'X' : 'O';
        game.board[positionIndex] = symbol;

        // Reset timer
        clearTimeout(game.timer);
        game.timer = setTimeout(() => {
            if (games.has(chatId)) games.delete(chatId);
        }, 90000);

        const outcome = checkWinner(game.board);
        if (outcome) {
            clearTimeout(game.timer);
            games.delete(chatId);
            return {
                finished: true,
                winner: outcome === 'TIE' ? null : (outcome === 'X' ? game.playerX : game.playerO),
                winnerName: outcome === 'TIE' ? null : (outcome === 'X' ? game.playerXName : game.playerOName),
                isTie: outcome === 'TIE',
                boardText: renderBoard(game.board)
            };
        }

        // Cambiar turno
        game.currentTurn = (game.currentTurn === game.playerX) ? game.playerO : game.playerX;
        const nextPlayerName = (game.currentTurn === game.playerX) ? game.playerXName : game.playerOName;

        return {
            finished: false,
            nextTurn: game.currentTurn,
            nextTurnName: nextPlayerName,
            boardText: renderBoard(game.board)
        };
    },

    cancelGame: (chatId) => {
        const game = games.get(chatId);
        if (!game) return false;
        clearTimeout(game.timer);
        games.delete(chatId);
        return true;
    },

    renderBoard
};

module.exports = tictactoeManager;

