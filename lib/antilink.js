const fs = require('fs-extra');
const path = require('path');

const ANTILINK_FILE = path.join(__dirname, '../data/antilink.json');

// Memoria caché para lecturas rápidas sin I/O en cada mensaje
let antilinkCache = {};

try {
    if (fs.existsSync(ANTILINK_FILE)) {
        antilinkCache = fs.readJsonSync(ANTILINK_FILE);
    } else {
        fs.ensureFileSync(ANTILINK_FILE);
        fs.writeJsonSync(ANTILINK_FILE, antilinkCache, { spaces: 2 });
    }
} catch (err) {
    console.error('[ANTILINK] Error inicializando antilink.json:', err.message);
    antilinkCache = {};
}

const persistData = () => {
    try {
        fs.writeJsonSync(ANTILINK_FILE, antilinkCache, { spaces: 2 });
    } catch (err) {
        console.error('[ANTILINK] Error guardando antilink.json:', err.message);
    }
};

const antilinkManager = {
    /**
     * Comprueba si el antienlace está habilitado para un grupo
     */
    isEnabled: (groupId) => {
        if (!groupId) return false;
        return !!antilinkCache[groupId];
    },

    /**
     * Habilita o deshabilita el antienlace en un grupo
     */
    setStatus: (groupId, enabled) => {
        if (!groupId) return false;
        antilinkCache[groupId] = !!enabled;
        persistData();
        return antilinkCache[groupId];
    },

    /**
     * Obtiene el listado completo de configuraciones
     */
    getAll: () => ({ ...antilinkCache })
};

module.exports = antilinkManager;
