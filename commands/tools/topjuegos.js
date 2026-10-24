'use strict';

const economy = require('../../lib/economy');
const userNames = require('../../lib/userNames');

module.exports = {
    name: 'topjuegos',
    alias: ['topgamers', 'topganadores', 'topjuego', 'topgames'],
    category: 'juegos',
    desc: 'Muestra el Top 5 de jugadores que han ganado más monedas y EXP jugando en el grupo',
    usage: '.topjuegos',
    groupOnly: true,

    execute: async ({ sock, m }) => {
        const chatId = m.chat || m.key.remoteJid;

        let participants = [];
        try {
            const metadata = await sock.groupMetadata(chatId);
            participants = metadata?.participants || [];
        } catch (_) {}

        const topGamers = economy.getTopGroupGamers(chatId, participants, 5);

        if (!topGamers || topGamers.length === 0) {
            return await sock.sendMessage(chatId, {
                text: '🎮 *Aún no hay registros de juegos en este grupo.*\n\n' +
                      '¡Juega a *.akinator*, *.acertijo*, *.trivia* o *.ahorcado* para empezar a ganar monedas, subir de nivel y clasificar en el Top 5!'
            }, { quoted: m });
        }

        const medallas = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        const mentions = [];

        let leaderboardText =
            `╔══════════════════════════╗\n` +
            `   🏆 *TOP 5 GAMERS DEL GRUPO* 🏆\n` +
            `╚══════════════════════════╝\n\n` +
            `_Los 5 miembros con mayores ganancias de monedas y EXP jugando en este grupo:_\n\n`;

        topGamers.forEach((gamer, idx) => {
            mentions.push(gamer.jid);
            const medalla = medallas[idx] || '▫️';
            const num = gamer.jid.split('@')[0];
            const name = (userNames && typeof userNames.get === 'function')
                ? userNames.get(gamer.jid)
                : null;
            const displayName = name ? `*${name}* (@${num})` : `@${num}`;
            const tituloText = gamer.titulo ? ` «${gamer.titulo}»` : '';

            leaderboardText +=
                `${medalla} *PUESTO #${idx + 1}:* ${displayName}${tituloText}\n` +
                `   🎖️ *Rango:* ${gamer.rango.nombre}\n` +
                `   ⭐ *Nivel:* ${gamer.level}\n` +
                `   💰 *Monedas ganadas:* $${economy.formatNumber(gamer.monedas)}\n` +
                `   ⚡ *EXP obtenida:* +${economy.formatNumber(gamer.exp)} EXP\n` +
                `   🏆 *Partidas ganadas:* ${gamer.victorias}\n\n`;
        });

        leaderboardText +=
            `💡 _Las monedas ganadas se depositan automáticamente en el banco._\n` +
            `_Escribe *.tienda* para gastar tus ganancias o *.rango* para ver tus stats._\n\n` +
            `_Unknown Codexツ</>_`;

        await sock.sendMessage(chatId, {
            text: leaderboardText,
            mentions
        }, { quoted: m });
    }
};

