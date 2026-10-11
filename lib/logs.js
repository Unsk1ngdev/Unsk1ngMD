'use strict';

const fs = require('fs-extra');
const path = require('path');

const LOGS_FILE = path.join(process.cwd(), 'logs.json');

const initLogs = () => {
    try {
        if (!fs.existsSync(LOGS_FILE)) {
            fs.writeJsonSync(LOGS_FILE, { logs: [] }, { spaces: 2 });
        }
    } catch (e) {
        console.error('[LOGS] Error inicializando logs.json:', e.message);
    }
};

initLogs();

const loadData = () => {
    try {
        if (!fs.existsSync(LOGS_FILE)) {
            initLogs();
            return { logs: [] };
        }
        return fs.readJsonSync(LOGS_FILE);
    } catch (_) {
        return { logs: [] };
    }
};

const saveData = (data) => {
    try {
        fs.writeJsonSync(LOGS_FILE, data, { spaces: 2 });
        return true;
    } catch (e) {
        console.error('[LOGS] Error guardando logs.json:', e.message);
        return false;
    }
};

const logsManager = {
    addLog: ({ usuario, comando, grupo, hora }) => {
        const data = loadData();
        if (!Array.isArray(data.logs)) data.logs = [];

        data.logs.push({
            usuario: usuario || 'Desconocido',
            comando: comando || '',
            grupo: grupo || 'Privado',
            hora: hora || new Date().toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo' })
        });

        // Mantener solo los últimos 100
        if (data.logs.length > 100) {
            data.logs = data.logs.slice(-100);
        }

        saveData(data);
    },

    getRecentLogs: (limit = 20) => {
        const data = loadData();
        const logs = Array.isArray(data.logs) ? data.logs : [];
        return logs.slice(-limit).reverse();
    },

    getTotalLogsCount: () => {
        const data = loadData();
        return Array.isArray(data.logs) ? data.logs.length : 0;
    }
};

module.exports = logsManager;

