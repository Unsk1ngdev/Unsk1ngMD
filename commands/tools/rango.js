'use strict';

const economy = require('../../lib/economy');
const userNames = require('../../lib/userNames');

module.exports = {
    name: 'rango',
    alias: ['nivel', 'level', 'rankexp', 'mylevel', 'estatus'],
    category: 'juegos',
    desc: 'Muestra tu nivel, rango de experiencia, título, estadísticas y progreso',
    usage: '.rango [@usuario opcional]',

    execute: async ({ sock, m, args }) => {
        const chatId = m.chat || m.key.remoteJid;
        const sender = m.sender;

        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        let target = mentioned[0];

        if (!target && args[0]) {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw.length >= 7) target = `${raw}@s.whatsapp.net`;
        }
        if (!target && m.quoted?.sender) {
            target = m.quoted.sender;
        }
        if (!target) {
            target = sender;
        }

        const user = economy.getUser(target);
        const userRank = economy.getUserRank(target);

        // Barra de progreso de EXP
        const reqExp = user.level * 250;
        const percent = Math.min(100, Math.floor((user.exp / reqExp) * 100));
        const filledBars = Math.floor(percent / 10);
        const emptyBars = 10 - filledBars;
        const progressBar = '▰'.repeat(filledBars) + '▱'.repeat(emptyBars);

        const targetName = (userNames && typeof userNames.get === 'function')
            ? userNames.get(target)
            : null;
        const nameHeader = targetName ? `*${targetName}* (@${target.split('@')[0]})` : `@${target.split('@')[0]}`;

        // Estado del escudo anti-robo
        const ahora = Date.now();
        const tieneEscudo = user.escudoAntiRobo && user.escudoAntiRobo > ahora;
        const escudoText = tieneEscudo
            ? `🟢 *Activo* (${economy.formatDuration(user.escudoAntiRobo - ahora)})`
            : '🔴 *Inactivo* (Compra un seguro en *.tienda*)';

        const tituloText = user.titulo ? `«${user.titulo}»` : '_Sin título (Consíguelo en .tienda)_';

        const jStats = user.juegosStats || {};

        const card =
            `╔══════════════════════════╗\n` +
            `   🎖️ *ESTATUS Y RANGO DE JUGADOR* 🎖️\n` +
            `╚══════════════════════════╝\n\n` +
            `👤 *Jugador:* ${nameHeader}\n` +
            `🏷️ *Título:* ${tituloText}\n` +
            `🎖️ *Rango actual:* ${userRank.nombre}\n` +
            `⭐ *Nivel:* ${user.level}\n\n` +
            `📊 *Progreso de EXP hacia Nivel ${user.level + 1}:*\n` +
            `[${progressBar}] ${percent}%\n` +
            `⚡ *EXP:* ${economy.formatNumber(user.exp)} / ${economy.formatNumber(reqExp)} pts\n\n` +
            `⚔️ *ESTADÍSTICAS RPG:*\n` +
            `• 🗡️ *Ataque:* ${economy.formatNumber(user.ataque)} pts\n` +
            `• 🛡️ *Defensa:* ${economy.formatNumber(user.defensa)} pts\n` +
            `• 🔒 *Escudo Anti-Robo:* ${escudoText}\n\n` +
            `🏦 *ECONOMÍA PERSONAL:*\n` +
            `• 💵 *En mano:* $${economy.formatNumber(user.monedas)}\n` +
            `• 🏦 *En banco:* $${economy.formatNumber(user.banco)}\n\n` +
            `🎮 *RÉCORD EN JUEGOS:*\n` +
            `• 🏆 *Victorias:* ${economy.formatNumber(jStats.victorias || 0)}\n` +
            `• 💰 *Monedas ganadas:* $${economy.formatNumber(jStats.monedasGanadas || 0)}\n` +
            `• ⚡ *EXP obtenida:* ${economy.formatNumber(jStats.expGanada || 0)}\n\n` +
            `_Unknown Codexツ</>_`;

        await sock.sendMessage(chatId, {
            text: card,
            mentions: [target]
        }, { quoted: m });
    }
};

