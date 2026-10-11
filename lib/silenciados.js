'use strict';

const fs = require('fs-extra');
const path = require('path');

const SILENCIADOS_FILE = path.join(process.cwd(), 'silenciados.json');
const OWNER_JID = '18494509905@s.whatsapp.net';

const initSilenciados = () => {
    try {
        if (!fs.existsSync(SILENCIADOS_FILE)) {
            fs.writeJsonSync(SILENCIADOS_FILE, { users: [] }, { spaces: 2 });
        }
    } catch (e) {
        console.error('[SILENCIADOS] Error inicializando silenciados.json:', e.message);
    }
};

initSilenciados();

const normalizeJid = (jid) => {
    if (!jid) return '';
    return jid.toString().replace(/:\d+@/, '@').trim();
};

const loadData = () => {
    try {
        if (!fs.existsSync(SILENCIADOS_FILE)) {
            initSilenciados();
            return { users: [] };
        }
        return fs.readJsonSync(SILENCIADOS_FILE);
    } catch (_) {
        return { users: [] };
    }
};

const saveData = (data) => {
    try {
        fs.writeJsonSync(SILENCIADOS_FILE, data, { spaces: 2 });
        return true;
    } catch (e) {
        console.error('[SILENCIADOS] Error guardando silenciados.json:', e.message);
        return false;
    }
};

const activeTimers = new Map();

const silenciadosManager = {
    isSilenciado: (jid) => {
        if (!jid) return false;
        const clean = normalizeJid(jid);
        const data = loadData();
        if (!Array.isArray(data.users)) return false;

        const now = Date.now();
        const found = data.users.find(u => normalizeJid(u.jid) === clean);
        if (!found) return false;

        if (found.expiresAt && found.expiresAt < now) {
            // Ya expiró, limpiar silenciosamente
            silenciadosManager.desilenciarUser(clean);
            return false;
        }

        return true;
    },

    silenciarUser: (jid, minutos, sock) => {
        const clean = normalizeJid(jid);
        const data = loadData();
        if (!Array.isArray(data.users)) data.users = [];

        // Remover si ya existía para actualizar
        data.users = data.users.filter(u => normalizeJid(u.jid) !== clean);

        const durationMs = minutos * 60 * 1000;
        const expiresAt = Date.now() + durationMs;
        const hasta = new Date(expiresAt).toLocaleString('es-DO', {
            timeZone: 'America/Santo_Domingo'
        });

        data.users.push({ jid: clean, hasta, expiresAt });
        saveData(data);

        // Cancelar timer previo si existía
        if (activeTimers.has(clean)) {
            clearTimeout(activeTimers.get(clean));
        }

        const timer = setTimeout(async () => {
            silenciadosManager.desilenciarUser(clean);
            activeTimers.delete(clean);

            if (sock) {
                try {
                    await sock.sendMessage(OWNER_JID, {
                        text: `🔔 *Silencio expirado*\n\n` +
                              `👤 +${clean.replace('@s.whatsapp.net', '')} ya puede usar el bot.\n\n` +
                              `_Unknown Codexツ</>_`
                    });
                } catch (_) {}
            }
        }, durationMs);

        activeTimers.set(clean, timer);
        return { hasta, expiresAt };
    },

    desilenciarUser: (jid) => {
        const clean = normalizeJid(jid);
        const data = loadData();
        if (!Array.isArray(data.users)) return false;

        const initialLen = data.users.length;
        data.users = data.users.filter(u => normalizeJid(u.jid) !== clean);
        saveData(data);

        if (activeTimers.has(clean)) {
            clearTimeout(activeTimers.get(clean));
            activeTimers.delete(clean);
        }

        return data.users.length < initialLen;
    },

    list: () => {
        const data = loadData();
        return Array.isArray(data.users) ? data.users : [];
    }
};

module.exports = silenciadosManager;

