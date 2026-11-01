'use strict';

const economy = require('./economy');
const rpgManager = require('./rpgManager');

// Sesiones activas: `${chatId}_${userJid}` -> dungeonSession
const dungeonSessions = new Map();

const MONSTRUOS = [
    // Piso 1: Cavernas Subterráneas
    [
        { name: 'Goblin Ladrón 🧌', hp: 70, atq: 18, coins: 250, exp: 80, isBoss: false },
        { name: 'Murciélago Vampírico 🦇', hp: 55, atq: 22, coins: 200, exp: 70, isBoss: false },
        { name: 'Araña Venenosa 🕷️', hp: 80, atq: 20, coins: 300, exp: 90, isBoss: false },
        { name: 'Rey Goblin de las Sombras 👑🧌', hp: 200, atq: 35, coins: 1500, exp: 350, isBoss: true }
    ],
    // Piso 2: Cripta Prohibida
    [
        { name: 'Guerrero Esqueleto 💀⚔️', hp: 120, atq: 30, coins: 500, exp: 140, isBoss: false },
        { name: 'Espectro Errante 👻', hp: 100, atq: 38, coins: 600, exp: 160, isBoss: false },
        { name: 'Zombie Putrefacto 🧟', hp: 160, atq: 28, coins: 550, exp: 150, isBoss: false },
        { name: 'Nigromante Oscuro 🧙‍♂️💀', hp: 350, atq: 55, coins: 3500, exp: 700, isBoss: true }
    ],
    // Piso 3: Guarida del Dragón
    [
        { name: 'Cría de Dragón 🦎🔥', hp: 220, atq: 50, coins: 1200, exp: 300, isBoss: false },
        { name: 'Golem de Fuego 🗿🔥', hp: 320, atq: 45, coins: 1500, exp: 380, isBoss: false },
        { name: 'Caballero Negro 🛡️🗡️', hp: 260, atq: 60, coins: 1800, exp: 450, isBoss: false },
        { name: 'Dragón Rojo Ancestral 🐉🔥', hp: 700, atq: 85, coins: 10000, exp: 2000, isBoss: true }
    ]
];

const dungeonEngine = {
    getSession(chatId, userJid) {
        return dungeonSessions.get(`${chatId}_${userJid}`) || null;
    },

    start(chatId, userJid) {
        const key = `${chatId}_${userJid}`;
        const ecoUser = economy.getUser(userJid);
        const maxHp = 100 + (ecoUser.level || 1) * 12 + (ecoUser.defensa || 10) * 2;
        const atq = ecoUser.ataque || 20;
        const def = ecoUser.defensa || 10;

        const session = {
            chatId,
            userJid,
            piso: 1,
            sala: 1,
            hp: maxHp,
            maxHp,
            atq,
            def,
            monstruo: null,
            lootCoins: 0,
            lootExp: 0,
            lootItems: [],
            startedAt: Date.now()
        };

        dungeonSessions.set(key, session);
        return session;
    },

    explore(chatId, userJid) {
        const key = `${chatId}_${userJid}`;
        let session = dungeonSessions.get(key);
        if (!session) {
            session = this.start(chatId, userJid);
        }

        if (session.monstruo && session.monstruo.hp > 0) {
            return { error: 'MONSTER_ACTIVE', monstruo: session.monstruo, hp: session.hp, maxHp: session.maxHp };
        }

        // Si ya superó la sala 4 del piso actual, avanzar al siguiente piso
        if (session.sala >= 4) {
            session.piso += 1;
            session.sala = 1;

            if (session.piso > MONSTRUOS.length) {
                // ¡Mazmorra completada al 100%!
                const finalCoins = session.lootCoins + 10000;
                const finalExp = session.lootExp + 2500;
                economy.addCoins(userJid, finalCoins);
                const expRes = economy.addExp(userJid, finalExp);
                rpgManager.addItem(userJid, 'diamante', 3);
                dungeonSessions.delete(key);

                return {
                    completedAll: true,
                    lootCoins: finalCoins,
                    lootExp: finalExp,
                    leveledUp: expRes.leveledUp,
                    newLevel: expRes.level
                };
            }
        } else {
            session.sala += 1;
        }

        // Determinar evento de la sala
        const pisoData = MONSTRUOS[session.piso - 1] || MONSTRUOS[0];

        // Sala 4 siempre es el Jefe
        if (session.sala === 4) {
            const boss = pisoData[pisoData.length - 1];
            session.monstruo = { ...boss, maxHp: boss.hp };
            return {
                event: 'boss',
                monstruo: session.monstruo,
                session
            };
        }

        // Salas 1 a 3: 70% monstruo normal, 15% cofre, 15% santuario/trampa
        const rand = Math.random() * 100;
        if (rand < 70) {
            const normalMonsters = pisoData.slice(0, pisoData.length - 1);
            const m = normalMonsters[Math.floor(Math.random() * normalMonsters.length)];
            session.monstruo = { ...m, maxHp: m.hp };
            return { event: 'monster', monstruo: session.monstruo, session };
        } else if (rand < 85) {
            // Cofre del tesoro
            const chestCoins = Math.floor(Math.random() * 800) + 400;
            const chestExp = 120;
            session.lootCoins += chestCoins;
            session.lootExp += chestExp;
            return { event: 'chest', coins: chestCoins, exp: chestExp, session };
        } else {
            // Santuario de sanación
            const heal = Math.floor(session.maxHp * 0.4);
            session.hp = Math.min(session.maxHp, session.hp + heal);
            return { event: 'shrine', heal, session };
        }
    },

    attack(chatId, userJid) {
        const key = `${chatId}_${userJid}`;
        const session = dungeonSessions.get(key);
        if (!session || !session.monstruo || session.monstruo.hp <= 0) {
            return { error: 'NO_MONSTER' };
        }

        const m = session.monstruo;

        // Ataque del jugador
        const isCrit = Math.random() < 0.25;
        const baseDmg = Math.floor(session.atq * (0.85 + Math.random() * 0.4));
        const playerDmg = isCrit ? Math.floor(baseDmg * 1.8) : baseDmg;

        m.hp = Math.max(0, m.hp - playerDmg);

        // Si el monstruo muere
        if (m.hp <= 0) {
            session.lootCoins += m.coins;
            session.lootExp += m.exp;
            const deadMonster = { ...m };
            session.monstruo = null;

            return {
                monsterDead: true,
                monster: deadMonster,
                playerDmg,
                isCrit,
                lootCoins: deadMonster.coins,
                lootExp: deadMonster.exp,
                session
            };
        }

        // Contraataque del monstruo
        const monsterRaw = Math.floor(m.atq * (0.85 + Math.random() * 0.4));
        const mitigated = Math.max(5, monsterRaw - Math.floor(session.def * 0.3));
        session.hp = Math.max(0, session.hp - mitigated);

        // Si el jugador muere
        if (session.hp <= 0) {
            dungeonSessions.delete(key);
            // Pequeña penalización de monedas en mano (máx 500)
            economy.removeCoins(userJid, 500);
            return {
                playerDead: true,
                monster: m,
                playerDmg,
                isCrit,
                monsterDmg: mitigated
            };
        }

        return {
            roundOver: true,
            monster: m,
            playerDmg,
            isCrit,
            monsterDmg: mitigated,
            playerHp: session.hp,
            maxHp: session.maxHp
        };
    },

    usePotion(chatId, userJid) {
        const key = `${chatId}_${userJid}`;
        const session = dungeonSessions.get(key);
        if (!session) return { error: 'NO_SESSION' };

        const hasPotion = rpgManager.removeItem(userJid, 'pocion_vida', 1);
        if (!hasPotion) return { error: 'NO_POTION' };

        const heal = 120;
        session.hp = Math.min(session.maxHp, session.hp + heal);
        return { success: true, hp: session.hp, maxHp: session.maxHp, heal };
    },

    flee(chatId, userJid) {
        const key = `${chatId}_${userJid}`;
        const session = dungeonSessions.get(key);
        if (!session) return { error: 'NO_SESSION' };

        const savedCoins = Math.floor(session.lootCoins * 0.6);
        const savedExp = Math.floor(session.lootExp * 0.6);

        if (savedCoins > 0) economy.addCoins(userJid, savedCoins);
        if (savedExp > 0) economy.addExp(userJid, savedExp);

        dungeonSessions.delete(key);
        return { success: true, coins: savedCoins, exp: savedExp };
    }
};

module.exports = dungeonEngine;

