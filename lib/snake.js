'use strict';

/**
 * Gestor del juego de la serpiente (Snake) en memoria para WhatsApp
 */

const games = new Map(); // key: `${chatId}:${userId}` -> game object

const BOARD_WIDTH = 8;
const BOARD_HEIGHT = 8;

const EMOJI_EMPTY = '⬛';
const EMOJI_HEAD = '🐍';
const EMOJI_BODY = '🟩';
const EMOJI_FOOD = '🍎';

/**
 * Genera una posición aleatoria de comida que no colisione con la serpiente
 */
function spawnFood(snake, width, height) {
    const occupied = new Set(snake.map(p => `${p.x},${p.y}`));
    const emptyCells = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!occupied.has(`${x},${y}`)) {
                emptyCells.push({ x, y });
            }
        }
    }

    if (emptyCells.length === 0) return null; // Tablero lleno (Victoria)
    const randomIndex = Math.floor(Math.random() * emptyCells.length);
    return emptyCells[randomIndex];
}

/**
 * Renderiza el tablero 8x8 con emojis
 */
function renderBoard(game) {
    const { snake, food, width, height } = game;
    const grid = Array.from({ length: height }, () => Array(width).fill(EMOJI_EMPTY));

    // Dibujar cuerpo de la serpiente (desde la cola hasta el cuello)
    for (let i = 1; i < snake.length; i++) {
        const seg = snake[i];
        if (seg.y >= 0 && seg.y < height && seg.x >= 0 && seg.x < width) {
            grid[seg.y][seg.x] = EMOJI_BODY;
        }
    }

    // Dibujar cabeza
    const head = snake[0];
    if (head.y >= 0 && head.y < height && head.x >= 0 && head.x < width) {
        grid[head.y][head.x] = EMOJI_HEAD;
    }

    // Dibujar comida
    if (food && food.y >= 0 && food.y < height && food.x >= 0 && food.x < width) {
        grid[food.y][food.x] = EMOJI_FOOD;
    }

    return grid.map(row => row.join('')).join('\n');
}

/**
 * Normaliza dirección de entrada a un valor canónico
 */
function parseDirection(input) {
    if (!input) return null;
    const clean = input.toLowerCase().trim();

    if (['w', 'up', 'arriba', 'arr', 'u', '8', '⬆️', '⬆'].includes(clean)) return 'UP';
    if (['s', 'down', 'abajo', 'abj', '2', '⬇️', '⬇'].includes(clean)) return 'DOWN';
    if (['a', 'left', 'izquierda', 'izq', '4', '⬅️', '⬅'].includes(clean)) return 'LEFT';
    if (['d', 'right', 'derecha', 'der', '6', '➡️', '➡'].includes(clean)) return 'RIGHT';

    return null;
}

const OPPOSITE_DIRECTIONS = {
    'UP': 'DOWN',
    'DOWN': 'UP',
    'LEFT': 'RIGHT',
    'RIGHT': 'LEFT'
};

const snakeManager = {
    getGameKey: (chatId, userId) => `${chatId}:${userId}`,

    hasActiveGame: (chatId, userId) => {
        if (!userId) {
            // Comprueba si hay algún juego activo en este chat
            for (const key of games.keys()) {
                if (key.startsWith(`${chatId}:`)) return true;
            }
            return false;
        }
        return games.has(`${chatId}:${userId}`);
    },

    getGame: (chatId, userId) => games.get(`${chatId}:${userId}`),

    createGame: ({ chatId, userId, userName, onTimeout }) => {
        const key = `${chatId}:${userId}`;
        if (games.has(key)) {
            const old = games.get(key);
            if (old.timer) clearTimeout(old.timer);
            games.delete(key);
        }

        const timer = setTimeout(() => {
            if (games.has(key)) {
                games.delete(key);
                if (typeof onTimeout === 'function') onTimeout();
            }
        }, 120000); // 2 minutos de inactividad

        const initialSnake = [
            { x: 3, y: 3 }, // Cabeza
            { x: 2, y: 3 },
            { x: 1, y: 3 }  // Cola
        ];

        const game = {
            chatId,
            userId,
            userName: userName || 'Jugador',
            width: BOARD_WIDTH,
            height: BOARD_HEIGHT,
            snake: initialSnake,
            direction: 'RIGHT',
            food: spawnFood(initialSnake, BOARD_WIDTH, BOARD_HEIGHT),
            score: 0,
            apples: 0,
            moves: 0,
            status: 'PLAYING',
            timer
        };

        games.set(key, game);
        return game;
    },

    cancelGame: (chatId, userId) => {
        const key = `${chatId}:${userId}`;
        if (games.has(key)) {
            const game = games.get(key);
            if (game.timer) clearTimeout(game.timer);
            games.delete(key);
            return true;
        }
        return false;
    },

    makeMove: (chatId, userId, directionInput) => {
        const key = `${chatId}:${userId}`;
        const game = games.get(key);
        if (!game || game.status !== 'PLAYING') {
            return { error: 'NO_GAME' };
        }

        const newDir = parseDirection(directionInput);
        if (!newDir) {
            return { error: 'INVALID_DIRECTION' };
        }

        // Evitar giro suicida inmediato de 180 grados si longitud > 1
        if (game.snake.length > 1 && OPPOSITE_DIRECTIONS[game.direction] === newDir) {
            return {
                error: 'OPPOSITE_DIRECTION',
                message: `⚠️ No puedes girar en sentido contrario (${newDir} cuando vas hacia ${game.direction}).`,
                boardText: renderBoard(game),
                game
            };
        }

        game.direction = newDir;
        const head = game.snake[0];
        let nextX = head.x;
        let nextY = head.y;

        if (newDir === 'UP') nextY--;
        else if (newDir === 'DOWN') nextY++;
        else if (newDir === 'LEFT') nextX--;
        else if (newDir === 'RIGHT') nextX++;

        const newHead = { x: nextX, y: nextY };

        // 1. Colisión con paredes
        if (nextX < 0 || nextX >= game.width || nextY < 0 || nextY >= game.height) {
            game.status = 'GAME_OVER';
            if (game.timer) clearTimeout(game.timer);
            games.delete(key);

            return {
                finished: true,
                won: false,
                reason: 'WALL_COLLISION',
                message: '💥 ¡Te estrellaste contra el borde del tablero!',
                boardText: renderBoard(game),
                game
            };
        }

        // 2. Colisión consigo misma (morder su cola)
        const hitSelf = game.snake.slice(0, -1).some(seg => seg.x === nextX && seg.y === nextY);
        if (hitSelf) {
            game.status = 'GAME_OVER';
            if (game.timer) clearTimeout(game.timer);
            games.delete(key);

            return {
                finished: true,
                won: false,
                reason: 'SELF_COLLISION',
                message: '💥 ¡Te mordiste tu propio cuerpo!',
                boardText: renderBoard(game),
                game
            };
        }

        // 3. Comprobar si come manzana
        const ateFood = (nextX === game.food?.x && nextY === game.food?.y);
        game.moves++;

        if (ateFood) {
            game.snake.unshift(newHead);
            game.score += 10;
            game.apples += 1;

            const nextFood = spawnFood(game.snake, game.width, game.height);
            if (!nextFood) {
                // Tablero completamente lleno: Victoria legendaria
                game.status = 'WON';
                if (game.timer) clearTimeout(game.timer);
                games.delete(key);

                return {
                    finished: true,
                    won: true,
                    reason: 'MAX_SCORE',
                    message: '🏆 ¡FELICIDADES! ¡Completaste el tablero entero con la serpiente!',
                    boardText: renderBoard(game),
                    game
                };
            }
            game.food = nextFood;
        } else {
            game.snake.unshift(newHead);
            game.snake.pop(); // Desplazar cola
        }

        // Reiniciar timer de inactividad
        if (game.timer) clearTimeout(game.timer);
        game.timer = setTimeout(() => {
            if (games.has(key)) {
                games.delete(key);
            }
        }, 120000);

        return {
            finished: false,
            ateFood,
            boardText: renderBoard(game),
            game
        };
    },

    renderBoard,
    parseDirection
};

module.exports = snakeManager;

