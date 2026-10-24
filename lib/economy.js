'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DB_PATH = path.join(__dirname, '../database/economy.json');

/**
 * Normaliza el JID del usuario
 */
function cleanJid(jid) {
    if (!jid) return '';
    return jid.replace(/:.*@/, '@').split('@')[0] + '@s.whatsapp.net';
}

/**
 * Formato de números con separadores de miles
 */
function formatNumber(num) {
    if (num === Infinity || num >= 999999999999) return '♾️ Infinito';
    return Number(num || 0).toLocaleString('es-DO');
}

/**
 * Convierte milisegundos en formato legible (ej: "3h 25m 10s")
 */
function formatDuration(ms) {
    if (ms <= 0) return '0s';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
}

const TRABAJOS = [
    { texto: 'Trabajaste como desarrollador web freelance y entregaste una web impecable 💻', min: 1200, max: 3200 },
    { texto: 'Cubriste el turno de noche en una cafetería y te dejaron excelentes propinas ☕', min: 800, max: 2000 },
    { texto: 'Hiciste delivery en bicicleta por la ciudad entregando todos los pedidos a tiempo 🚴', min: 900, max: 2200 },
    { texto: 'Ganaste un torneo competitivo de videojuegos en tu ciudad 🎮', min: 1500, max: 3500 },
    { texto: 'Diseñaste una identidad visual y logo publicitario para un negocio local 🎨', min: 1100, max: 2800 },
    { texto: 'Hiciste un análisis técnico en criptomonedas y cerraste la operación en verde 📈', min: 1400, max: 3800 },
    { texto: 'Reparaste el motor de un vehículo en el taller mecánico 🚗', min: 1000, max: 2600 },
    { texto: 'Transmitiste en vivo en streaming y tu comunidad te mandó donaciones 📹', min: 900, max: 2400 },
    { texto: 'Cocinas como chef en un banquete privado y los clientes quedaron encantados 🍳', min: 1300, max: 3100 },
    { texto: 'Vendiste artesanías y artículos retro en el mercado de fin de semana 🏺', min: 750, max: 1900 }
];

// Rangos de nivel y prestigio basados en EXP acumulada
const RANGOS = [
    { nivelMin: 100, nombre: 'Deidad Suprema 🌌', badge: '🌌' },
    { nivelMin: 76,  nombre: 'Gran Maestro Legendario 🔮', badge: '🔮' },
    { nivelMin: 51,  nombre: 'Campeón de Platino ⚡', badge: '⚡' },
    { nivelMin: 31,  nombre: 'Comandante de Oro 👑', badge: '👑' },
    { nivelMin: 16,  nombre: 'Guerrero de Plata 🛡️', badge: '🛡️' },
    { nivelMin: 6,   nombre: 'Aventurero de Bronce ⚔️', badge: '⚔️' },
    { nivelMin: 1,   nombre: 'Novato de Hierro 🥉', badge: '🥉' }
];

// Catálogo de artículos disponibles en la tienda oficial
const TIENDA_ITEMS = {
    titulo: {
        id: 'titulo',
        nombre: 'Título Personalizado 🏷️',
        precio: 5000,
        desc: 'Muestra un título exclusivo en tu perfil y ranking.',
        tipo: 'custom_text'
    },
    vip: {
        id: 'vip',
        nombre: 'Pase VIP / Premium 💎',
        precio: 25000,
        desc: 'Membresía Premium oficial del bot para comandos exclusivos.',
        tipo: 'premium'
    },
    espada: {
        id: 'espada',
        nombre: 'Espada de Batalla ⚔️',
        precio: 3000,
        desc: 'Aumenta permanentemente +30 puntos de Ataque para tus duelos.',
        tipo: 'stat_ataque',
        bonus: 30
    },
    escudo: {
        id: 'escudo',
        nombre: 'Escudo Blindado 🛡️',
        precio: 2500,
        desc: 'Aumenta permanentemente +25 puntos de Defensa para tus duelos.',
        tipo: 'stat_defensa',
        bonus: 25
    },
    pocion: {
        id: 'pocion',
        nombre: 'Poción de Experiencia 🧪',
        precio: 3500,
        desc: 'Otorga inmediatamente +400 de EXP para subir de nivel y rango.',
        tipo: 'exp',
        bonus: 400
    },
    seguro: {
        id: 'seguro',
        nombre: 'Seguro Anti-Robo 🔒',
        precio: 2000,
        desc: 'Protege tu dinero en mano contra asaltos y robos durante 24 horas.',
        tipo: 'shield_rob',
        duracionMs: 24 * 60 * 60 * 1000
    }
};

class EconomyManager {
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
            logger.error('Error cargando database/economy.json:', err.message);
            this.data = {};
        }
    }

    save() {
        try {
            const dir = path.dirname(DB_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf8');
        } catch (err) {
            logger.error('Error guardando database/economy.json:', err.message);
        }
    }

    /**
     * Obtiene el perfil económico de un usuario o crea uno nuevo por defecto
     */
    getUser(jid) {
        const id = cleanJid(jid);
        if (!this.data[id]) {
            this.data[id] = {
                monedas: 1000,      // Bono inicial de bienvenida
                banco: 0,
                level: 1,
                exp: 0,
                ataque: 15,
                defensa: 10,
                titulo: null,
                escudoAntiRobo: 0,
                inventario: {},
                juegosStats: {
                    monedasGanadas: 0,
                    expGanada: 0,
                    victorias: 0
                },
                deuda: {
                    monto: 0,
                    limite: null,
                    fechaInicio: null
                },
                lastDaily: 0,
                lastWork: 0,
                lastRob: 0,
                registered: true,
                createdAt: new Date().toISOString()
            };
            this.save();
        }

        // Asegurar campos para perfiles ya creados previamente
        const user = this.data[id];
        if (!user.juegosStats) user.juegosStats = { monedasGanadas: 0, expGanada: 0, victorias: 0 };
        if (!user.inventario) user.inventario = {};
        if (typeof user.escudoAntiRobo !== 'number') user.escudoAntiRobo = 0;

        return user;
    }

    updateUser(jid, partial) {
        const id = cleanJid(jid);
        const user = this.getUser(id);
        Object.assign(user, partial);
        this.save();
        return user;
    }

    addCoins(jid, amount) {
        const user = this.getUser(jid);
        user.monedas = Math.max(0, (user.monedas || 0) + Number(amount));
        this.save();
        return user.monedas;
    }

    removeCoins(jid, amount) {
        const user = this.getUser(jid);
        if ((user.monedas || 0) < amount) return false;
        user.monedas -= Number(amount);
        this.save();
        return true;
    }

    addExp(jid, amount) {
        const user = this.getUser(jid);
        user.exp = (user.exp || 0) + Number(amount);
        const reqExp = user.level * 250;
        let leveledUp = false;

        while (user.exp >= reqExp) {
            user.exp -= reqExp;
            user.level += 1;
            user.ataque += 5;
            user.defensa += 3;
            leveledUp = true;
        }

        this.save();
        return { level: user.level, exp: user.exp, leveledUp };
    }

    /**
     * Recompensa diaria (.diario / .daily) - Cada 24 horas
     */
    claimDaily(jid) {
        const user = this.getUser(jid);
        const ahora = Date.now();
        const COOLDOWN_MS = 24 * 60 * 60 * 1000;
        const tiempoPasado = ahora - (user.lastDaily || 0);

        if (tiempoPasado < COOLDOWN_MS) {
            const restante = COOLDOWN_MS - tiempoPasado;
            return {
                success: false,
                timeLeft: formatDuration(restante)
            };
        }

        const monedasGanadas = Math.floor(Math.random() * 5001) + 5000; // Entre 5,000 y 10,000
        const expGanada = 150;

        user.monedas = (user.monedas || 0) + monedasGanadas;
        user.lastDaily = ahora;
        const expInfo = this.addExp(jid, expGanada);

        this.save();

        return {
            success: true,
            monedas: monedasGanadas,
            exp: expGanada,
            totalMonedas: user.monedas,
            leveledUp: expInfo.leveledUp,
            nuevoNivel: expInfo.level
        };
    }

    /**
     * Trabajar (.trabajar / .work) - Cada 15 minutos
     */
    work(jid) {
        const user = this.getUser(jid);
        const ahora = Date.now();
        const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutos
        const tiempoPasado = ahora - (user.lastWork || 0);

        if (tiempoPasado < COOLDOWN_MS) {
            const restante = COOLDOWN_MS - tiempoPasado;
            return {
                success: false,
                timeLeft: formatDuration(restante)
            };
        }

        const trabajo = TRABAJOS[Math.floor(Math.random() * TRABAJOS.length)];
        const monedasGanadas = Math.floor(Math.random() * (trabajo.max - trabajo.min + 1)) + trabajo.min;
        const expGanada = Math.floor(Math.random() * 25) + 25;

        user.monedas = (user.monedas || 0) + monedasGanadas;
        user.lastWork = ahora;
        const expInfo = this.addExp(jid, expGanada);

        this.save();

        return {
            success: true,
            empleo: trabajo.texto,
            monedas: monedasGanadas,
            exp: expGanada,
            totalMonedas: user.monedas,
            leveledUp: expInfo.leveledUp,
            nuevoNivel: expInfo.level
        };
    }

    /**
     * Deposita dinero de la mano al banco
     */
    deposit(jid, amount) {
        const user = this.getUser(jid);

        let cant = 0;
        if (amount === 'all' || amount === 'todo') {
            cant = user.monedas;
        } else {
            cant = parseInt(amount, 10);
            if (isNaN(cant) || cant <= 0) return { success: false, error: 'Ingresa un monto válido a depositar.' };
        }

        if (cant <= 0) return { success: false, error: 'No tienes monedas en mano para depositar.' };
        if (user.monedas < cant) {
            return {
                success: false,
                error: `Saldo insuficiente. Tienes *$${formatNumber(user.monedas)}* en mano y deseas depositar *$${formatNumber(cant)}*.`
            };
        }

        user.monedas -= cant;
        user.banco = (user.banco || 0) + cant;
        this.save();

        return {
            success: true,
            depositado: cant,
            enMano: user.monedas,
            enBanco: user.banco
        };
    }

    /**
     * Retira dinero del banco a la mano
     */
    withdraw(jid, amount) {
        const user = this.getUser(jid);

        let cant = 0;
        if (amount === 'all' || amount === 'todo') {
            cant = user.banco;
        } else {
            cant = parseInt(amount, 10);
            if (isNaN(cant) || cant <= 0) return { success: false, error: 'Ingresa un monto válido a retirar.' };
        }

        if (cant <= 0) return { success: false, error: 'No tienes fondos guardados en el banco.' };
        if (user.banco < cant) {
            return {
                success: false,
                error: `Fondos insuficientes en el banco. Tienes *$${formatNumber(user.banco)}* y deseas retirar *$${formatNumber(cant)}*.`
            };
        }

        user.banco -= cant;
        user.monedas = (user.monedas || 0) + cant;
        this.save();

        return {
            success: true,
            retirado: cant,
            enMano: user.monedas,
            enBanco: user.banco
        };
    }

    /**
     * Transfiere dinero de un usuario a otro
     */
    transfer(fromJid, toJid, amount) {
        const sender = this.getUser(fromJid);
        const receiver = this.getUser(toJid);

        const cant = parseInt(amount, 10);
        if (isNaN(cant) || cant <= 0) return { success: false, error: 'Monto de transferencia inválido.' };
        if (cleanJid(fromJid) === cleanJid(toJid)) return { success: false, error: 'No puedes transferirte dinero a ti mismo.' };

        if (sender.monedas < cant) {
            return {
                success: false,
                error: `No tienes suficientes monedas en mano para transferir. Tienes *$${formatNumber(sender.monedas)}*.`
            };
        }

        sender.monedas -= cant;
        receiver.monedas = (receiver.monedas || 0) + cant;
        this.save();

        return {
            success: true,
            transferido: cant,
            remitenteSaldo: sender.monedas,
            destinatarioSaldo: receiver.monedas
        };
    }

    /**
     * Solicita un préstamo bancario (máximo 1,000,000, 5% interés, vence en 24h)
     */
    requestLoan(jid, amount) {
        const user = this.getUser(jid);

        if (user.deuda && user.deuda.monto > 0) {
            return {
                success: false,
                error: `Ya tienes una deuda activa de *$${formatNumber(user.deuda.monto)}*. Debes liquidarla antes de pedir otro préstamo.`
            };
        }

        const monto = Number(amount);
        if (isNaN(monto) || monto <= 0) {
            return { success: false, error: 'Ingresa un monto válido mayor a 0.' };
        }

        if (monto > 1000000) {
            return { success: false, error: 'El monto máximo permitido por préstamo es de *$1,000,000* monedas.' };
        }

        const totalPagar = Math.round(monto * 1.05); // 5% interés
        const duracionMs = 24 * 60 * 60 * 1000;      // 24 horas

        user.monedas = (user.monedas || 0) + monto;
        user.deuda = {
            monto: totalPagar,
            capital: monto,
            interesTotal: totalPagar - monto,
            limite: Date.now() + duracionMs,
            fechaInicio: new Date().toISOString()
        };

        this.save();

        return {
            success: true,
            capital: monto,
            totalPagar,
            limiteMs: user.deuda.limite
        };
    }

    /**
     * Paga parte o la totalidad de la deuda bancaria
     */
    payLoan(jid, amount) {
        const user = this.getUser(jid);

        if (!user.deuda || user.deuda.monto <= 0) {
            return { success: false, error: 'No tienes ninguna deuda pendiente con el banco.' };
        }

        let pagar = 0;
        if (amount === 'all' || amount === 'todo') {
            pagar = user.deuda.monto;
        } else {
            pagar = Number(amount);
            if (isNaN(pagar) || pagar <= 0) {
                return { success: false, error: 'Ingresa un monto válido a pagar.' };
            }
        }

        if (user.monedas < pagar) {
            return {
                success: false,
                error: `Saldo insuficiente en mano. Tienes *$${formatNumber(user.monedas)}* y necesitas *$${formatNumber(pagar)}*.`
            };
        }

        const montoEfectivo = Math.min(pagar, user.deuda.monto);
        user.monedas -= montoEfectivo;
        user.deuda.monto -= montoEfectivo;

        const liquidado = user.deuda.monto <= 0;
        if (liquidado) {
            user.deuda = { monto: 0, limite: null, fechaInicio: null };
        }

        this.save();

        return {
            success: true,
            pagado: montoEfectivo,
            restante: user.deuda.monto,
            liquidado,
            saldoRestante: user.monedas
        };
    }

    /**
     * Obtiene el estado y tiempo restante de la deuda activa
     */
    getLoanStatus(jid) {
        const user = this.getUser(jid);
        if (!user.deuda || user.deuda.monto <= 0) return null;

        const ahora = Date.now();
        const diffMs = user.deuda.limite ? user.deuda.limite - ahora : 0;
        const vencida = diffMs <= 0;

        let tiempoStr = 'Vencida';
        if (!vencida) {
            tiempoStr = `${formatDuration(diffMs)} restantes`;
        }

        return {
            monto: user.deuda.monto,
            capital: user.deuda.capital || user.deuda.monto,
            interes: user.deuda.interesTotal || 0,
            vencida,
            tiempoRestante: tiempoStr
        };
    }

    /**
     * Comando Cheat exclusivo para Owner: Maxea todas las estadísticas
     */
    cheatOwner(jid) {
        const user = this.getUser(jid);
        user.monedas = 999999999999;
        user.banco = 999999999999;
        user.level = 999;
        user.exp = 999999999;
        user.ataque = 99999;
        user.defensa = 99999;
        user.deuda = { monto: 0, limite: null, fechaInicio: null };
        this.save();
        return user;
    }

    /**
     * Obtiene el rango correspondiente a un nivel determinado
     */
    getRango(level) {
        const lvl = Number(level || 1);
        for (const r of RANGOS) {
            if (lvl >= r.nivelMin) return r;
        }
        return RANGOS[RANGOS.length - 1];
    }

    /**
     * Obtiene el rango de un usuario por su JID
     */
    getUserRank(jid) {
        const user = this.getUser(jid);
        return this.getRango(user.level);
    }

    /**
     * Añade saldo directamente al banco
     */
    addBank(jid, amount) {
        const user = this.getUser(jid);
        user.banco = Math.max(0, (user.banco || 0) + Number(amount));
        this.save();
        return user.banco;
    }

    /**
     * Resta saldo del banco
     */
    removeBank(jid, amount) {
        const user = this.getUser(jid);
        if ((user.banco || 0) < amount) return false;
        user.banco -= Number(amount);
        this.save();
        return true;
    }

    /**
     * Acredita recompensa de partidas de juegos directamente al banco + suma EXP y registra estadísticas
     */
    addGameReward(jid, coins, exp, groupId = null) {
        const user = this.getUser(jid);
        const c = Number(coins || 0);
        const e = Number(exp || 0);

        // 1. Las monedas ganadas en juegos van directo al banco
        user.banco = (user.banco || 0) + c;

        // 2. Acumular EXP y verificar subida de nivel
        const expInfo = this.addExp(jid, e);

        // 3. Registrar estadísticas de juegos del usuario
        user.juegosStats.monedasGanadas = (user.juegosStats.monedasGanadas || 0) + c;
        user.juegosStats.expGanada = (user.juegosStats.expGanada || 0) + e;
        user.juegosStats.victorias = (user.juegosStats.victorias || 0) + 1;

        // 4. Si se especifica grupo, registrar también para el top local del grupo
        if (groupId) {
            const cleanGroup = cleanJid(groupId);
            this.data._groupStats = this.data._groupStats || {};
            this.data._groupStats[cleanGroup] = this.data._groupStats[cleanGroup] || {};
            const cleanUser = cleanJid(jid);
            if (!this.data._groupStats[cleanGroup][cleanUser]) {
                this.data._groupStats[cleanGroup][cleanUser] = { monedas: 0, exp: 0, victorias: 0 };
            }
            this.data._groupStats[cleanGroup][cleanUser].monedas += c;
            this.data._groupStats[cleanGroup][cleanUser].exp += e;
            this.data._groupStats[cleanGroup][cleanUser].victorias += 1;
        }

        this.save();
        return {
            banco: user.banco,
            monedasGanadas: c,
            expGanada: e,
            level: expInfo.level,
            leveledUp: expInfo.leveledUp,
            rango: this.getRango(expInfo.level)
        };
    }

    /**
     * Compra un artículo en la tienda oficial descontando de mano o banco
     */
    buyStoreItem(jid, itemId, extraParam = '') {
        const id = (itemId || '').toLowerCase().trim();
        const item = TIENDA_ITEMS[id];
        if (!item) {
            return {
                success: false,
                error: 'El artículo solicitado no existe en la tienda. Escribe *.tienda* para ver el catálogo.'
            };
        }

        const user = this.getUser(jid);
        const totalDisponible = (user.monedas || 0) + (user.banco || 0);

        if (totalDisponible < item.precio) {
            return {
                success: false,
                error: `Fondos insuficientes. El artículo cuesta *$${formatNumber(item.precio)}* y tienes un total de *$${formatNumber(totalDisponible)}* ($${formatNumber(user.monedas)} en mano + $${formatNumber(user.banco)} en banco).`
            };
        }

        // Cobrar preferentemente en mano, y el remanente en banco
        let restanteCobro = item.precio;
        if (user.monedas >= restanteCobro) {
            user.monedas -= restanteCobro;
            restanteCobro = 0;
        } else {
            restanteCobro -= user.monedas;
            user.monedas = 0;
            user.banco -= restanteCobro;
        }

        let detalleEspecial = '';

        if (item.tipo === 'custom_text') {
            const nuevoTitulo = (extraParam || '').trim();
            if (!nuevoTitulo || nuevoTitulo.length < 2) {
                // Revertir cobro
                user.monedas += item.precio;
                return { success: false, error: 'Debes especificar el título que deseas comprar.\nEjemplo: *.comprar titulo Rey Supremo*' };
            }
            if (nuevoTitulo.length > 30) {
                user.monedas += item.precio;
                return { success: false, error: 'El título no puede exceder los 30 caracteres.' };
            }
            user.titulo = nuevoTitulo;
            detalleEspecial = `Tu título ahora es: *«${nuevoTitulo}»*`;
        } else if (item.tipo === 'premium') {
            try {
                const premium = require('./premium');
                premium.add(cleanJid(jid));
                detalleEspecial = '¡Membresía Premium activada exitosamente!';
            } catch (_) {
                detalleEspecial = 'Membresía registrada.';
            }
        } else if (item.tipo === 'stat_ataque') {
            user.ataque = (user.ataque || 15) + item.bonus;
            user.inventario.espadas = (user.inventario.espadas || 0) + 1;
            detalleEspecial = `¡Ataque aumentado a *${user.ataque}* pts (+${item.bonus})!`;
        } else if (item.tipo === 'stat_defensa') {
            user.defensa = (user.defensa || 10) + item.bonus;
            user.inventario.escudos = (user.inventario.escudos || 0) + 1;
            detalleEspecial = `¡Defensa aumentada a *${user.defensa}* pts (+${item.bonus})!`;
        } else if (item.tipo === 'exp') {
            const expRes = this.addExp(jid, item.bonus);
            detalleEspecial = `+${item.bonus} EXP acreditada. Nivel actual: *${expRes.level}* (${this.getRango(expRes.level).nombre})`;
        } else if (item.tipo === 'shield_rob') {
            const ahora = Date.now();
            const actual = user.escudoAntiRobo && user.escudoAntiRobo > ahora ? user.escudoAntiRobo : ahora;
            user.escudoAntiRobo = actual + item.duracionMs;
            detalleEspecial = `Escudo anti-robo activo durante 24 horas (vence en ${formatDuration(user.escudoAntiRobo - ahora)}).`;
        }

        this.save();
        return {
            success: true,
            item,
            detalleEspecial,
            saldoMano: user.monedas,
            saldoBanco: user.banco
        };
    }

    /**
     * Obtiene los primeros 5 ganadores de juegos de un grupo ordenados por ganancias
     */
    getTopGroupGamers(groupId, participants = [], limit = 5) {
        const cleanGroup = cleanJid(groupId);
        const groupLocalStats = (this.data._groupStats && this.data._groupStats[cleanGroup]) || {};

        const mapRecords = new Map();

        // 1. Estadísticas registradas directamente en este grupo
        for (const [userJid, data] of Object.entries(groupLocalStats)) {
            const u = this.getUser(userJid);
            mapRecords.set(userJid, {
                jid: userJid,
                monedas: data.monedas || 0,
                exp: data.exp || 0,
                victorias: data.victorias || 0,
                level: u.level || 1,
                rango: this.getRango(u.level || 1),
                titulo: u.titulo || null
            });
        }

        // 2. Si hay miembros de este grupo con historial en su perfil, integrarlos
        if (Array.isArray(participants) && participants.length > 0) {
            for (const p of participants) {
                const pJid = cleanJid(p.id || p.jid || p);
                if (pJid && !mapRecords.has(pJid) && this.data[pJid]) {
                    const u = this.data[pJid];
                    const jStats = u.juegosStats || {};
                    if ((jStats.monedasGanadas || 0) > 0 || (jStats.expGanada || 0) > 0) {
                        mapRecords.set(pJid, {
                            jid: pJid,
                            monedas: jStats.monedasGanadas || 0,
                            exp: jStats.expGanada || 0,
                            victorias: jStats.victorias || 0,
                            level: u.level || 1,
                            rango: this.getRango(u.level || 1),
                            titulo: u.titulo || null
                        });
                    }
                }
            }
        }

        const records = Array.from(mapRecords.values());
        // Ordenar por monedas ganadas (y EXP como desempate)
        records.sort((a, b) => (b.monedas + b.exp * 2) - (a.monedas + a.exp * 2));
        return records.slice(0, limit);
    }
}

module.exports = new EconomyManager();
module.exports.formatNumber = formatNumber;
module.exports.formatDuration = formatDuration;
module.exports.RANGOS = RANGOS;
module.exports.TIENDA_ITEMS = TIENDA_ITEMS;
