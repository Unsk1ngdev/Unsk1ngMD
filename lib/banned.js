'use strict';

const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

const BANNED_FILE = path.join(process.cwd(), 'banned.json');

// Inicializar banned.json si no existe
const initBannedFile = () => {
    try {
        if (!fs.existsSync(BANNED_FILE)) {
            fs.writeJsonSync(BANNED_FILE, { users: [], groups: [] }, { spaces: 2 });
        }
    } catch (e) {
        console.error('[BANNED] Error inicializando banned.json:', e.message);
    }
};

initBannedFile();

const normalizeJid = (jid) => {
    if (!jid) return '';
    return jid.toString().replace(/:\d+@/, '@').trim().toLowerCase();
};

const loadData = () => {
    try {
        if (!fs.existsSync(BANNED_FILE)) {
            initBannedFile();
            return { users: [], groups: [] };
        }
        const data = fs.readJsonSync(BANNED_FILE);
        if (!Array.isArray(data.users)) data.users = [];
        if (!Array.isArray(data.groups)) data.groups = [];
        return data;
    } catch (_) {
        return { users: [], groups: [] };
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

    // ── GESTIÓN DE GRUPOS BANEADOS (BANGROUP / UNBANGROUP) ──
    isGroupBanned: (jid) => {
        if (!jid) return false;
        const clean = normalizeJid(jid);
        if (!clean.endsWith('@g.us')) return false;
        const data = loadData();
        return Array.isArray(data.groups) && data.groups.some(g => normalizeJid(g.jid) === clean);
    },

    banGroup: (jid, name = '', reason = '', fecha = null) => {
        const clean = normalizeJid(jid);
        if (!clean.endsWith('@g.us')) return false;
        const data = loadData();
        if (!Array.isArray(data.groups)) data.groups = [];
        if (data.groups.some(g => normalizeJid(g.jid) === clean)) return false;

        const dateStr = fecha || new Date().toLocaleString('es-DO', {
            timeZone: 'America/Santo_Domingo'
        });

        data.groups.push({
            jid: clean,
            name: name || 'Grupo',
            reason: reason || 'Suspensión por Owner',
            fecha: dateStr
        });
        saveData(data);
        return true;
    },

    unbanGroup: (jid) => {
        const clean = normalizeJid(jid);
        const data = loadData();
        if (!Array.isArray(data.groups)) return false;

        const initialLen = data.groups.length;
        data.groups = data.groups.filter(g => normalizeJid(g.jid) !== clean);
        if (data.groups.length === initialLen) return false;

        saveData(data);
        return true;
    },

    listGroups: () => {
        const data = loadData();
        return Array.isArray(data.groups) ? data.groups : [];
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
