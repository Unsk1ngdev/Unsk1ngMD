'use strict';

const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');

const STORAGE_FILE = path.join(__dirname, '../database/recentMessages.json');
const MAX_MESSAGES_PER_CHAT = 300;
const MAX_AGE_MS = 40 * 60 * 60 * 1000; // 40 horas (WhatsApp no permite revocar mensajes más antiguos)

// Caché en memoria
let memoryCache = {};
let saveTimeout = null;

const pruneOldMessages = (cache) => {
    const now = Date.now();
    for (const chatJid of Object.keys(cache)) {
        if (Array.isArray(cache[chatJid])) {
            cache[chatJid] = cache[chatJid].filter(m => !m.timestamp || (now - m.timestamp <= MAX_AGE_MS));
            if (cache[chatJid].length === 0) {
                delete cache[chatJid];
            }
        }
    }
};

const initStorage = () => {
    try {
        if (fs.existsSync(STORAGE_FILE)) {
            memoryCache = fs.readJsonSync(STORAGE_FILE);
            pruneOldMessages(memoryCache);
        } else {
            fs.ensureDirSync(path.dirname(STORAGE_FILE));
            fs.writeJsonSync(STORAGE_FILE, {});
            memoryCache = {};
        }
    } catch (_) {
        memoryCache = {};
    }
};

initStorage();

const scheduleSave = () => {
    if (saveTimeout) return;
    saveTimeout = setTimeout(() => {
        try {
            pruneOldMessages(memoryCache);
            fs.writeJsonSync(STORAGE_FILE, memoryCache);
        } catch (e) {
            logger.warn('[RECENT_MESSAGES] Error guardando en disco:', e.message);
        }
        saveTimeout = null;
    }, 1500);
};

const recentMessagesManager = {
    /**
     * Registra un mensaje entrante o saliente de grupo o privado
     */
    add: (rawMsg) => {
        if (!rawMsg || !rawMsg.key) return;
        const key = rawMsg.key;
        const chatJid = key.remoteJid || rawMsg.chat || '';
        if (!chatJid || chatJid === 'status@broadcast' || !key.id) return;

        if (!memoryCache[chatJid]) {
            memoryCache[chatJid] = [];
        }

        const msgList = memoryCache[chatJid];
        // Evitar duplicados por ID
        if (msgList.some(item => item.id === key.id)) return;

        const fromMe = Boolean(key.fromMe);
        const participant = key.participant || rawMsg.participant || undefined;

        msgList.push({
            id: key.id,
            remoteJid: chatJid,
            fromMe,
            participant,
            timestamp: Date.now()
        });

        if (msgList.length > MAX_MESSAGES_PER_CHAT) {
            msgList.shift();
        }

        global.mensajesRecientes = memoryCache;
        scheduleSave();
    },

    /**
     * Obtiene los últimos N mensajes de un chat excluyendo un ID específico (ej. el comando actual)
     * Retorna los mensajes ordenados del MÁS RECIENTE al más antiguo
     */
    getRecent: (chatJid, count = 10, excludeId = null) => {
        if (!chatJid || !memoryCache[chatJid]) return [];
        const now = Date.now();
        const list = memoryCache[chatJid];
        const valid = list.filter(m => {
            if (excludeId && m.id === excludeId) return false;
            if (m.timestamp && (now - m.timestamp > MAX_AGE_MS)) return false;
            return true;
        });
        // slice(-count) toma los últimos N y .reverse() los entrega de más nuevo a más viejo
        return valid.slice(-count).reverse();
    },

    /**
     * Remueve mensajes eliminados de la memoria y persiste
     */
    remove: (chatJid, ids = []) => {
        if (!chatJid || !memoryCache[chatJid] || !ids.length) return;
        const setIds = new Set(ids);
        memoryCache[chatJid] = memoryCache[chatJid].filter(m => !setIds.has(m.id));
        global.mensajesRecientes = memoryCache;
        scheduleSave();
    },

    /**
     * Cuenta total de mensajes vigentes registrados en un chat
     */
    count: (chatJid, excludeId = null) => {
        if (!chatJid || !memoryCache[chatJid]) return 0;
        const now = Date.now();
        const list = memoryCache[chatJid];
        return list.filter(m => {
            if (excludeId && m.id === excludeId) return false;
            if (m.timestamp && (now - m.timestamp > MAX_AGE_MS)) return false;
            return true;
        }).length;
    }
};

module.exports = recentMessagesManager;
