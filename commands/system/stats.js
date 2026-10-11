'use strict';

module.exports = {
    name: 'stats',
    alias: ['botstats', 'estadisticas'],
    category: 'sistema',
    desc: 'Muestra estadísticas completas del bot (solo owner)',
    usage: '.stats',
    ownerOnly: true,

    execute: async ({ sock, m, isOwner }) => {
        if (!isOwner) return;

        let totalGrupos = 0;
        try {
            const grupos = await sock.groupFetchAllParticipating();
            totalGrupos = Object.keys(grupos || {}).length;
        } catch (_) {}

        const uptime = process.uptime();
        const horas = Math.floor(uptime / 3600);
        const minutos = Math.floor((uptime % 3600) / 60);
        const segundos = Math.floor(uptime % 60);

        const ram = process.memoryUsage();
        const ramUsada = (ram.heapUsed / 1024 / 1024).toFixed(2);
        const ramTotal = (ram.heapTotal / 1024 / 1024).toFixed(2);

        const hora = new Date().toLocaleString('es-DO', {
            timeZone: 'America/Santo_Domingo'
        });

        const jid = m.chat || m.key.remoteJid;

        await sock.sendMessage(jid, {
            text: `╔══════════════════╗\n` +
                  `║   📊 *BOT STATS*    ║\n` +
                  `╚══════════════════╝\n\n` +
                  `👥 *Grupos:* ${totalGrupos}\n` +
                  `⏱️ *Uptime:* ${horas}h ${minutos}m ${segundos}s\n` +
                  `🧠 *RAM:* ${ramUsada}MB / ${ramTotal}MB\n` +
                  `⚙️ *Node.js:* ${process.version}\n` +
                  `🕐 *Hora:* ${hora}\n` +
                  `📱 *Plataforma:* ${process.platform}\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

