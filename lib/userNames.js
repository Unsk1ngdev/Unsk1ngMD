'use strict';

const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');

const STORAGE_FILE = path.join(__dirname, '../database/userNames.json');
let cache = {};
let saveTimeout = null;

const init = () => {
    try {
        if (fs.existsSync(STORAGE_FILE)) {
            cache = fs.readJsonSync(STORAGE_FILE);
        } else {
            fs.ensureDirSync(path.dirname(STORAGE_FILE));
            fs.writeJsonSync(STORAGE_FILE, {});
            cache = {};
        }
    } catch (_) {
        cache = {};
    }
    // Mapeo inicial de Owners conocidos
    cache['_lid_265626966868143@lid'] = '18494509905';
    cache['_lid_265626966868143'] = '18494509905';
    cache['_phone_18494509905'] = '265626966868143';
    cache['_lid_86716094365916@lid'] = '584160666286';
    cache['_lid_86716094365916'] = '584160666286';
    cache['_phone_584160666286'] = '86716094365916';

    // Indexar mapeos inversos (_phone_) a partir de los _lid_ existentes
    try {
        for (const k of Object.keys(cache)) {
            if (k.startsWith('_lid_')) {
                const lidPart = k.replace('_lid_', '').split('@')[0];
                const phonePart = String(cache[k] || '').replace(/[^0-9]/g, '');
                if (lidPart && phonePart && lidPart !== phonePart && phonePart.length >= 7 && phonePart.length <= 15) {
                    if (!cache['_phone_' + phonePart]) {
                        cache['_phone_' + phonePart] = lidPart;
                    }
                }
            }
        }
    } catch (_) {}
};

init();

const scheduleSave = () => {
    if (saveTimeout) return;
    saveTimeout = setTimeout(() => {
        try {
            fs.writeJsonSync(STORAGE_FILE, cache);
        } catch (e) {
            logger.warn('[USER_NAMES] Error guardando userNames.json:', e.message);
        }
        saveTimeout = null;
    }, 2000);
};

const cleanJid = (jid) => {
    if (!jid) return '';
    return String(jid).replace(/:.*@/, '@').trim().toLowerCase();
};

const getIdPart = (jid) => {
    if (!jid) return '';
    const cleaned = cleanJid(jid);
    return cleaned.split('@')[0].replace(/^@/, '');
};

const getPhoneNum = (jid) => {
    if (!jid) return '';
    const cleaned = cleanJid(jid);
    if (cleaned.endsWith('@lid')) return '';
    return cleaned.split('@')[0].replace(/[^0-9]/g, '');
};

const userNames = {
    /**
     * Registra o actualiza el nombre visible de un usuario
     * @param {string} jid JID o número del usuario
     * @param {string} name Nombre (pushName o nombre de contacto)
     */
    set: (jid, name) => {
        if (!jid || !name) return;
        const trimmed = String(name).trim();
        if (!trimmed) return;
        if (trimmed === 'Sin Nombre' || trimmed === 'Usuario' || trimmed === 'Alguien' || trimmed === 'null' || trimmed === 'undefined') return;
        if (/^@?[0-9]+$/.test(trimmed)) return; // Evitar sobreescribir con solo dígitos

        const key = cleanJid(jid);
        const idPart = getIdPart(jid);
        const num = getPhoneNum(jid);

        cache[key] = trimmed;
        if (idPart) cache[idPart] = trimmed;
        if (num) cache[num] = trimmed;

        scheduleSave();
    },

    /**
     * Obtiene el nombre registrado del usuario.
     * Si no se detecta ningún nombre, devuelve su ID/JID formateado con '@'.
     * @param {string} jid JID del usuario
     * @param {string|null} fallbackName Nombre alternativo si no se encuentra
     * @returns {string} Nombre del usuario o @ID / @JID
     */
    get: (jid, fallbackName = null) => {
        if (!jid) return fallbackName || 'Alguien';
        const key = cleanJid(jid);
        const idPart = getIdPart(jid);
        const num = getPhoneNum(jid);

        // 1. Si tenemos el nombre registrado en caché
        if (cache[key]) return cache[key];
        if (idPart && cache[idPart]) return cache[idPart];
        if (num && cache[num]) return cache[num];

        // 2. Si es un LID vinculado a un teléfono que sí tiene nombre registrado
        const linkedPhone = cache['_lid_' + key] || (idPart ? cache['_lid_' + idPart] : null);
        if (linkedPhone) {
            if (cache[linkedPhone]) return cache[linkedPhone];
            if (cache[`${linkedPhone}@s.whatsapp.net`]) return cache[`${linkedPhone}@s.whatsapp.net`];
        }

        // 3. Si se proporciona un fallback explícito válido (que no sea genérico)
        if (fallbackName && fallbackName !== 'Sin Nombre' && fallbackName !== 'Usuario' && fallbackName !== 'Alguien') {
            return fallbackName;
        }

        // 4. Si no se detecta ningún nombre, dejar su ID/JID con @ (para mención activa)
        if (linkedPhone) return `@${linkedPhone}`;
        if (idPart) return `@${idPart}`;
        if (num) return `@${num}`;

        return 'Alguien';
    },

    /**
     * Formatea el nombre asegurando que si no tiene nombre registrado,
     * use su ID/JID con prefijo @
     */
    formatName: (jid, pushName = null) => {
        if (!jid) return pushName || 'Alguien';
        if (pushName && pushName !== 'Sin Nombre' && pushName !== 'Usuario') {
            userNames.set(jid, pushName);
            return pushName;
        }
        return userNames.get(jid);
    },

    /**
     * Asocia un LID de WhatsApp con su número de teléfono real
     * @param {string} lid LID del usuario (ej. 265626966868143@lid)
     * @param {string} phone Número de teléfono (ej. 18494509905)
     */
    linkLid: (lid, phone) => {
        if (!lid || !phone) return;
        const cleanL = cleanJid(lid);
        const cleanP = String(phone).replace(/[^0-9]/g, '');
        const cleanId = cleanL.split('@')[0];
        // Evitar auto-referencias o asignar un LID a sí mismo
        if (cleanP === cleanId) return;

        // Proteger el número del Owner: solo vincular con LIDs legítimos del owner
        try {
            const database = require('./database');
            if (database.isOwner(cleanP)) {
                const ownerLids = database.getOwnerLids().map(l => l.replace(/:.*@/, '@').split('@')[0]);
                if (!ownerLids.includes(cleanId) && cleanId !== '265626966868143' && cleanId !== '86716094365916') {
                    return;
                }
            }
        } catch (_) {}
        if (cleanL && cleanP && cleanP.length >= 7 && cleanP.length <= 15) {
            cache['_lid_' + cleanL] = cleanP;
            cache['_lid_' + cleanId] = cleanP;
            cache['_phone_' + cleanP] = cleanId;
            scheduleSave();
        }
    },

    /**
     * Obtiene el número de teléfono asociado a un LID
     * @param {string} lid LID del usuario
     * @returns {string|null} Número de teléfono o null
     */
    getPhoneByLid: (lid) => {
        if (!lid) return null;
        const cleanL = cleanJid(lid);
        const cleanId = cleanL.split('@')[0];
        const found = cache['_lid_' + cleanL] || cache['_lid_' + cleanId] || null;
        if (found && String(found).replace(/[^0-9]/g, '') === cleanId) return null;
        return found;
    },

    /**
     * Obtiene el LID asociado a un número de teléfono real
     * @param {string} phone Número de teléfono
     * @returns {string|null} LID o null
     */
    getLidByPhone: (phone) => {
        if (!phone) return null;
        const cleanP = String(phone).replace(/[^0-9]/g, '');
        const found = cache['_phone_' + cleanP] || null;
        return found;
    }
};

module.exports = userNames;
