const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

// Rutas de almacenamiento JSON
const DB_DIR = config.databaseDir;
const SETTINGS_FILE = path.join(DB_DIR, 'settings.json');
const GROUPS_FILE = path.join(DB_DIR, 'groups.json');

// Inicialización de directorios y estructuras base
fs.ensureDirSync(DB_DIR);

let settings = {
    prefix: config.defaultPrefix,
    mode: config.defaultMode,
    totalCommandsExecuted: 0
};

let groups = {};

// Carga inicial segura
try {
    if (fs.existsSync(SETTINGS_FILE)) {
        settings = { ...settings, ...fs.readJsonSync(SETTINGS_FILE) };
    } else {
        fs.writeJsonSync(SETTINGS_FILE, settings, { spaces: 2 });
    }
} catch (err) {
    console.error('[DB] Error cargando settings.json:', err.message);
}

try {
    if (fs.existsSync(GROUPS_FILE)) {
        groups = fs.readJsonSync(GROUPS_FILE);
    } else {
        fs.writeJsonSync(GROUPS_FILE, groups, { spaces: 2 });
    }
} catch (err) {
    console.error('[DB] Error cargando groups.json:', err.message);
}

// Guardado atómico con debounce para evitar bloqueos de I/O en RAM
let saveSettingsTimeout = null;
const saveSettings = () => {
    if (saveSettingsTimeout) clearTimeout(saveSettingsTimeout);
    saveSettingsTimeout = setTimeout(() => {
        try {
            fs.writeJsonSync(SETTINGS_FILE, settings, { spaces: 2 });
        } catch (err) {
            console.error('[DB] Error guardando settings:', err.message);
        }
    }, 500);
};

let saveGroupsTimeout = null;
const saveGroups = () => {
    if (saveGroupsTimeout) clearTimeout(saveGroupsTimeout);
    saveGroupsTimeout = setTimeout(() => {
        try {
            fs.writeJsonSync(GROUPS_FILE, groups, { spaces: 2 });
        } catch (err) {
            console.error('[DB] Error guardando groups:', err.message);
        }
    }, 500);
};

const database = {
    // Configuración global
    getSettings: () => ({ ...settings }),
    
    getPrefix: () => settings.prefix || config.defaultPrefix,
    setPrefix: (newPrefix) => {
        settings.prefix = newPrefix;
        saveSettings();
        return settings.prefix;
    },

    getMode: () => settings.mode || config.defaultMode,
    setMode: (newMode) => {
        settings.mode = newMode === 'private' ? 'private' : 'public';
        saveSettings();
        return settings.mode;
    },

    incrementCommandCount: () => {
        settings.totalCommandsExecuted = (settings.totalCommandsExecuted || 0) + 1;
        saveSettings();
    },

    // Gestión de Grupos
    getGroup: (groupId) => {
        if (!groups[groupId]) {
            groups[groupId] = {
                antilink: false,
                welcome: false,
                mute: false
            };
            saveGroups();
        }
        return groups[groupId];
    },

    setAntilink: (groupId, enabled) => {
        const group = database.getGroup(groupId);
        group.antilink = !!enabled;
        groups[groupId] = group;
        saveGroups();
        try {
            const groupSettings = require('./groupSettings');
            groupSettings.setSetting(groupId, 'antilink', enabled);
        } catch (_) {}
        try {
            const antilinkManager = require('./antilink');
            antilinkManager.setStatus(groupId, enabled);
        } catch (_) {}
        return group.antilink;
    },

    isAntilinkEnabled: (groupId) => {
        try {
            const groupSettings = require('./groupSettings');
            if (groupSettings.isAntilinkEnabled(groupId)) return true;
        } catch (_) {}
        try {
            const antilinkManager = require('./antilink');
            return antilinkManager.isEnabled(groupId);
        } catch (_) {
            return !!groups[groupId]?.antilink;
        }
    },

    // Verificación de Dueño
    isOwner: (senderJid) => {
        if (!senderJid) return false;
        const cleanSender = senderJid.replace(/[^0-9]/g, '');
        const cleanOwner = config.ownerNumber.replace(/[^0-9]/g, '');
        if (cleanSender === cleanOwner) return true;
        return config.owners.some(owner => owner.replace(/[^0-9]/g, '') === cleanSender);
    }
};

module.exports = database;

