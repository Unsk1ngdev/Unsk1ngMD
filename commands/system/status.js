const os = require('os');
const database = require('../../lib/database');
const config = require('../../config');

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatUptime = (seconds) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m ${s}s`;
};

module.exports = {
    name: 'status',
    alias: ['host', 'info', 'ram'],
    category: 'sistema',
    desc: 'Muestra información del sistema, consumo de RAM, CPU y estado del bot',
    usage: '.status',
    execute: async ({ sock, m }) => {
        const memory = process.memoryUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        const uptime = process.uptime();
        const cpuModel = os.cpus()[0]?.model || 'Desconocido';
        const cpuCores = os.cpus().length;
        const platform = `${os.type()} ${os.release()} (${os.arch()})`;
        const settings = database.getSettings();

        const message = `📊 *ESTADO DEL SISTEMA & BOT*\n\n` +
            `🤖 *Bot:* ${config.botName}\n` +
            `👑 *Dueño:* ${config.ownerName}\n` +
            `⏱️ *Uptime Bot:* ${formatUptime(uptime)}\n` +
            `⚡ *Comandos procesados:* ${settings.totalCommandsExecuted || 0}\n` +
            `🔒 *Modo actual:* ${settings.mode.toUpperCase()}\n` +
            `🔤 *Prefijo activo:* "${settings.prefix}"\n\n` +
            `💾 *Consumo de Memoria RAM:*\n` +
            `  • *RSS:* ${formatBytes(memory.rss)}\n` +
            `  • *Heap Usado:* ${formatBytes(memory.heapUsed)} / ${formatBytes(memory.heapTotal)}\n` +
            `  • *RAM Total SO:* ${formatBytes(usedMem)} / ${formatBytes(totalMem)}\n\n` +
            `🖥️ *Información del Servidor:*\n` +
            `  • *SO:* ${platform}\n` +
            `  • *CPU:* ${cpuModel} (${cpuCores} núcleos)\n` +
            `  • *Node.js:* ${process.version}`;

        await m.reply(message);
    }
};

