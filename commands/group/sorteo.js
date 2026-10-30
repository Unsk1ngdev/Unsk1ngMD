'use strict';

const config = require('../../config');

module.exports = {
    name: 'sorteo',
    alias: ['rifa', 'ruleta', 'sortear'],
    category: 'grupo',
    desc: 'Realiza un sorteo aleatorio entre todos los participantes del grupo y anuncia al ganador con suspenso',
    usage: '.sorteo [premio o motivo opcional]',
    groupOnly: true,

    execute: async ({ sock, m, text, groupMetadata }) => {
        const jid = m.chat;

        if (!jid.endsWith('@g.us')) {
            return await sock.sendMessage(jid, {
                text: '❌ Este comando solo puede utilizarse dentro de un grupo.'
            }, { quoted: m });
        }

        // 1. Obtener participantes del grupo
        let metadata = groupMetadata;
        if (!metadata) {
            try {
                metadata = await sock.groupMetadata(jid);
            } catch (_) {}
        }

        const participants = metadata?.participants || [];
        const botJid = (sock.user?.id || sock.user?.jid || '').replace(/:\d+@/, '@').split('@')[0];

        // Filtrar al bot y verificar candidatos válidos
        const candidates = participants
            .map(p => (p.id || '').replace(/:\d+@/, '@').trim())
            .filter(id => id && id.endsWith('@s.whatsapp.net') && !id.startsWith(botJid));

        if (candidates.length < 2) {
            return await sock.sendMessage(jid, {
                text: '❌ No hay suficientes participantes en el grupo para realizar un sorteo (se requieren al menos 2).'
            }, { quoted: m });
        }

        // 2. Premio o motivo del sorteo
        const prize = text && text.trim() ? text.trim() : 'Premio Sorpresa 🎁';

        await m.react?.('🎲');

        // 3. Mensaje de inicio y suspenso
        const startMsg = await sock.sendMessage(jid, {
            text: [
                '🎰 *¡INICIANDO EL GRAN SORTEO!* 🎰',
                '',
                `🏆 *Premio en juego:* *${prize}*`,
                `👥 *Total de participantes:* ${candidates.length}`,
                '',
                '🎲 _Girando la ruleta de la suerte..._',
                '⏳ _Calculando el ganador en 3, 2, 1..._'
            ].join('\n')
        }, { quoted: m });

        // 4. Pausa de suspenso (1.5 segundos)
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 5. Elegir ganador aleatoriamente
        const winnerJid = candidates[Math.floor(Math.random() * candidates.length)];
        const winnerPhone = winnerJid.split('@')[0];

        await m.react?.('🏆');

        const winnerText = [
            '🎉✨ *¡TENEMOS UN GANADOR!* ✨🎉',
            '',
            `🏆 *Premio:* *${prize}*`,
            `👑 *Ganador Oficial:* @${winnerPhone}`,
            `👥 *Participantes en lista:* ${candidates.length}`,
            '',
            '🥳 _¡Muchas felicidades! Reclama tu premio con los administradores._ 🎊',
            '',
            `_${config.authorName || 'Unknown Codexツ</>'}_`
        ].join('\n');

        await sock.sendMessage(jid, {
            text: winnerText,
            mentions: [winnerJid]
        }, { quoted: startMsg || m });
    }
};

