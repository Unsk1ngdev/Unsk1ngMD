'use strict';

const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

const DB_FILE = path.join(config.databaseDir || path.join(__dirname, '../database'), 'sms_anon.json');

// Estructura en memoria
let smsData = {
    messages: {},       // msgId -> { senderJid, senderChat, targetJid, createdAt }
    blocked: []         // array de números limpios que no desean recibir SMS
};

// Carga persistente inicial
try {
    if (fs.existsSync(DB_FILE)) {
        const loaded = fs.readJsonSync(DB_FILE);
        if (loaded && typeof loaded === 'object') {
            smsData = {
                messages: loaded.messages || {},
                blocked: Array.isArray(loaded.blocked) ? loaded.blocked : []
            };
        }
    } else {
        fs.ensureFileSync(DB_FILE);
        fs.writeJsonSync(DB_FILE, smsData, { spaces: 2 });
    }
} catch (err) {
    console.error('[SMS-ANON] Error cargando base de datos:', err.message);
}

// Guardado seguro con debounce
let saveTimeout = null;
function saveSmsData() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            fs.writeJsonSync(DB_FILE, smsData, { spaces: 2 });
        } catch (_) {}
    }, 1000);
}

// Rate Limiter: max 5 envíos en 5 minutos por usuario
const rateLimits = new Map(); // senderJid -> [timestamps]

const smsManager = {
    /**
     * Limpia mensajes con más de 24 horas de antigüedad
     */
    cleanExpired: () => {
        const now = Date.now();
        const MAX_AGE = 24 * 60 * 60 * 1000;
        let modified = false;

        for (const [id, item] of Object.entries(smsData.messages)) {
            if (!item || !item.createdAt || (now - item.createdAt > MAX_AGE)) {
                delete smsData.messages[id];
                modified = true;
            }
        }

        if (modified) saveSmsData();
    },

    /**
     * Verifica si un usuario está saturando el servicio (anti-spam)
     */
    isRateLimited: (senderJid) => {
        const now = Date.now();
        const timestamps = rateLimits.get(senderJid) || [];
        const recent = timestamps.filter(t => now - t < 5 * 60 * 1000);

        if (recent.length >= 5) {
            return true;
        }

        recent.push(now);
        rateLimits.set(senderJid, recent);
        return false;
    },

    /**
     * Comprueba si un número tiene bloqueada la recepción de SMS anónimos
     */
    isBlocked: (phoneNumber) => {
        const clean = String(phoneNumber || '').replace(/\D/g, '');
        return smsData.blocked.includes(clean);
    },

    /**
     * Bloquea o desbloquea la recepción de SMS anónimos para un usuario
     */
    setBlocked: (phoneNumber, block = true) => {
        const clean = String(phoneNumber || '').replace(/\D/g, '');
        if (!clean) return false;

        const idx = smsData.blocked.indexOf(clean);
        if (block && idx === -1) {
            smsData.blocked.push(clean);
            saveSmsData();
            return true;
        } else if (!block && idx !== -1) {
            smsData.blocked.splice(idx, 1);
            saveSmsData();
            return true;
        }
        return false;
    },

    /**
     * Registra un mensaje saliente para permitir respuestas bidireccionales
     */
    registerMessage: (msgId, { senderJid, senderChat, targetJid }) => {
        if (!msgId) return;
        smsData.messages[msgId] = {
            senderJid,
            senderChat,
            targetJid,
            createdAt: Date.now()
        };
        saveSmsData();
    },

    /**
     * Obtiene la sesión asociada a un mensaje citado
     */
    getSession: (quotedId) => {
        if (!quotedId) return null;
        return smsData.messages[quotedId] || null;
    },

    /**
     * Elimina una sesión después de ser completada o respondida
     */
    removeSession: (quotedId) => {
        if (quotedId && smsData.messages[quotedId]) {
            delete smsData.messages[quotedId];
            saveSmsData();
        }
    },

    /**
     * Reenvía automáticamente una respuesta a un SMS anónimo
     */
    handleReply: async (sock, m, customText = null) => {
        const quotedId = m.quoted?.key?.id || m.quoted?.id;
        if (!quotedId) return false;

        const session = smsManager.getSession(quotedId);
        if (!session) return false;

        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        // Comprobar que quien responde es el targetJid (o el sender en caso de diálogo cruzado)
        const cleanSender = String(sender).split('@')[0].split(':')[0];
        const cleanTarget = String(session.targetJid).split('@')[0].split(':')[0];
        const cleanOrigSender = String(session.senderJid).split('@')[0].split(':')[0];

        const isTarget = cleanSender === cleanTarget;
        const isOrigSender = cleanSender === cleanOrigSender;

        if (!isTarget && !isOrigSender) {
            return false;
        }

        const replyContent = (customText || m.body || '').trim();
        if (!replyContent) return false;

        // Destino del reenvío
        const destinationChat = isTarget ? session.senderChat : session.targetJid;
        const headerTitle = isTarget ? '📩 *RESPUESTA A TU SMS ANÓNIMO*' : '📨 *NUEVO MENSAJE DE TU SMS ANÓNIMO*';

        try {
            const sentMsg = await sock.sendMessage(destinationChat, {
                text: replyContent
            });

            // Permitir responder a la respuesta encadenando la conversación
            if (sentMsg?.key?.id) {
                smsManager.registerMessage(sentMsg.key.id, {
                    senderJid: sender,
                    senderChat: jid,
                    targetJid: destinationChat
                });
            }

            try {
                await sock.sendMessage(jid, {
                    react: { text: '✅', key: m.key }
                });
            } catch (_) {}

            await sock.sendMessage(jid, {
                text: '✅ Respuesta enviada exitosamente.'
            }, { quoted: m });

            return true;
        } catch (err) {
            await sock.sendMessage(jid, {
                text: `❌ No se pudo entregar la respuesta: ${err.message}`
            }, { quoted: m });
            return false;
        }
    }
};

// Limpieza periódica de sesiones viejas cada hora (con unref para no bloquear el event loop)
const smsCleanerTimer = setInterval(smsManager.cleanExpired, 60 * 60 * 1000);
if (smsCleanerTimer.unref) smsCleanerTimer.unref();

module.exports = smsManager;

