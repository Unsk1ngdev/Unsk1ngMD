'use strict';

const fs = require('fs-extra');
const path = require('path');

const RANK_FILE = path.join(process.cwd(), 'rank.json');

const initRank = () => {
    try {
        if (!fs.existsSync(RANK_FILE)) {
            fs.writeJsonSync(RANK_FILE, {}, { spaces: 2 });
        }
    } catch (e) {
        console.error('[RANK] Error inicializando rank.json:', e.message);
    }
};

initRank();

const loadData = () => {
    try {
        if (!fs.existsSync(RANK_FILE)) {
            initRank();
            return {};
        }
        return fs.readJsonSync(RANK_FILE);
    } catch (_) {
        return {};
    }
};

const saveData = (data) => {
    try {
        fs.writeJsonSync(RANK_FILE, data, { spaces: 2 });
        return true;
    } catch (e) {
        console.error('[RANK] Error guardando rank.json:', e.message);
        return false;
    }
};

const normalizeJid = (jid) => {
    if (!jid) return '';
    return jid.toString().replace(/:\d+@/, '@').trim();
};

const rankManager = {
    increment: (groupId, userId) => {
        if (!groupId || !userId) return;
        const cleanGroup = normalizeJid(groupId);
        const cleanUser = normalizeJid(userId);

        const data = loadData();
        if (!data[cleanGroup]) data[cleanGroup] = {};
        if (!data[cleanGroup][cleanUser]) data[cleanGroup][cleanUser] = 0;
        data[cleanGroup][cleanUser]++;

        saveData(data);
    },

    getRank: (groupId, limit = 10) => {
        if (!groupId) return [];
        const cleanGroup = normalizeJid(groupId);
        const data = loadData();
        const groupData = data[cleanGroup];
        if (!groupData || typeof groupData !== 'object') return [];

        return Object.entries(groupData)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit);
    }
};

module.exports = rankManager;

