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

const OWNER_LIDS_FILE = path.join(DB_DIR, 'owner_lids.json');
const OWNERS_FILE = path.join(DB_DIR, 'owners.json');

// LIDs oficiales del creador
const KNOWN_DEFAULT_LIDS = [
    '265626966868143@lid'
];

let ownerLids = new Set(KNOWN_DEFAULT_LIDS);

try {
    if (fs.existsSync(OWNER_LIDS_FILE)) {
        const loaded = fs.readJsonSync(OWNER_LIDS_FILE);
        if (Array.isArray(loaded)) {
            loaded.forEach(l => {
                if (l) ownerLids.add(String(l).trim().toLowerCase());
            });
        }
    }
    fs.writeJsonSync(OWNER_LIDS_FILE, Array.from(ownerLids), { spaces: 2 });
} catch (err) {
    console.error('[DB] Error cargando owner_lids.json:', err.message);
}

const saveOwnerLids = () => {
    try {
        fs.writeJsonSync(OWNER_LIDS_FILE, Array.from(ownerLids), { spaces: 2 });
    } catch (_) {}
};

// Lista persistente de números de dueños (owners / bosses)
let ownerNumbersList = ['18494509905', '584160666286'];

try {
    if (fs.existsSync(OWNERS_FILE)) {
        const loaded = fs.readJsonSync(OWNERS_FILE);
        if (loaded && Array.isArray(loaded.numbers)) {
            ownerNumbersList = [...new Set([...ownerNumbersList, ...loaded.numbers])];
        }
    }
    fs.writeJsonSync(OWNERS_FILE, { numbers: ownerNumbersList }, { spaces: 2 });
} catch (err) {
    console.error('[DB] Error cargando owners.json:', err.message);
}

const saveOwners = () => {
    try {
        fs.writeJsonSync(OWNERS_FILE, { numbers: ownerNumbersList }, { spaces: 2 });
    } catch (_) {}
};

/**
 * Normaliza y extrae únicamente los dígitos del número de teléfono real del JID,
 * eliminando cualquier sufijo de multi-dispositivo (:1, :2, etc.) y descartando grupos
 */
const cleanUserNumber = (jid) => {
    if (!jid) return '';
    const raw = String(jid).trim();
    if (raw.endsWith('@g.us') || raw.includes('@broadcast')) return '';
    const withoutDevice = raw.replace(/:[0-9]+@/, '@');
    const userPart = withoutDevice.split('@')[0];
    return userPart.replace(/[^0-9]/g, '');
};

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

    // Métodos de administración de Owners y LIDs
    cleanUserNumber: (jid) => cleanUserNumber(jid),

    getOwnerNumbers: () => {
        const envOwners = (process.env.OWNER_NUMBER || '').split(',').map(n => cleanUserNumber(n)).filter(Boolean);
        const configOwners = (config.ownerNumbers || []).map(n => cleanUserNumber(n)).filter(Boolean);
        const list = [
            '18494509905',
            '584160666286',
            ...ownerNumbersList,
            ...envOwners,
            ...configOwners,
            config.ownerNumber
        ];
        const cleaned = list.map(n => (n ? cleanUserNumber(n) : '')).filter(Boolean);
        return [...new Set(cleaned)];
    },

    addOwnerNumber: (number) => {
        if (!number) return false;
        let clean = cleanUserNumber(number);
        if (['809', '829', '849'].some(c => clean.startsWith(c)) && clean.length === 10) {
            clean = '1' + clean;
        }
        if (clean.startsWith('04') && clean.length === 11) {
            clean = '58' + clean.slice(1);
        }
        if (!clean || clean.length < 8) return false;
        if (!ownerNumbersList.includes(clean)) {
            ownerNumbersList.push(clean);
            saveOwners();
        }
        return clean;
    },

    removeOwnerNumber: (number) => {
        if (!number) return false;
        const clean = cleanUserNumber(number);
        // Los dos números base del creador son inmutables
        if (clean === '18494509905' || clean === '584160666286') {
            return false;
        }
        const prevLen = ownerNumbersList.length;
        ownerNumbersList = ownerNumbersList.filter(n => n !== clean);
        if (ownerNumbersList.length !== prevLen) {
            saveOwners();
            return true;
        }
        return false;
    },

    getOwnerLids: () => Array.from(ownerLids),

    registerOwnerLid: (lid) => {
        if (!lid) return false;
        const clean = String(lid).replace(/:[0-9]+@/, '@').trim().toLowerCase();
        if (!clean.endsWith('@lid')) return false;
        if (!ownerLids.has(clean)) {
            ownerLids.add(clean);
            saveOwnerLids();
            console.log(`[DB] ✅ Nuevo LID de Owner registrado automáticamente: ${clean}`);
            return true;
        }
        return false;
    },

    syncOwnerLids: async (sock) => {
        if (!sock || typeof sock.onWhatsApp !== 'function') return [];
        try {
            const numbers = database.getOwnerNumbers();
            const results = await sock.onWhatsApp(...numbers);
            const foundLids = [];
            if (Array.isArray(results)) {
                for (const item of results) {
                    if (item && item.lid) {
                        const cleanLid = String(item.lid).replace(/:[0-9]+@/, '@').toLowerCase().trim();
                        database.registerOwnerLid(cleanLid);
                        foundLids.push(cleanLid);
                    }
                }
            }
            return foundLids;
        } catch (err) {
            console.error('[DB] Error sincronizando LIDs del owner con WhatsApp:', err.message);
            return [];
        }
    },

    // Verificación de Dueño infalible y estricta (no pública, solo dueños reales)
    isOwner: (senderJid, sock = null) => {
        if (!senderJid) return false;
        const raw = String(senderJid).trim().toLowerCase();
        if (raw.endsWith('@g.us') || raw.includes('status@broadcast')) return false;

        // 1. Si el remitente es la sesión del bot (o mensaje propio m.fromMe)
        if (sock && sock.user) {
            const botNum = cleanUserNumber(sock.user.id || sock.user.jid);
            const botLid = String(sock.user.lid || '').toLowerCase().trim();
            const cleanSender = cleanUserNumber(senderJid);
            if (botNum && cleanSender === botNum) return true;
            if (botLid && (raw === botLid || raw.split('@')[0] === botLid.split('@')[0])) return true;
        }

        const cleanSender = cleanUserNumber(senderJid);
        const ownerNums = database.getOwnerNumbers();

        // 2. Coincidencia exacta con número de teléfono
        if (cleanSender && ownerNums.includes(cleanSender)) return true;

        // 3. Normalizaciones estrictas de formato nacional
        if (cleanSender) {
            // Formato local Venezuela: 0416... -> 58416...
            if (cleanSender.startsWith('04') && cleanSender.length === 11) {
                const vzlaInt = '58' + cleanSender.slice(1);
                if (ownerNums.includes(vzlaInt)) return true;
            }
            // Formato local Rep. Dominicana: 849..., 809..., 829... (10 dígitos) -> 1849...
            if (['809', '829', '849'].some(code => cleanSender.startsWith(code)) && cleanSender.length === 10) {
                const domInt = '1' + cleanSender;
                if (ownerNums.includes(domInt)) return true;
            }
        }

        // 4. LIDs registrados y validados del creador (estricto)
        if (raw.endsWith('@lid')) {
            const cleanSenderLid = raw.replace(/:[0-9]+@/, '@');
            for (const lid of ownerLids) {
                const cleanLid = String(lid).toLowerCase().trim().replace(/:[0-9]+@/, '@');
                if (cleanSenderLid === cleanLid) {
                    return true;
                }
            }
        }

        return false;
    }
};

module.exports = database;

