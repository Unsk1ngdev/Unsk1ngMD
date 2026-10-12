'use strict';

const fs = require('fs-extra');
const path = require('path');

const RANK_FILE = path.join(process.cwd(), 'rank.json');

const loadRankData = () => {
    try {
        if (!fs.existsSync(RANK_FILE)) return {};
        return fs.readJsonSync(RANK_FILE);
    } catch (_) {
        return {};
    }
};

module.exports = {
    name: 'inactivos',
    alias: ['ghostmembers', 'fantasmas', 'inactive'],
    category: 'grupo',
    desc: 'Detecta y permite expulsar a los miembros del grupo sin actividad registrada',
    usage: '.inactivos [kick]',
    groupOnly: true,

    execute: async ({ sock, m, args, groupMetadata, participants, isBotAdmin, isAdmin, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;

        if (!jid.endsWith('@g.us')) {
            return await sock.sendMessage(jid, {
                text: '❌ Solo funciona en grupos.'
            }, { quoted: m });
        }

        // Permisos de administrador o dueño
        let groupMeta = groupMetadata;
        if (!groupMeta) {
            try {
                groupMeta = await sock.groupMetadata(jid);
            } catch (_) {}
        }

        const senderAdmin = groupMeta?.participants?.find(p => {
            const cleanId = (p.id || '').split(':')[0] + '@s.whatsapp.net';
            const cleanSender = (m.sender || '').split(':')[0] + '@s.whatsapp.net';
            return cleanId === cleanSender;
        })?.admin;

        if (!isOwner && !isAdmin && !senderAdmin) {
            return await sock.sendMessage(jid, {
                text: '❌ Solo admins pueden usar este comando.'
            }, { quoted: m });
        }

        const subCmd = args[0]?.toLowerCase();
        const botJid = (sock.user?.id || sock.user?.jid || '').split(':')[0] + '@s.whatsapp.net';

        await sock.sendMessage(jid, {
            text: '🔍 Analizando actividad del grupo...'
        }, { quoted: m });

        try {
            const rankData = loadRankData();
            const groupRank = rankData[jid] || {};
            const allParticipants = groupMeta?.participants || participants || [];

            // Filtrar inactivos con número limpio (sin :xx@s.whatsapp.net)
            const inactivos = allParticipants
                .filter(p => {
                    const cleanId = (p.id || '').split(':')[0] + '@s.whatsapp.net';
                    if (!cleanId || cleanId === botJid) return false;
                    // Proteger a los administradores del grupo
                    if (p.admin) return false;

                    const msgs = groupRank[p.id] || groupRank[cleanId] || 0;
                    return msgs === 0;
                })
                .map(p => {
                    const cleanNumero = (p.id || '').replace('@s.whatsapp.net', '').split(':')[0].replace(/[^0-9]/g, '');
                    return {
                        jid: p.id,
                        numero: cleanNumero,
                        mensajes: groupRank[p.id] || groupRank[p.id.split(':')[0] + '@s.whatsapp.net'] || 0
                    };
                });

            if (inactivos.length === 0) {
                return await sock.sendMessage(jid, {
                    text: '✅ No hay miembros inactivos detectados.\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            // Expulsar a todos los inactivos
            if (subCmd === 'kick' || subCmd === 'expulsar' || subCmd === 'limpiar') {
                const botIsAdmin = isBotAdmin || allParticipants.find(p => {
                    const cleanId = (p.id || '').split(':')[0] + '@s.whatsapp.net';
                    return cleanId === botJid;
                })?.admin;

                if (!botIsAdmin) {
                    return await sock.sendMessage(jid, {
                        text: '❌ El bot necesita ser admin para expulsar.'
                    }, { quoted: m });
                }

                await sock.sendMessage(jid, {
                    text: `⚠️ Expulsando *${inactivos.length}* inactivos...`
                }, { quoted: m });

                let expulsados = 0;
                for (const inactivo of inactivos) {
                    try {
                        await sock.groupParticipantsUpdate(jid, [inactivo.jid], 'remove');
                        expulsados++;
                        await new Promise(r => setTimeout(r, 500));
                    } catch (_) {}
                }

                return await sock.sendMessage(jid, {
                    text: `✅ *Limpieza completada*\n\n` +
                          `👥 Expulsados: *${expulsados}* inactivos\n\n` +
                          `_Unknown Codexツ</>_`
                }, { quoted: m });
            }

            // Mostrar lista con menciones y números limpios
            const mentions = inactivos.map(i => i.jid);
            const lista = inactivos.slice(0, 20).map((i, idx) =>
                `${idx + 1}. @${i.numero} *(+${i.numero})*\n` +
                `   💬 Mensajes: *${i.mensajes}*`
            ).join('\n\n');

            await sock.sendMessage(jid, {
                text: `╔══════════════════╗\n` +
                      `║  🕐 *MIEMBROS INACTIVOS*  ║\n` +
                      `╚══════════════════╝\n\n` +
                      `${lista}\n\n` +
                      `━━━━━━━━━━━━━━━\n` +
                      `👥 Total inactivos: *${inactivos.length}*\n` +
                      `👁️ Total miembros: *${allParticipants.length}*\n\n` +
                      `⚠️ Usa *.inactivos kick* para expulsarlos\n\n` +
                      `_Unknown Codexツ</>_`,
                mentions
            }, { quoted: m });

        } catch (e) {
            console.error('[INACTIVOS ERROR]:', e.message);
            await sock.sendMessage(jid, {
                text: `❌ Error: ${e.message}`
            }, { quoted: m });
        }
    }
};
