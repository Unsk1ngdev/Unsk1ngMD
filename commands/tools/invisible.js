'use strict';

const premium = require('../../lib/premium');
const database = require('../../lib/database');
const userNames = require('../../lib/userNames');

const cleanJid = (jid) => {
    if (!jid) return '';
    return String(jid).replace(/:.*@/, '@').trim().toLowerCase();
};

module.exports = {
    name: 'invisible',
    alias: ['invisibletxt', 'msginvisible', 'ghostmsg', 'fantasmamsg'],
    category: 'herramientas',
    desc: 'Envía un mensaje en modo desconectado con notificación silenciosa a todos los miembros (hidetag limpio)',
    usage: '.invisible [texto] | .invisible [JID_del_grupo] [texto]',

    execute: async ({ sock, m, args, isOwner, groupMetadata, participants }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        // Verificación de membresía Premium u Owner
        const isPrem = isOwner || database.isOwner(sender, sock) || premium.isPremium(sender, sock);
        if (!isPrem) {
            return await sock.sendMessage(jid, {
                text: '> ♱ Solo _owner_ o _premium_ pueden usar este comando.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        let targetJid = jid;
        let msgText = '';
        let targetGroupSubject = null;

        // 1. Detección de destino: comprobar si el primer argumento es un JID, link de grupo o número telefónico
        const firstArg = (args && args[0]) ? String(args[0]).trim() : '';
        let isGroupJid = firstArg.endsWith('@g.us');
        let isUserJid = firstArg.endsWith('@s.whatsapp.net') || firstArg.endsWith('@lid');
        const rawPhone = firstArg.replace(/^@/, '').replace(/[^0-9]/g, '');
        const isPhone = !isGroupJid && !isUserJid && rawPhone.length >= 7 && rawPhone.length <= 15;

        // Detectar si pasaron un enlace de invitación
        const linkMatch = firstArg.match(/chat\.whatsapp\.com\/([0-9A-Za-z_-]{18,28})/i);
        if (linkMatch) {
            try {
                const info = await sock.groupGetInviteInfo(linkMatch[1]);
                if (info && info.id) {
                    targetJid = info.id.includes('@') ? info.id : `${info.id}@g.us`;
                    isGroupJid = true;
                    msgText = (args || []).slice(1).join(' ').trim();
                }
            } catch (_) {}
        } else if (isGroupJid) {
            targetJid = firstArg;
            msgText = (args || []).slice(1).join(' ').trim();
        } else if (!isGroupJid && !isUserJid && (/^120363[0-9]{12}$/.test(rawPhone) || /^[0-9]+-[0-9]+$/.test(firstArg))) {
            // JID de grupo proporcionado sin @g.us
            targetJid = `${firstArg}@g.us`;
            isGroupJid = true;
            msgText = (args || []).slice(1).join(' ').trim();
        } else if (isUserJid) {
            targetJid = firstArg;
            msgText = (args || []).slice(1).join(' ').trim();
        } else if (isPhone && (args || []).length > 1) {
            targetJid = `${rawPhone}@s.whatsapp.net`;
            msgText = (args || []).slice(1).join(' ').trim();
        } else {
            // El objetivo es el chat actual
            targetJid = jid;
            msgText = (args || []).join(' ').trim();
        }

        // Si no se proporcionó texto, revisar si se citó un mensaje previo
        if (!msgText && m.quoted?.body) {
            msgText = String(m.quoted.body).trim();
        }

        if (!msgText) {
            return await sock.sendMessage(jid, {
                text:
                    `> ♱ *Uso del comando Invisible:*\n\n` +
                    `• *En el chat actual:* \`.invisible [texto]\`\n` +
                    `• *A otro grupo:* \`.invisible [JID_del_grupo] [texto]\`\n\n` +
                    `_El mensaje se enviará completamente limpio y etiquetará a todos los miembros en segundo plano de forma silenciosa (hidetag)._`
            }, { quoted: m });
        }

        await m.react('⏳').catch(() => {});

        try {
            // 2. Si el destino es un grupo, obtener todos los participantes para hacer @tag silencioso
            const mentionsList = [];
            const isTargetGroup = targetJid.endsWith('@g.us');

            if (isTargetGroup) {
                let targetParticipants = [];

                // 2.1. Si el destino es el grupo actual y ya disponemos de participantes
                if (targetJid === jid && Array.isArray(participants) && participants.length > 0) {
                    targetParticipants = participants;
                    targetGroupSubject = groupMetadata?.subject || 'Grupo actual';
                }

                // 2.2. Si aún no tenemos participantes (o es remoto), consultar groupMetadata
                if (targetParticipants.length === 0) {
                    try {
                        const meta = await sock.groupMetadata(targetJid);
                        if (meta && Array.isArray(meta.participants) && meta.participants.length > 0) {
                            targetParticipants = meta.participants;
                            targetGroupSubject = meta.subject || targetJid;
                        }
                    } catch (_) {}
                }

                // 2.3. Fallback: buscar en sock.groupFetchAllParticipating
                if (targetParticipants.length === 0 && typeof sock.groupFetchAllParticipating === 'function') {
                    try {
                        const allGroups = await sock.groupFetchAllParticipating();
                        const found = allGroups && allGroups[targetJid];
                        if (found && Array.isArray(found.participants) && found.participants.length > 0) {
                            targetParticipants = found.participants;
                            targetGroupSubject = found.subject || targetJid;
                        }
                    } catch (_) {}
                }

                // 2.4. Extraer todas las menciones (LID, número @s.whatsapp.net y cruce con userNames)
                const mentionsSet = new Set();
                if (targetParticipants.length > 0) {
                    for (const p of targetParticipants) {
                        if (!p) continue;

                        const rawId = p.id || p.jid;
                        const cleanId = cleanJid(rawId);
                        if (cleanId) {
                            mentionsSet.add(cleanId);
                        }

                        if (p.jid) {
                            const cJid = cleanJid(p.jid);
                            if (cJid) mentionsSet.add(cJid);
                        }

                        if (p.lid) {
                            const cLid = cleanJid(p.lid);
                            if (cLid) mentionsSet.add(cLid);
                        }

                        const pPhone = String(p.phoneNumber || p.phone_number || '').replace(/[^0-9]/g, '');
                        if (pPhone && pPhone.length >= 7 && pPhone.length <= 15) {
                            mentionsSet.add(`${pPhone}@s.whatsapp.net`);
                        }

                        // Vincular con userNames para cubrir tanto LID como número telefónico real
                        try {
                            const digits = cleanId.split('@')[0].replace(/[^0-9]/g, '');
                            if (cleanId.endsWith('@lid')) {
                                const linkedPhone = userNames.getPhoneByLid(cleanId) || userNames.getPhoneByLid(digits);
                                if (linkedPhone) {
                                    mentionsSet.add(`${linkedPhone}@s.whatsapp.net`);
                                }
                            } else if (cleanId.endsWith('@s.whatsapp.net')) {
                                const linkedLid = userNames.getLidByPhone(cleanId) || userNames.getLidByPhone(digits);
                                if (linkedLid) {
                                    mentionsSet.add(`${linkedLid}@lid`);
                                }
                            }
                        } catch (_) {}
                    }
                }

                mentionsList.push(...mentionsSet);
            }

            // 3. Establecer presencia en 'unavailable' (offline) en el chat destino
            await sock.sendPresenceUpdate('unavailable', targetJid).catch(() => {});
            await new Promise(resolve => setTimeout(resolve, 350));

            // 4. Enviar el mensaje limpio (con menciones silenciosas a todos si es grupo)
            const sendOptions = {
                text: msgText
            };

            if (mentionsList.length > 0) {
                sendOptions.mentions = mentionsList;
            }

            await sock.sendMessage(targetJid, sendOptions);

            // 5. Reafirmar presencia offline inmediatamente tras el envío
            await sock.sendPresenceUpdate('unavailable', targetJid).catch(() => {});

            await m.react('👻').catch(() => {});

            // 6. Si se envió a un chat remoto diferente al actual, confirmar entrega al usuario
            if (targetJid !== jid) {
                const targetName = targetGroupSubject ? `*${targetGroupSubject}*` : `\`${targetJid}\``;
                const tagInfo = mentionsList.length > 0 
                    ? `\n👥 *Notificados:* ${mentionsList.length} miembros (Hidetag silencioso)`
                    : (isTargetGroup ? '\n⚠️ *Aviso:* No se detectaron participantes para notificar en este grupo.' : '');

                await sock.sendMessage(jid, {
                    text:
                        `👻 *MENSAJE INVISIBLE ENVIADO*\n\n` +
                        `🎯 *Destino:* ${targetName}${tagInfo}\n` +
                        `💬 *Mensaje:* "${msgText}"\n\n` +
                        `_Unknown Codexツ</>_`
                }, { quoted: m });
            }

        } catch (err) {
            await m.react('❌').catch(() => {});
            await sock.sendMessage(jid, {
                text: `> ❌ Error al enviar mensaje invisible: ${err.message}`
            }, { quoted: m });
        }
    }
};
