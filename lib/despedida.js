'use strict';

const fs = require('fs-extra');
const path = require('path');

const DESPEDIDA_FILE = path.join(process.cwd(), 'despedida.json');

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
    getConfig: (groupId) => {
        if (!groupId) return null;
        const data = loadData();
        return data[groupId] || null;
    },

    setConfig: (groupId, mensaje) => {
        if (!groupId) return false;
        const data = loadData();
        data[groupId] = {
            mensaje: mensaje || '👋 Hasta luego {usuario}!\nNos veremos pronto. 🚪\n\n_Unknown Codexツ</>_',
            activo: true
        };
        return saveData(data);
    },

    disable: (groupId) => {
        if (!groupId) return false;
        const data = loadData();
        if (data[groupId]) {
            data[groupId].activo = false;
            return saveData(data);
        }
        return true;
    },

    getAll: () => loadData()
};

module.exports = despedidaManager;

