'use strict';

const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

const BANNED_FILE = path.join(process.cwd(), 'banned.json');

// Inicializar banned.json si no existe
const initBannedFile = () => {
    try {
        if (!fs.existsSync(BANNED_FILE)) {
            fs.writeJsonSync(BANNED_FILE, { users: [] }, { spaces: 2 });
        }
    } catch (e) {
        console.error('[BANNED] Error inicializando banned.json:', e.message);
    }
};

initBannedFile();

const normalizeJid = (jid) => {
    if (!jid) return '';
    return jid.toString().replace(/:\d+@/, '@').trim();
};

const loadData = () => {
    try {
        if (!fs.existsSync(BANNED_FILE)) {
            initBannedFile();
            return { users: [] };
        }
        return fs.readJsonSync(BANNED_FILE);
    } catch (_) {
        return { users: [] };
    }
};

const saveData = (data) => {
    try {
        fs.writeJsonSync(BANNED_FILE, data, { spaces: 2 });
        return true;
    } catch (e) {
        console.error('[BANNED] Error guardando banned.json:', e.message);
        return false;
    }
};

const bannedManager = {
    isBanned: (jid) => {
        if (!jid) return false;
        const clean = normalizeJid(jid);
        const data = loadData();
        return Array.isArray(data.users) && data.users.some(u => normalizeJid(u.jid) === clean);
    },

    banUser: (jid, fecha) => {
        const clean = normalizeJid(jid);
        const data = loadData();
        if (!Array.isArray(data.users)) data.users = [];
        if (data.users.some(u => normalizeJid(u.jid) === clean)) return false;

        const dateStr = fecha || new Date().toLocaleString('es-DO', {
            timeZone: 'America/Santo_Domingo'
        });

        data.users.push({ jid: clean, fecha: dateStr });
        saveData(data);
        return true;
    },

    unbanUser: (jid) => {
        const clean = normalizeJid(jid);
        const data = loadData();
        if (!Array.isArray(data.users)) return false;

        const initialLen = data.users.length;
        data.users = data.users.filter(u => normalizeJid(u.jid) !== clean);
        if (data.users.length === initialLen) return false;

        saveData(data);
        return true;
    },

    list: () => {
        const data = loadData();
        return Array.isArray(data.users) ? data.users : [];
    },

    isOwner: (jid) => {
        if (!jid) return false;
        try {
            const database = require('./database');
            return database.isOwner(jid);
        } catch (_) {
            const clean = String(jid).replace(/:[0-9]+@/, '@').split('@')[0].replace(/[^0-9]/g, '');
            return ['18494509905', '584160666286'].includes(clean);
        }
    }
};

module.exports = bannedManager;

