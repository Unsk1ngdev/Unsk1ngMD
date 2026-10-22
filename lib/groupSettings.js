'use strict';

const fs = require('fs-extra');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');

// Memoria caché para rendimiento ultrarrápido y bajo consumo de RAM
let settingsCache = {};

const cleanJid = (jid) => (jid ? String(jid).replace(/:.*@/, '@').trim().toLowerCase() : '');

try {
    if (fs.existsSync(SETTINGS_FILE)) {
        settingsCache = fs.readJsonSync(SETTINGS_FILE);
    } else {
        fs.ensureFileSync(SETTINGS_FILE);
        fs.writeJsonSync(SETTINGS_FILE, settingsCache, { spaces: 2 });
    }
} catch (err) {
    console.error('[SETTINGS] Error inicializando settings.json:', err.message);
    settingsCache = {};
}

const persist = () => {
    try {
        fs.writeJsonSync(SETTINGS_FILE, settingsCache, { spaces: 2 });
    } catch (err) {
        console.error('[SETTINGS] Error guardando settings.json:', err.message);
    }
};

const groupSettings = {
    /**
     * Obtiene la configuración de un grupo con valores por defecto
     */
    getGroup: (jid) => {
        const key = cleanJid(jid);
        if (!key) return {};
        if (!settingsCache[key]) {
            settingsCache[key] = {
                antilink: false,
                antispam: false,
                antispamkick: false,
                bienvenida: false
            };
            persist();
        }
        return settingsCache[key];
    },

    /**
     * Actualiza un ajuste específico para un grupo
     */
    setSetting: (jid, key, value) => {
        const groupKey = cleanJid(jid);
        if (!groupKey) return false;
        if (!settingsCache[groupKey]) {
            settingsCache[groupKey] = {
                antilink: false,
                antispam: false,
                antispamkick: false,
                bienvenida: false
            };
        }
        settingsCache[groupKey][key] = Boolean(value);
        persist();
        return settingsCache[groupKey][key];
    },

    isAntilinkEnabled: (jid) => Boolean(settingsCache[cleanJid(jid)]?.antilink),
    isAntispamEnabled: (jid) => Boolean(settingsCache[cleanJid(jid)]?.antispam),
    isAntispamKickEnabled: (jid) => Boolean(settingsCache[cleanJid(jid)]?.antispamkick),
    isBienvenidaEnabled: (jid) => Boolean(settingsCache[cleanJid(jid)]?.bienvenida),

    getAll: () => ({ ...settingsCache })
};

module.exports = groupSettings;
