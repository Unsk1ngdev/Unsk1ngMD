'use strict';

const logger = require('./logger');

/**
 * Gestor del juego Hombre Lobo (Werewolf / Mafia) para WhatsApp
 */

const games = new Map(); // key: chatId -> game state object

function cleanJid(id) {
    if (!id) return '';
    return id.replace(/:.*@/, '@').split('@')[0] + '@s.whatsapp.net';
}

function getPhone(jid) {
    return cleanJid(jid).replace(/[^0-9]/g, '');
}

/**
 * Baraja un array usando el algoritmo Fisher-Yates
 */
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

const WerewolfManager = {
    hasActiveGame: (chatId) => games.has(chatId),

    getGame: (chatId) => games.get(chatId),

    /**
     * Crea un nuevo lobby de juego en el grupo
     */
    createGame: (chatId, creatorJid, creatorName) => {
        if (games.has(chatId)) return null;

        const cleanCreator = cleanJid(creatorJid);

        const game = {
            chatId,
            creator: cleanCreator,
            status: 'LOBBY', // LOBBY, NIGHT, DAY, ENDED
            round: 0,
            players: new Map([
                [cleanCreator, {
                    jid: cleanCreator,
                    name: creatorName || `@${getPhone(cleanCreator)}`,
                    role: null,
                    alive: true
                }]
            ]),
            // Acciones nocturnas
            nightActions: {
                wolfVotes: new Map(), // wolfJid -> targetJid
                seerChecked: null,     // targetJid
                witchSaved: false,
                witchPoisoned: null    // targetJid
            },
            // Recursos de la bruja
            witchPotions: {
                hasHeal: true,
                hasPoison: true
            },
            // Votos diurnos
            dayVotes: new Map(), // voterJid -> targetJid
            timer: null
        };

        games.set(chatId, game);
        return game;
    },

    /**
     * Un jugador se une al lobby
     */
    joinGame: (chatId, playerJid, playerName) => {
        const game = games.get(chatId);
        if (!game || game.status !== 'LOBBY') return { error: 'NOT_IN_LOBBY' };

        const cleanP = cleanJid(playerJid);
        if (game.players.has(cleanP)) {
            return { error: 'ALREADY_JOINED' };
        }

        if (game.players.size >= 12) {
            return { error: 'LOBBY_FULL' };
        }

        game.players.set(cleanP, {
            jid: cleanP,
            name: playerName || `@${getPhone(cleanP)}`,
            role: null,
            alive: true
        });

        return { success: true, count: game.players.size, game };
    },

    /**
     * Cancela la partida
     */
    cancelGame: (chatId) => {
        const game = games.get(chatId);
        if (!game) return false;
        if (game.timer) clearTimeout(game.timer);
        games.delete(chatId);
        return true;
    },

    /**
     * Asigna roles y da comienzo al juego
     */
    startGame: (chatId) => {
        const game = games.get(chatId);
        if (!game || game.status !== 'LOBBY') return { error: 'INVALID_STATUS' };

        const playerCount = game.players.size;
        if (playerCount < 4) {
            return { error: 'NOT_ENOUGH_PLAYERS', count: playerCount };
        }

        const playerList = shuffleArray(Array.from(game.players.keys()));

        // Configuración de roles según cantidad de jugadores
        let wolvesCount = 1;
        if (playerCount >= 6) wolvesCount = 2;
        if (playerCount >= 10) wolvesCount = 3;

        let index = 0;
        // Asignar Lobos
        for (let i = 0; i < wolvesCount; i++) {
            const jid = playerList[index++];
            game.players.get(jid).role = 'WOLF';
        }

        // Asignar Vidente
        const seerJid = playerList[index++];
        game.players.get(seerJid).role = 'SEER';

        // Asignar Bruja / Hechicero
        const witchJid = playerList[index++];
        game.players.get(witchJid).role = 'WITCH';

        // El resto son Aldeanos
        while (index < playerList.length) {
            const villagerJid = playerList[index++];
            game.players.get(villagerJid).role = 'VILLAGER';
        }

        game.status = 'NIGHT';
        game.round = 1;
        WerewolfManager.resetNightActions(game);

        return { success: true, game };
    },

    resetNightActions: (game) => {
        game.nightActions = {
            wolfVotes: new Map(),
            seerChecked: null,
            witchSaved: false,
            witchPoisoned: null
        };
    },

    /**
     * Acción de Hombre Lobo en la noche
     */
    wolfKill: (chatId, wolfJid, targetJid) => {
        const game = games.get(chatId);
        if (!game || game.status !== 'NIGHT') return { error: 'NOT_NIGHT' };

        const wolf = game.players.get(cleanJid(wolfJid));
        if (!wolf || !wolf.alive || wolf.role !== 'WOLF') {
            return { error: 'NOT_A_WOLF' };
        }

        const target = game.players.get(cleanJid(targetJid));
        if (!target || !target.alive) {
            return { error: 'INVALID_TARGET' };
        }

        if (target.role === 'WOLF') {
            return { error: 'CANNOT_TARGET_WOLF' };
        }

        game.nightActions.wolfVotes.set(wolf.jid, target.jid);
        return { success: true, targetName: target.name };
    },

    /**
     * Acción de Vidente en la noche
     */
    seerCheck: (chatId, seerJid, targetJid) => {
        const game = games.get(chatId);
        if (!game || game.status !== 'NIGHT') return { error: 'NOT_NIGHT' };

        const seer = game.players.get(cleanJid(seerJid));
        if (!seer || !seer.alive || seer.role !== 'SEER') {
            return { error: 'NOT_A_SEER' };
        }

        const target = game.players.get(cleanJid(targetJid));
        if (!target || !target.alive) {
            return { error: 'INVALID_TARGET' };
        }

        game.nightActions.seerChecked = target.jid;
        const isWolf = target.role === 'WOLF';

        return {
            success: true,
            targetName: target.name,
            isWolf,
            roleName: isWolf ? '🐺 Hombre Lobo' : '👤 Humano Inocente'
        };
    },

    /**
     * Acción de la Bruja: Salvar a la víctima de los lobos
     */
    witchSave: (chatId, witchJid) => {
        const game = games.get(chatId);
        if (!game || game.status !== 'NIGHT') return { error: 'NOT_NIGHT' };

        const witch = game.players.get(cleanJid(witchJid));
        if (!witch || !witch.alive || witch.role !== 'WITCH') {
            return { error: 'NOT_A_WITCH' };
        }

        if (!game.witchPotions.hasHeal) {
            return { error: 'NO_HEAL_POTION' };
        }

        game.nightActions.witchSaved = true;
        game.witchPotions.hasHeal = false;
        return { success: true };
    },

    /**
     * Acción de la Bruja: Envenenar a un jugador
     */
    witchPoison: (chatId, witchJid, targetJid) => {
        const game = games.get(chatId);
        if (!game || game.status !== 'NIGHT') return { error: 'NOT_NIGHT' };

        const witch = game.players.get(cleanJid(witchJid));
        if (!witch || !witch.alive || witch.role !== 'WITCH') {
            return { error: 'NOT_A_WITCH' };
        }

        if (!game.witchPotions.hasPoison) {
            return { error: 'NO_POISON_POTION' };
        }

        const target = game.players.get(cleanJid(targetJid));
        if (!target || !target.alive) {
            return { error: 'INVALID_TARGET' };
        }

        game.nightActions.witchPoisoned = target.jid;
        game.witchPotions.hasPoison = false;
        return { success: true, targetName: target.name };
    },

    /**
     * Resuelve los resultados de la noche y da paso al día
     */
    resolveNight: (chatId) => {
        const game = games.get(chatId);
        if (!game || game.status !== 'NIGHT') return null;

        // Calcular víctima de los lobos por mayoría de votos
        const voteCount = {};
        for (const target of game.nightActions.wolfVotes.values()) {
            voteCount[target] = (voteCount[target] || 0) + 1;
        }

        let wolfTarget = null;
        let maxVotes = 0;
        for (const [target, count] of Object.entries(voteCount)) {
            if (count > maxVotes) {
                maxVotes = count;
                wolfTarget = target;
            }
        }

        const deaths = [];

        // Si los lobos atacaron y la bruja no salvó
        if (wolfTarget && !game.nightActions.witchSaved) {
            const victim = game.players.get(wolfTarget);
            if (victim && victim.alive) {
                victim.alive = false;
                deaths.push({ ...victim, cause: 'WOLF_ATTACK' });
            }
        }

        // Si la bruja envenenó a alguien
        if (game.nightActions.witchPoisoned) {
            const poisonVictim = game.players.get(game.nightActions.witchPoisoned);
            if (poisonVictim && poisonVictim.alive) {
                poisonVictim.alive = false;
                deaths.push({ ...poisonVictim, cause: 'WITCH_POISON' });
            }
        }

        // Comprobar condición de victoria
        const win = WerewolfManager.checkVictory(game);

        if (win) {
            game.status = 'ENDED';
            return { win, deaths, game };
        }

        game.status = 'DAY';
        game.dayVotes.clear();

        return { win: null, deaths, game };
    },

    /**
     * Voto de un jugador en la fase diurna
     */
    dayVote: (chatId, voterJid, targetJid) => {
        const game = games.get(chatId);
        if (!game || game.status !== 'DAY') return { error: 'NOT_DAY' };

        const voter = game.players.get(cleanJid(voterJid));
        if (!voter || !voter.alive) {
            return { error: 'NOT_ALIVE' };
        }

        if (targetJid === 'skip') {
            game.dayVotes.set(voter.jid, 'skip');
            return { success: true, targetName: 'Abstención (Skip)' };
        }

        const target = game.players.get(cleanJid(targetJid));
        if (!target || !target.alive) {
            return { error: 'INVALID_TARGET' };
        }

        game.dayVotes.set(voter.jid, target.jid);
        return {
            success: true,
            targetName: target.name,
            totalVotes: game.dayVotes.size,
            aliveCount: Array.from(game.players.values()).filter(p => p.alive).length
        };
    },

    /**
     * Resuelve los votos del día y lincha al más votado
     */
    resolveDay: (chatId) => {
        const game = games.get(chatId);
        if (!game || game.status !== 'DAY') return null;

        const voteTally = {};
        for (const target of game.dayVotes.values()) {
            if (target === 'skip') continue;
            voteTally[target] = (voteTally[target] || 0) + 1;
        }

        let lynched = null;
        let maxVotes = 0;
        let isTie = false;

        for (const [target, count] of Object.entries(voteTally)) {
            if (count > maxVotes) {
                maxVotes = count;
                lynched = target;
                isTie = false;
            } else if (count === maxVotes) {
                isTie = true;
            }
        }

        let lynchedPlayer = null;
        if (lynched && !isTie && maxVotes > 0) {
            lynchedPlayer = game.players.get(lynched);
            if (lynchedPlayer) {
                lynchedPlayer.alive = false;
            }
        }

        const win = WerewolfManager.checkVictory(game);

        if (win) {
            game.status = 'ENDED';
            return { win, lynchedPlayer, isTie, game };
        }

        // Siguiente noche
        game.status = 'NIGHT';
        game.round += 1;
        WerewolfManager.resetNightActions(game);

        return { win: null, lynchedPlayer, isTie, game };
    },

    /**
     * Comprueba si algún bando ha ganado
     */
    checkVictory: (game) => {
        const alivePlayers = Array.from(game.players.values()).filter(p => p.alive);
        const wolvesAlive = alivePlayers.filter(p => p.role === 'WOLF').length;
        const villagersAlive = alivePlayers.length - wolvesAlive;

        if (wolvesAlive === 0) {
            return 'VILLAGERS_WIN'; // La aldea elimina a todos los lobos
        }

        if (wolvesAlive >= villagersAlive) {
            return 'WOLVES_WIN'; // Los lobos igualan o superan a los humanos
        }

        return null; // El juego continúa
    },

    getRoleDescription: (role) => {
        switch (role) {
            case 'WOLF':
                return {
                    name: '🐺 Hombre Lobo',
                    desc: 'Tu misión es devorar a los aldeanos. Cada noche, ponte de acuerdo con los demás lobos y ataca con `.ww kill @usuario`.'
                };
            case 'SEER':
                return {
                    name: '🔮 Vidente',
                    desc: 'Posees la visión del más allá. Cada noche puedes inspeccionar el alma de un jugador con `.ww check @usuario` para descubrir si es lobo o inocente.'
                };
            case 'WITCH':
                return {
                    name: '🧙 Hechicero / Bruja',
                    desc: 'Tienes dos pociones mágicas de un solo uso:\n🧪 Salvación: salva a la víctima de los lobos con `.ww save`.\n☠️ Veneno: mata a un sospechoso con `.ww poison @usuario`.'
                };
            case 'VILLAGER':
            default:
                return {
                    name: '🌾 Aldeano Inocente',
                    desc: 'No posees poderes sobrenaturales. Tu arma más poderosa es la astucia, el debate y tu voto diario con `.ww vote @usuario` para linchar a los lobos.'
                };
        }
    }
};

module.exports = WerewolfManager;

