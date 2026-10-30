'use strict';

const fs = require('fs-extra');
const path = require('path');
const rankManager = require('../../lib/rank');
const config = require('../../config');

const RANK_FILE = path.join(process.cwd(), 'rank.json');

const getGroupData = (groupId) => {
    try {
        if (!fs.existsSync(RANK_FILE)) return {};
        const data = fs.readJsonSync(RANK_FILE);
        const cleanGroup = (groupId || '').replace(/:\d+@/, '@').trim();
        return data[cleanGroup] || {};
    } catch (_) {
        return {};
    }
};

module.exports = {
    name: 'contador',
    alias: ['topmensajes', 'msgrank', 'topactivos', 'mensajes'],
    category: 'grupo',
    desc: 'Muestra el ranking de miembros que más mensajes han enviado en el grupo',
    usage: '.contador',
    groupOnly: true,

    execute: async ({ sock, m, groupMetadata }) => {
        const jid = m.chat;

        if (!jid.endsWith('@g.us')) {
            return await sock.sendMessage(jid, {
                text: '❌ Este comando solo se puede usar en grupos.'
            }, { quoted: m });
        }

        await m.react?.('📊');

        // 1. Obtener datos del grupo
        const groupData = getGroupData(jid);
        const totalMessages = Object.values(groupData).reduce((a, b) => a + (Number(b) || 0), 0);

        const rankList = rankManager.getRank(jid, 15);

        if (!rankList || rankList.length === 0 || totalMessages === 0) {
            return await sock.sendMessage(jid, {
                text: [
                    '📊 *CONTADOR DE MENSAJES DEL GRUPO*',
                    '',
                    '💬 _Aún no hay suficiente actividad registrada en este grupo._',
                    '¡Empiecen a chatear y los mensajes se contabilizarán automáticamente! 🚀'
                ].join('\n')
            }, { quoted: m });
        }

        // 2. Nombre del grupo
        let groupName = 'el Grupo';
        if (groupMetadata?.subject) {
            groupName = groupMetadata.subject;
        }

        // 3. Formatear lista con medallas y porcentajes
        const medals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🎖️', '🎖️', '🎖️', '🎖️', '🎖️', '✨', '✨', '✨', '✨', '✨'];
        const mentions = [];
        const lines = [];

        rankList.forEach(([userJid, count], index) => {
            const cleanJid = userJid.replace(/:\d+@/, '@').trim();
            mentions.push(cleanJid);

            const phone = cleanJid.split('@')[0];
            const medal = medals[index] || '•';
            const percentage = ((count / totalMessages) * 100).toFixed(1);

            lines.push(`${medal} *#${index + 1}* @${phone} ➔ *${count.toLocaleString()}* msgs _(${percentage}%)_`);
        });

        // Tu posición en el ranking (si el que consulta envió mensajes)
        const myJid = (m.sender || '').replace(/:\d+@/, '@').trim();
        const myCount = groupData[myJid] || 0;
        let myPositionText = '';
        if (myCount > 0) {
            const allSorted = Object.entries(groupData).sort(([, a], [, b]) => b - a);
            const myPos = allSorted.findIndex(([id]) => id === myJid) + 1;
            myPositionText = `\n👤 *Tu actividad:* Puesto #${myPos} con *${myCount}* mensajes`;
        }

        const messageText = [
            '📊 *TOP 15 — MIEMBROS MÁS ACTIVOS* 📊',
            `👥 *Grupo:* ${groupName}`,
            `💬 *Total mensajes registrados:* *${totalMessages.toLocaleString()}*`,
            myPositionText,
            '',
            '🏆 *RANKING:*',
            lines.join('\n'),
            '',
            `_Bot: ${config.botName || 'Unsk1ngMD'} | ¡Sigue chateando para subir al podio!_ 🚀`
        ].filter(Boolean).join('\n');

        await sock.sendMessage(jid, {
            text: messageText,
            mentions: mentions
        }, { quoted: m });
    }
};

