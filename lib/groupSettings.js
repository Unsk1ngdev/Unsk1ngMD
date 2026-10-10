const fs = require('fs-extra');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');

// Memoria caché para rendimiento ultrarrápido y bajo consumo de RAM
let settingsCache = {};

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
        if (!jid) return {};
        if (!settingsCache[jid]) {
            settingsCache[jid] = {
                antilink: false,
                antispam: false,
                antispamkick: false,
                bienvenida: false
            };
            persist();
        }
        return settingsCache[jid];
    },

    /**
     * Actualiza un ajuste específico para un grupo
     */
    setSetting: (jid, key, value) => {
        if (!jid) return false;
        if (!settingsCache[jid]) {
            settingsCache[jid] = {
                antilink: false,
                antispam: false,
                antispamkick: false,
                bienvenida: false
            };
        }
        settingsCache[jid][key] = !!value;
        persist();
        return settingsCache[jid][key];
    },

    isAntilinkEnabled: (jid) => !!settingsCache[jid]?.antilink,
    isAntispamEnabled: (jid) => !!settingsCache[jid]?.antispam,
    isAntispamKickEnabled: (jid) => !!settingsCache[jid]?.antispamkick,
    isBienvenidaEnabled: (jid) => !!settingsCache[jid]?.bienvenida,

    getAll: () => ({ ...settingsCache })
};

module.exports = groupSettings;

