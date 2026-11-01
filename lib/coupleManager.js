'use strict';

const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

const DB_FILE = path.join(config.databaseDir || path.join(__dirname, '../database'), 'couples.json');

// Memoria y persistencia
let coupleData = {
    couples: {},    // phone -> { partnerPhone, partnerJid, since, weddingDate, love }
};

// Carga inicial
try {
    if (fs.existsSync(DB_FILE)) {
        const loaded = fs.readJsonSync(DB_FILE);
        if (loaded && typeof loaded === 'object') {
            coupleData = {
                couples: loaded.couples || {}
            };
        }
    } else {
        fs.ensureFileSync(DB_FILE);
        fs.writeJsonSync(DB_FILE, coupleData, { spaces: 2 });
    }
} catch (err) {
    console.error('[COUPLES] Error cargando couples.json:', err.message);
}

// Guardado seguro
let saveTimeout = null;
function saveCouples() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            fs.writeJsonSync(DB_FILE, coupleData, { spaces: 2 });
        } catch (_) {}
    }, 1000);
}

// Propuestas pendientes en memoria (phoneTarget -> { fromJid, fromPhone, targetJid, targetPhone, chat, timestamp, timer })
const pendingProposals = new Map();

const cleanNum = (jid) => {
    return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
};

const coupleManager = {
    /**
     * Obtiene el número limpio a partir de cualquier JID
     */
    cleanNum,

    /**
     * Obtiene los datos de la pareja de un usuario (o null si es soltero)
     */
    getCouple: (userJid) => {
        const phone = cleanNum(userJid);
        if (!phone || !coupleData.couples[phone]) return null;

        const info = coupleData.couples[phone];
        const partnerInfo = coupleData.couples[info.partnerPhone];

        return {
            userPhone: phone,
            partnerPhone: info.partnerPhone,
            partnerJid: info.partnerJid || `${info.partnerPhone}@s.whatsapp.net`,
            since: info.since || Date.now(),
            weddingDate: info.weddingDate || 'Fecha desconocida',
            love: info.love !== undefined ? info.love : 100
        };
    },

    /**
     * Crea una propuesta de noviazgo/matrimonio
     */
    propose: (fromJid, targetJid, chat) => {
        const fromPhone = cleanNum(fromJid);
        const targetPhone = cleanNum(targetJid);

        if (!fromPhone || !targetPhone) {
            return { error: 'JID_INVALID' };
        }

        if (fromPhone === targetPhone) {
            return { error: 'SELF_PROPOSAL' };
        }

        // Comprobar si quien propone ya tiene pareja
        if (coupleData.couples[fromPhone]) {
            const current = coupleData.couples[fromPhone];
            return { error: 'ALREADY_COUPLE', partnerPhone: current.partnerPhone };
        }

        // Comprobar si el objetivo ya tiene pareja
        if (coupleData.couples[targetPhone]) {
            const current = coupleData.couples[targetPhone];
            return { error: 'TARGET_ALREADY_COUPLE', partnerPhone: current.partnerPhone };
        }

        // Comprobar si ya hay una propuesta activa dirigida a esta persona
        if (pendingProposals.has(targetPhone)) {
            const active = pendingProposals.get(targetPhone);
            return { error: 'PROPOSAL_PENDING', fromPhone: active.fromPhone };
        }

        // Programar caducidad en 5 minutos
        const timer = setTimeout(() => {
            pendingProposals.delete(targetPhone);
        }, 5 * 60 * 1000);

        pendingProposals.set(targetPhone, {
            fromJid,
            fromPhone,
            targetJid,
            targetPhone,
            chat,
            timestamp: Date.now(),
            timer
        });

        return {
            success: true,
            fromPhone,
            targetPhone
        };
    },

    /**
     * Obtiene la propuesta pendiente dirigida a un usuario
     */
    getPendingProposal: (targetJid) => {
        const targetPhone = cleanNum(targetJid);
        return pendingProposals.get(targetPhone) || null;
    },

    /**
     * Acepta la propuesta pendiente
     */
    acceptProposal: (targetJid) => {
        const targetPhone = cleanNum(targetJid);
        const proposal = pendingProposals.get(targetPhone);

        if (!proposal) {
            return { error: 'NO_PROPOSAL' };
        }

        // Limpiar timer y propuesta
        if (proposal.timer) clearTimeout(proposal.timer);
        pendingProposals.delete(targetPhone);

        const now = Date.now();
        const weddingDate = new Date(now).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Registrar a ambos en la base de datos
        coupleData.couples[proposal.fromPhone] = {
            partnerPhone: proposal.targetPhone,
            partnerJid: proposal.targetJid,
            since: now,
            weddingDate,
            love: 100
        };

        coupleData.couples[proposal.targetPhone] = {
            partnerPhone: proposal.fromPhone,
            partnerJid: proposal.fromJid,
            since: now,
            weddingDate,
            love: 100
        };

        saveCouples();

        return {
            success: true,
            user1Phone: proposal.fromPhone,
            user1Jid: proposal.fromJid,
            user2Phone: proposal.targetPhone,
            user2Jid: proposal.targetJid,
            weddingDate,
            since: now
        };
    },

    /**
     * Rechaza la propuesta pendiente
     */
    rejectProposal: (targetJid) => {
        const targetPhone = cleanNum(targetJid);
        const proposal = pendingProposals.get(targetPhone);

        if (!proposal) {
            return { error: 'NO_PROPOSAL' };
        }

        if (proposal.timer) clearTimeout(proposal.timer);
        pendingProposals.delete(targetPhone);

        return {
            success: true,
            fromPhone: proposal.fromPhone,
            fromJid: proposal.fromJid,
            targetPhone: proposal.targetPhone,
            targetJid: proposal.targetJid
        };
    },

    /**
     * Termina la relación amorosa
     */
    breakUp: (userJid) => {
        const phone = cleanNum(userJid);
        if (!phone || !coupleData.couples[phone]) {
            return { error: 'NOT_IN_COUPLE' };
        }

        const info = coupleData.couples[phone];
        const partnerPhone = info.partnerPhone;
        const partnerJid = info.partnerJid || `${partnerPhone}@s.whatsapp.net`;
        const since = info.since || Date.now();

        // Calcular días juntos
        const msPassed = Date.now() - since;
        const days = Math.max(1, Math.floor(msPassed / (1000 * 60 * 60 * 24)));

        // Eliminar ambos registros
        delete coupleData.couples[phone];
        delete coupleData.couples[partnerPhone];
        saveCouples();

        return {
            success: true,
            userPhone: phone,
            partnerPhone,
            partnerJid,
            days
        };
    },

    /**
     * Formatea el tiempo transcurrido en días y horas
     */
    formatTimeTogether: (since) => {
        const ms = Math.max(0, Date.now() - since);
        const totalMinutes = Math.floor(ms / (1000 * 60));
        const totalHours = Math.floor(totalMinutes / 60);
        const days = Math.floor(totalHours / 24);
        const hours = totalHours % 24;
        const minutes = totalMinutes % 60;

        if (days === 0 && hours === 0) {
            return `${totalMinutes} minuto${totalMinutes !== 1 ? 's' : ''}`;
        }
        if (days === 0) {
            return `${hours} hora${hours !== 1 ? 's' : ''} y ${minutes} min`;
        }
        return `${days} día${days !== 1 ? 's' : ''} y ${hours} hora${hours !== 1 ? 's' : ''}`;
    }
};

module.exports = coupleManager;

