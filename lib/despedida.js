'use strict';

const fs = require('fs-extra');
const path = require('path');

const DESPEDIDA_FILE = path.join(process.cwd(), 'despedida.json');

const DEFAULT_DESPEDIDA =
`╭━━━〔 *¡HASTA PRONTO!* 〕━━━⬣\n` +
`┃ 🚪 *Participante:* {usuario}\n` +
`┃ 👥 *Miembros restantes:* {miembros}\n` +
`┃ 🏛️ *Grupo:* {grupo}\n` +
`╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
`👋 _Ha abandonado el grupo. Le deseamos lo mejor en sus proyectos futuros._ ✨`;

const cleanJid = (jid) => {
    if (!jid) return '';
    const num = jid.replace(/:.*@/, '@').split('@')[0];
    return num.includes('-') || num.length >= 15 ? `${num}@g.us` : jid;
};

const initDespedida = () => {
    try {
        if (!fs.existsSync(DESPEDIDA_FILE)) {
            fs.writeJsonSync(DESPEDIDA_FILE, {}, { spaces: 2 });
        }
    } catch (e) {
        console.error('[DESPEDIDA] Error inicializando despedida.json:', e.message);
    }
};

initDespedida();

const loadData = () => {
    try {
        if (!fs.existsSync(DESPEDIDA_FILE)) {
            initDespedida();
            return {};
        }
        return fs.readJsonSync(DESPEDIDA_FILE);
    } catch (_) {
        return {};
    }
};

const saveData = (data) => {
    try {
        fs.writeJsonSync(DESPEDIDA_FILE, data, { spaces: 2 });
        return true;
    } catch (e) {
        console.error('[DESPEDIDA] Error guardando despedida.json:', e.message);
        return false;
    }
};

const despedidaManager = {
    DEFAULT_DESPEDIDA,

    getConfig: (groupId) => {
        if (!groupId) return null;
        const jid = cleanJid(groupId);
        const data = loadData();
        return data[jid] || data[groupId] || null;
    },

    isEnabled: (groupId) => {
        if (!groupId) return false;
        const jid = cleanJid(groupId);
        const data = loadData();
        const conf = data[jid] || data[groupId];
        return Boolean(conf && conf.activo);
    },

    enable: (groupId) => {
        if (!groupId) return false;
        const jid = cleanJid(groupId);
        const data = loadData();
        const existing = data[jid] || data[groupId];
        data[jid] = {
            mensaje: existing?.mensaje || DEFAULT_DESPEDIDA,
            activo: true
        };
        return saveData(data);
    },

    disable: (groupId) => {
        if (!groupId) return false;
        const jid = cleanJid(groupId);
        const data = loadData();
        if (data[jid]) {
            data[jid].activo = false;
        } else if (data[groupId]) {
            data[groupId].activo = false;
        } else {
            data[jid] = { mensaje: DEFAULT_DESPEDIDA, activo: false };
        }
        return saveData(data);
    },

    setConfig: (groupId, mensaje) => {
        if (!groupId) return false;
        const jid = cleanJid(groupId);
        const data = loadData();
        data[jid] = {
            mensaje: (mensaje && mensaje.trim()) ? mensaje.trim() : DEFAULT_DESPEDIDA,
            activo: true
        };
        return saveData(data);
    },

    reset: (groupId) => {
        if (!groupId) return false;
        const jid = cleanJid(groupId);
        const data = loadData();
        data[jid] = {
            mensaje: DEFAULT_DESPEDIDA,
            activo: true
        };
        return saveData(data);
    },

    formatMessage: (template, { userTag, groupName, memberCount, groupDesc }) => {
        const raw = template || DEFAULT_DESPEDIDA;
        return raw
            .replace(/{usuario}|{user}|@usuario|@user/gi, userTag ? `@${userTag}` : '@alguien')
            .replace(/{grupo}|{group}/gi, groupName || 'el grupo')
            .replace(/{miembros}|{count}/gi, memberCount !== undefined ? String(memberCount) : '')
            .replace(/{desc}/gi, groupDesc || '');
    },

    getAll: () => loadData()
};

module.exports = despedidaManager;
