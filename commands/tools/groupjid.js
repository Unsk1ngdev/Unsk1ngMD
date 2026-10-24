'use strict';

const premium = require('../../lib/premium');
const database = require('../../lib/database');

module.exports = {
    name: 'groupjid',
    alias: ['jidgroup', 'gruposjid', 'idgroup', 'listajid', 'getjid'],
    category: 'herramientas',
    desc: 'Obtiene el JID, nombre e integrantes de todos los grupos del bot o de un grupo específico mediante su link',
    usage: '.groupjid | .groupjid [link de invitación de WhatsApp]',

    execute: async ({ sock, m, args, isOwner, groupMetadata }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        // Verificación de membresía Premium u Owner
        const isPrem = isOwner || database.isOwner(sender, sock) || premium.isPremium(sender, sock);
        if (!isPrem) {
            return await sock.sendMessage(jid, {
                text: '> ♱ Este comando es exclusivo para usuarios *Premium* o el *Owner*.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const input = (args || []).join(' ').trim();

        // 1. Caso: El usuario proporciona un link de invitación de WhatsApp
        const linkMatch = input.match(/chat\.whatsapp\.com\/([0-9A-Za-z_-]{18,28})/i);
        if (linkMatch) {
            const inviteCode = linkMatch[1];
            await m.react('⏳').catch(() => {});

            try {
                const info = await sock.groupGetInviteInfo(inviteCode);
                if (!info) {
                    return await sock.sendMessage(jid, {
                        text: '❌ No se pudo obtener información del enlace. El enlace podría estar revocado o ser inválido.'
                    }, { quoted: m });
                }

                await m.react('✅').catch(() => {});

                const groupJid = info.id ? (info.id.includes('@') ? info.id : `${info.id}@g.us`) : 'No disponible';
                const creator = info.owner ? `@${info.owner.split('@')[0]}` : 'Desconocido';
                const memberCount = info.size || (Array.isArray(info.participants) ? info.participants.length : 'Desconocido');
                const descText = info.desc ? `\n\n📝 *Descripción:*\n${String(info.desc).slice(0, 200)}...` : '';

                const replyCard =
                    `╔══════════════════════════════╗\n` +
                    `║     🏷️ *JID DE GRUPO (LINK)* ║\n` +
                    `╚══════════════════════════════╝\n\n` +
                    `📛 *Nombre:* ${info.subject || 'Sin Nombre'}\n` +
                    `🆔 *JID:* \`${groupJid}\`\n` +
                    `👥 *Integrantes:* ${memberCount}\n` +
                    `👑 *Creador:* ${creator}${descText}\n\n` +
                    `_Unknown Codexツ</>_`;

                return await sock.sendMessage(jid, {
                    text: replyCard,
                    mentions: info.owner ? [info.owner] : []
                }, { quoted: m });

            } catch (err) {
                await m.react('❌').catch(() => {});
                return await sock.sendMessage(jid, {
                    text: `❌ Error al inspeccionar el enlace de grupo: ${err.message}`
                }, { quoted: m });
            }
        }

        // 2. Caso: Consultar el JID del grupo actual específicamente
        if (input.toLowerCase() === 'this' || input.toLowerCase() === 'aqui' || input.toLowerCase() === 'este') {
            if (!m.isGroup) {
                return await sock.sendMessage(jid, {
                    text: '❌ Esta opción solo puede usarse dentro de un grupo.'
                }, { quoted: m });
            }

            const subject = groupMetadata?.subject || 'Grupo';
            const count = Array.isArray(groupMetadata?.participants) ? groupMetadata.participants.length : 'Desconocido';

            const card =
                `╔══════════════════════════════╗\n` +
                `║      🏷️ *JID GRUPO ACTUAL*   ║\n` +
                `╚══════════════════════════════╝\n\n` +
                `📛 *Nombre:* ${subject}\n` +
                `🆔 *JID:* \`${jid}\`\n` +
                `👥 *Integrantes:* ${count}\n\n` +
                `_Unknown Codexツ</>_`;

            return await sock.sendMessage(jid, { text: card }, { quoted: m });
        }

        // 3. Caso general: Listar todos los grupos donde el bot participa
        await m.react('⏳').catch(() => {});

        try {
            const allGroups = await sock.groupFetchAllParticipating();
            const groupList = Object.values(allGroups || {});

            if (groupList.length === 0) {
                await m.react('⚠️').catch(() => {});
                return await sock.sendMessage(jid, {
                    text: '⚠️ El bot no participa en ningún grupo actualmente.'
                }, { quoted: m });
            }

            // Ordenar por cantidad de participantes descendente
            groupList.sort((a, b) => (b.participants?.length || 0) - (a.participants?.length || 0));

            let textResponse =
                `╔══════════════════════════════╗\n` +
                `║   📋 *LISTA DE JIDS DE GRUPOS*║\n` +
                `╚══════════════════════════════╝\n\n` +
                `🌐 *Total de grupos activos:* ${groupList.length}\n\n`;

            groupList.forEach((g, index) => {
                const count = Array.isArray(g.participants) ? g.participants.length : 0;
                const subject = g.subject || 'Sin Nombre';
                textResponse +=
                    `*[${index + 1}]* 📛 *${subject}*\n` +
                    `   🆔 *JID:* \`${g.id}\`\n` +
                    `   👥 *Integrantes:* ${count}\n\n`;
            });

            textResponse += `💡 *Tip:* Usa *.invisible [JID] [texto]* para enviar un mensaje invisible con tag silencioso a cualquier grupo.\n\n_Unknown Codexツ</>_`;

            await m.react('✅').catch(() => {});
            await sock.sendMessage(jid, { text: textResponse.trim() }, { quoted: m });

        } catch (err) {
            await m.react('❌').catch(() => {});
            await sock.sendMessage(jid, {
                text: `❌ Error al obtener la lista de grupos: ${err.message}`
            }, { quoted: m });
        }
    }
};

