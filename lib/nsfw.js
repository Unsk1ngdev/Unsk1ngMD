'use strict';

const fs = require('fs-extra');
const path = require('path');

const NSFW_FILE = path.join(process.cwd(), 'nsfw.json');

// Inicializar nsfw.json si no existe
const initNsfwFile = () => {
    try {
        if (!fs.existsSync(NSFW_FILE)) {
            fs.writeJsonSync(NSFW_FILE, { groups: [] }, { spaces: 2 });
        }
    } catch (e) {
        console.error('[NSFW] Error inicializando nsfw.json:', e.message);
    }
};

initNsfwFile();

const loadData = () => {
    try {
        if (!fs.existsSync(NSFW_FILE)) {
            initNsfwFile();
            return { groups: [] };
        }
        return fs.readJsonSync(NSFW_FILE);
    } catch (_) {
        return { groups: [] };
    }
};

const saveData = (data) => {
    try {
        fs.writeJsonSync(NSFW_FILE, data, { spaces: 2 });
        return true;
    } catch (e) {
        console.error('[NSFW] Error guardando nsfw.json:', e.message);
        return false;
    }
};

const nsfwManager = {
    isNsfwEnabled: (groupId) => {
        if (!groupId) return false;
        const data = loadData();
        return Array.isArray(data.groups) && data.groups.includes(groupId);
    },

    enableNsfw: (groupId) => {
        if (!groupId) return false;
        const data = loadData();
        if (!Array.isArray(data.groups)) data.groups = [];
        if (data.groups.includes(groupId)) return false; // ya activado
        data.groups.push(groupId);
        saveData(data);
        return true;
    },

    disableNsfw: (groupId) => {
        if (!groupId) return false;
        const data = loadData();
        if (!Array.isArray(data.groups)) return false;
        if (!data.groups.includes(groupId)) return false; // ya desactivado
        data.groups = data.groups.filter(g => g !== groupId);
        saveData(data);
        return true;
    },

    list: () => {
        const data = loadData();
        return Array.isArray(data.groups) ? data.groups : [];
    }
};

module.exports = nsfwManager;

