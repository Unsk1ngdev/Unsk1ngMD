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

// Caché volátil en RAM para recuperación segura de mensajes en Baileys getMessage()
const rawMessagesMap = new Map();
const MAX_RAW_MESSAGES = 500;

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

        // Guardar payload crudo en memoria volátil para getMessage de Baileys
        if (rawMsg.message) {
            rawMessagesMap.set(key.id, rawMsg.message);
            if (rawMessagesMap.size > MAX_RAW_MESSAGES) {
                const oldestKey = rawMessagesMap.keys().next().value;
                if (oldestKey) rawMessagesMap.delete(oldestKey);
            }
        }

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
     * Recupera el contenido real de un mensaje para la función getMessage de Baileys.
     * Retorna undefined si no está en caché (vital para prevenir bucles infinitos de reintentos).
     */
    getMessage: (key) => {
        if (!key || !key.id) return undefined;
        return rawMessagesMap.get(key.id) || undefined;
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
    },

    /**
     * Busca el mensaje más reciente emitido por un usuario (por JID, LID o número de teléfono)
     * buscando primero en el chat actual y luego en todos los demás chats guardados.
     */
    findLastMessageForUser: (chatJid, candidateIds = [], excludeId = null) => {
        const cleanIds = (Array.isArray(candidateIds) ? candidateIds : [candidateIds])
            .filter(Boolean)
            .map(id => String(id).replace(/:.*@/, '@').split('@')[0]);

        if (cleanIds.length === 0) return null;

        const checkList = (list, isGroup) => {
            if (!Array.isArray(list)) return null;
            for (let i = list.length - 1; i >= 0; i--) {
                const m = list[i];
                if (excludeId && m.id === excludeId) continue;
                if (!isGroup && m.fromMe) continue; // en privado ignorar mensajes enviados por el bot
                const p = String(m.participant || m.remoteJid || '').replace(/:.*@/, '@').split('@')[0];
                if (cleanIds.includes(p)) {
                    return m;
                }
            }
            return null;
        };

        // 1. Buscar en el chat actual
        if (chatJid && memoryCache[chatJid]) {
            const found = checkList(memoryCache[chatJid], chatJid.endsWith('@g.us'));
            if (found) return found;
        }

        // 2. Buscar en todos los demás chats en memoria
        for (const cJid of Object.keys(memoryCache)) {
            if (cJid === chatJid) continue;
            const found = checkList(memoryCache[cJid], cJid.endsWith('@g.us'));
            if (found) return found;
        }

        return null;
    }
};

module.exports = recentMessagesManager;
