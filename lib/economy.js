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
                deuda: {
                    monto: 0,
                    limite: null,
                    fechaInicio: null
                },
                lastDaily: 0,
                lastWork: 0,
                registered: true,
                createdAt: new Date().toISOString()
            };
            this.save();
        }
        return this.data[id];
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
}

module.exports = new EconomyManager();
module.exports.formatNumber = formatNumber;
module.exports.formatDuration = formatDuration;
