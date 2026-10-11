'use strict';

/**
 * lib/premium.js
 * Sistema de membresía Premium persistente en JSON.
 * Guarda en database/premium.json para sobrevivir reinicios del bot.
 */

const fs   = require('fs-extra');
const path = require('path');

const PREMIUM_FILE = path.join(__dirname, '..', 'database', 'premium.json');

// Asegurar que el archivo existe con estructura mínima
fs.ensureDirSync(path.dirname(PREMIUM_FILE));
if (!fs.existsSync(PREMIUM_FILE)) {
    fs.writeJsonSync(PREMIUM_FILE, { users: [] }, { spaces: 2 });
}

const load = () => {
    try {
        return fs.readJsonSync(PREMIUM_FILE);
    } catch {
        return { users: [] };
    }
};

const save = (data) => {
    try {
        fs.writeJsonSync(PREMIUM_FILE, data, { spaces: 2 });
    } catch (err) {
        console.error('[premium] Error guardando premium.json:', err.message);
    }
};

const premium = {
    /** Verifica si un JID tiene membresía premium (o es owner, siempre pasa) */
    isPremium: (jid) => {
        if (!jid) return false;
        const clean = jid.replace(/:\d+@/, '@');
        const data  = load();
        return data.users.some(u => u.jid === clean);
    },

    /** Agrega premium a un JID */
    add: (jid) => {
        const clean = jid.replace(/:\d+@/, '@');
        const data  = load();
        if (data.users.some(u => u.jid === clean)) return false; // ya existe
        const fecha = new Date().toLocaleString('es-DO', {
            timeZone: 'America/Santo_Domingo',
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        data.users.push({ jid: clean, fecha });
        save(data);
        return true;
    },

    /** Quita premium a un JID */
    remove: (jid) => {
        const clean = jid.replace(/:\d+@/, '@');
        const data  = load();
        const before = data.users.length;
        data.users = data.users.filter(u => u.jid !== clean);
        if (data.users.length === before) return false; // no existía
        save(data);
        return true;
    },

    /** Devuelve la lista completa de usuarios premium */
    list: () => {
        return load().users;
    }
};

module.exports = premium;
