'use strict';

const fs = require('fs');
const path = require('path');
const economy = require('./economy');
const logger = require('./logger');

const DB_PATH = path.join(__dirname, '../database/missions.json');

/**
 * Catálogo maestro de misiones diarias posibles
 */
const CATALOGO_MISIONES = [
    {
        key: 'trabajar',
        titulo: 'Jornada Laboral 💼',
        desc: 'Trabaja 2 veces en cualquier oficio usando .trabajar',
        target: 2,
        recompensaMonedas: 2500,
        recompensaExp: 100
    },
    {
        key: 'apostar',
        titulo: 'Apostador Audaz 🎲',
        desc: 'Realiza 2 apuestas en el casino con .apostar o .slots',
        target: 2,
        recompensaMonedas: 3000,
        recompensaExp: 120
    },
    {
        key: 'cofre',
        titulo: 'Cazador de Tesoros 📦',
        desc: 'Abre 1 cofre misterioso con .cofre',
        target: 1,
        recompensaMonedas: 2000,
        recompensaExp: 80
    },
    {
        key: 'trivia',
        titulo: 'Mente Maestra 🧠',
        desc: 'Responde correctamente a 1 pregunta en .trivia',
        target: 1,
        recompensaMonedas: 2500,
        recompensaExp: 100
    },
    {
        key: 'diario',
        titulo: 'Constancia Diaria 🎁',
        desc: 'Reclama tu bono diario de monedas con .diario',
        target: 1,
        recompensaMonedas: 1500,
        recompensaExp: 60
    },
    {
        key: 'robar',
        titulo: 'Ladrón de Sombras 🦹‍♂️',
        desc: 'Intenta asaltar las monedas de otro usuario con .robar',
        target: 1,
        recompensaMonedas: 2000,
        recompensaExp: 80
    }
];

const BONUS_TODAS_MISIONES = {
    monedas: 5000,
    exp: 200
};

class MissionsManager {
    constructor() {
        this.data = {};
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(DB_PATH)) {
                const raw = fs.readFileSync(DB_PATH, 'utf8');
                this.data = JSON.parse(raw);
            } else {
                this.data = {};
                this.save();
            }
        } catch (err) {
            logger.error('Error cargando database/missions.json:', err.message);
            this.data = {};
        }
    }

    save() {
        try {
            const dir = path.dirname(DB_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf8');
        } catch (err) {
            logger.error('Error guardando database/missions.json:', err.message);
        }
    }

    /**
     * Retorna la fecha actual en formato YYYY-MM-DD
     */
    getTodayKey() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /**
     * Normaliza el JID del usuario
     */
    cleanJid(jid) {
        if (!jid) return '';
        return jid.replace(/:.*@/, '@').split('@')[0] + '@s.whatsapp.net';
    }

    /**
     * Generador de números pseudo-aleatorios con semilla (para consistencia por día/usuario)
     */
    seededRandom(seedStr) {
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
            hash = (hash << 5) - hash + seedStr.charCodeAt(i);
            hash |= 0;
        }
        const x = Math.sin(hash++) * 10000;
        return x - Math.floor(x);
    }

    /**
     * Obtiene o genera las 3 misiones diarias del usuario para el día de hoy
     */
    getUserMissions(jid) {
        const id = this.cleanJid(jid);
        const today = this.getTodayKey();

        if (!this.data[id]) {
            this.data[id] = {};
        }

        // Si ya tiene misiones para hoy, retornarlas
        if (this.data[id][today]) {
            return this.data[id][today];
        }

        // Si es un nuevo día, generar 3 misiones seleccionadas del catálogo
        const seedBase = `${id}_${today}`;
        const shuffled = [...CATALOGO_MISIONES].sort((a, b) => {
            return this.seededRandom(seedBase + a.key) - this.seededRandom(seedBase + b.key);
        });

        const selected = shuffled.slice(0, 3).map((item, idx) => ({
            id: idx + 1,
            key: item.key,
            titulo: item.titulo,
            desc: item.desc,
            target: item.target,
            current: 0,
            recompensaMonedas: item.recompensaMonedas,
            recompensaExp: item.recompensaExp,
            completed: false,
            claimed: false
        }));

        const record = {
            date: today,
            missions: selected,
            bonusClaimed: false
        };

        this.data[id][today] = record;
        this.save();
        return record;
    }

    /**
     * Registra progreso en las misiones del usuario
     */
    recordProgress(jid, missionKey, amount = 1) {
        if (!jid || !missionKey) return [];
        const record = this.getUserMissions(jid);
        const updated = [];

        for (const m of record.missions) {
            if (m.key === missionKey && !m.completed) {
                m.current = Math.min(m.target, (m.current || 0) + amount);
                if (m.current >= m.target) {
                    m.completed = true;
                }
                updated.push(m);
            }
        }

        if (updated.length > 0) {
            this.save();
        }
        return updated;
    }

    /**
     * Reclama una o todas las misiones completadas
     */
    claim(jid, targetId = 'all') {
        const record = this.getUserMissions(jid);
        let totalCoins = 0;
        let totalExp = 0;
        const claimedList = [];

        const isClaimAll = !targetId || targetId === 'all' || targetId === 'todo' || targetId === 'todas';

        for (const m of record.missions) {
            const matches = isClaimAll || String(m.id) === String(targetId);
            if (matches && m.completed && !m.claimed) {
                m.claimed = true;
                totalCoins += m.recompensaMonedas;
                totalExp += m.recompensaExp;
                claimedList.push(m);
            }
        }

        // Comprobar si se completaron y reclamaron las 3 misiones para dar el bonus
        let gotBonus = false;
        const allCompleted = record.missions.every(m => m.completed);
        const allClaimed = record.missions.every(m => m.claimed);

        if (allCompleted && allClaimed && !record.bonusClaimed) {
            record.bonusClaimed = true;
            totalCoins += BONUS_TODAS_MISIONES.monedas;
            totalExp += BONUS_TODAS_MISIONES.exp;
            gotBonus = true;
        }

        if (totalCoins > 0 || totalExp > 0) {
            if (totalCoins > 0) economy.addCoins(jid, totalCoins);
            if (totalExp > 0) economy.addExp(jid, totalExp);
            this.save();
        }

        return {
            claimedCount: claimedList.length,
            claimedMissions: claimedList,
            totalCoins,
            totalExp,
            gotBonus,
            bonusCoins: BONUS_TODAS_MISIONES.monedas,
            bonusExp: BONUS_TODAS_MISIONES.exp
        };
    }

    /**
     * Genera una barra visual de progreso
     */
    renderBar(current, target, totalBlocks = 8) {
        const ratio = Math.max(0, Math.min(1, target > 0 ? current / target : 0));
        const filled = Math.round(ratio * totalBlocks);
        const empty = totalBlocks - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }
}

module.exports = new MissionsManager();

