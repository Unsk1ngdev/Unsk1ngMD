'use strict';

const fs = require('fs-extra');
const path = require('path');

const WARNS_FILE = path.join(__dirname, '../data/warns.json');
let warnsCache = {};

try {
    if (fs.existsSync(WARNS_FILE)) {
        warnsCache = fs.readJsonSync(WARNS_FILE);
    } else {
        fs.ensureFileSync(WARNS_FILE);
        fs.writeJsonSync(WARNS_FILE, warnsCache, { spaces: 2 });
    }
} catch (err) {
    console.error('[WARNS] Error cargando warns.json:', err.message);
    warnsCache = {};
}

const persist = () => {
    try {
        fs.writeJsonSync(WARNS_FILE, warnsCache, { spaces: 2 });
    } catch (e) {
        console.error('[WARNS] Error guardando warns.json:', e.message);
    }
};

const cleanJid = (id) => (id ? String(id).replace(/:.*@/, '@').split('@')[0] + '@s.whatsapp.net' : '');

const warnManager = {
    addWarn: (groupId, userJid, reason = 'Incumplimiento de normas') => {
        const gKey = cleanJid(groupId);
        const uKey = cleanJid(userJid);
        if (!gKey || !uKey) return { count: 0, reasons: [] };

        if (!warnsCache[gKey]) warnsCache[gKey] = {};
        if (!warnsCache[gKey][uKey]) {
            warnsCache[gKey][uKey] = { count: 0, reasons: [] };
        }

        warnsCache[gKey][uKey].count += 1;
        warnsCache[gKey][uKey].reasons.push({
            reason,
            date: new Date().toLocaleDateString('es-ES')
        });

        persist();
        return warnsCache[gKey][uKey];
    },

    removeWarn: (groupId, userJid) => {
        const gKey = cleanJid(groupId);
        const uKey = cleanJid(userJid);
        if (!warnsCache[gKey] || !warnsCache[gKey][uKey]) {
            return { count: 0 };
        }

        if (warnsCache[gKey][uKey].count > 0) {
            warnsCache[gKey][uKey].count -= 1;
            warnsCache[gKey][uKey].reasons.pop();
        }

        if (warnsCache[gKey][uKey].count === 0) {
            delete warnsCache[gKey][uKey];
        }

        persist();
        return warnsCache[gKey]?.[uKey] || { count: 0 };
    },

    resetWarns: (groupId, userJid) => {
        const gKey = cleanJid(groupId);
        const uKey = cleanJid(userJid);
        if (warnsCache[gKey] && warnsCache[gKey][uKey]) {
            delete warnsCache[gKey][uKey];
            persist();
        }
    },

    getWarns: (groupId, userJid) => {
        const gKey = cleanJid(groupId);
        const uKey = cleanJid(userJid);
        return warnsCache[gKey]?.[uKey] || { count: 0, reasons: [] };
    }
};

module.exports = warnManager;

