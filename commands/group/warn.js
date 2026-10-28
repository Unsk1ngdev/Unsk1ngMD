'use strict';

const warnManager = require('../../lib/warnManager');
const database = require('../../lib/database');
const userNames = require('../../lib/userNames');

function cleanJid(id) {
    if (!id) return '';
    return id.replace(/:.*@/, '@').split('@')[0] + '@s.whatsapp.net';
}

function resolveTarget(m, args) {
    if (m.mentionedJid && m.mentionedJid.length > 0) {
        return cleanJid(m.mentionedJid[0]);
    }
    if (m.quoted && m.quoted.sender) {
        return cleanJid(m.quoted.sender);
    }
    if (args && args[0]) {
        const raw = args[0].replace(/[^0-9]/g, '');
        if (raw.length >= 7) return `${raw}@s.whatsapp.net`;
    }
    return null;
}

module.exports = [
    // 1. .warn
    {
        name: 'warn',
        alias: ['advertir', 'advertencia'],
        category: 'grupo',
        desc: 'Advierte a un miembro del grupo. Al acumular 3 advertencias es expulsado automáticamente.',
        usage: '.warn @usuario [motivo]',
        groupOnly: true,
        adminOnly: true,

        execute: async ({ sock, m, args, isBotAdmin }) => {
            const chatId = m.chat;
            const targetJid = resolveTarget(m, args);

            if (!targetJid) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Debes mencionar o responder al mensaje del usuario que deseas advertir.\n\nEjemplo: *.warn @usuario Spam reiterado*'
                }, { quoted: m });
            }

            const botJid = cleanJid(sock.user?.id || sock.user?.jid);
            if (targetJid === botJid) {
                return await sock.sendMessage(chatId, { text: '❌ No puedes advertir al propio bot.' }, { quoted: m });
            }

            if (database.isOwner(targetJid, sock)) {
                return await sock.sendMessage(chatId, { text: '❌ No se puede advertir al creador/owner del bot.' }, { quoted: m });
            }

            const rawReason = args.slice(1).join(' ').trim();
            const reason = rawReason || 'Incumplimiento de normas del grupo';

            const userWarns = warnManager.addWarn(chatId, targetJid, reason);
            const userPhone = targetJid.split('@')[0];
            const userName = userNames.get(targetJid) || `@${userPhone}`;

            if (userWarns.count >= 3) {
                warnManager.resetWarns(chatId, targetJid);

                if (!isBotAdmin) {
                    return await sock.sendMessage(chatId, {
                        text: `⚠️ *LÍMITE DE ADVERTENCIAS (3/3)*\n\n` +
                              `👤 *Usuario:* ${userName} (@${userPhone})\n` +
                              `📌 *Razón:* ${reason}\n\n` +
                              `❌ *No pude expulsarlo:* El bot necesita ser administrador del grupo para expulsar.`,
                        mentions: [targetJid]
                    }, { quoted: m });
                }

                try {
                    await sock.groupParticipantsUpdate(chatId, [targetJid], 'remove');
                    return await sock.sendMessage(chatId, {
                        text: `🚫 *USUARIO EXPULSADO DEL GRUPO*\n\n` +
                              `👤 *Usuario:* ${userName} (@${userPhone})\n` +
                              `⚠️ *Motivo:* Acumuló 3 advertencias consecutivas.\n` +
                              `📝 *Última falta:* ${reason}\n\n` +
                              `_Unknown Codexツ</>_`,
                        mentions: [targetJid]
                    });
                } catch (expelErr) {
                    return await sock.sendMessage(chatId, {
                        text: `❌ Error al intentar expulsar a @${userPhone}: ${expelErr.message}`,
                        mentions: [targetJid]
                    });
                }
            }

            // Advertencia 1 o 2
            await sock.sendMessage(chatId, {
                text: `⚠️ *ADVERTENCIA APLICADA [${userWarns.count}/3]*\n\n` +
                      `👤 *Usuario:* ${userName} (@${userPhone})\n` +
                      `📌 *Motivo:* ${reason}\n\n` +
                      `_Cuidado: Si llegas a 3 advertencias serás expulsado del grupo._\n\n` +
                      `_Unknown Codexツ</>_`,
                mentions: [targetJid]
            }, { quoted: m });
        }
    },

    // 2. .unwarn
    {
        name: 'unwarn',
        alias: ['quitarwarn', 'removeradvertencia', 'delwarn'],
        category: 'grupo',
        desc: 'Remueve 1 advertencia a un miembro del grupo',
        usage: '.unwarn @usuario',
        groupOnly: true,
        adminOnly: true,

        execute: async ({ sock, m, args }) => {
            const chatId = m.chat;
            const targetJid = resolveTarget(m, args);

            if (!targetJid) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Debes mencionar o responder al mensaje del usuario para quitarle una advertencia.'
                }, { quoted: m });
            }

            const userWarns = warnManager.removeWarn(chatId, targetJid);
            const userPhone = targetJid.split('@')[0];

            await sock.sendMessage(chatId, {
                text: `✅ *ADVERTENCIA REMOVIDA*\n\n` +
                      `👤 *Usuario:* @${userPhone}\n` +
                      `📊 *Advertencias actuales:* [${userWarns.count}/3]\n\n` +
                      `_Unknown Codexツ</>_`,
                mentions: [targetJid]
            }, { quoted: m });
        }
    },

    // 3. .warnings
    {
        name: 'warnings',
        alias: ['warns', 'verwarns', 'advertencias'],
        category: 'grupo',
        desc: 'Consulta las advertencias activas de un usuario en este grupo',
        usage: '.warnings [@usuario opcional]',
        groupOnly: true,

        execute: async ({ sock, m, args }) => {
            const chatId = m.chat;
            const targetJid = resolveTarget(m, args) || cleanJid(m.sender);
            const userWarns = warnManager.getWarns(chatId, targetJid);
            const userPhone = targetJid.split('@')[0];

            if (userWarns.count === 0) {
                return await sock.sendMessage(chatId, {
                    text: `🟢 *EXPEDIENTE LIMPIO*\n\n` +
                          `👤 *Usuario:* @${userPhone}\n` +
                          `✨ No tiene ninguna advertencia en este grupo. ¡Sigue así!`,
                    mentions: [targetJid]
                }, { quoted: m });
            }

            const razonesTxt = userWarns.reasons.map((r, i) => `  ${i + 1}. ${r.reason} _(${r.date})_`).join('\n');

            await sock.sendMessage(chatId, {
                text: `⚠️ *REGISTRO DE ADVERTENCIAS [${userWarns.count}/3]*\n\n` +
                      `👤 *Usuario:* @${userPhone}\n\n` +
                      `📋 *Historial de faltas:*\n${razonesTxt}\n\n` +
                      `_Unknown Codexツ</>_`,
                mentions: [targetJid]
            }, { quoted: m });
        }
    }
];

