'use strict';

const { generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const premium = require('../../lib/premium');
const database = require('../../lib/database');
const logger = require('../../lib/logger');

module.exports = {
    name: 'fakechat',
    alias: ['fakemsg', 'chatfalso', 'fakesay', 'msgfalso'],
    category: 'premium',
    desc: 'Genera un mensaje simulado de WhatsApp como si lo hubiera enviado otra persona (Premium)',
    usage: '.fakechat [@usuario / núm / citar] [mensaje]',
    premiumOnly: true,

    execute: async ({ sock, m, args, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        // 1. Verificación de permiso: Solo Owner y miembros Premium
        const isPermitted = isOwner || database.isOwner(sender, sock) || premium.isPremium(sender, sock);
        if (!isPermitted) {
            return await sock.sendMessage(jid, {
                text: '⭐ Este comando es solo para *Premium*.\nUsa *.prem* para más información.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        // 2. Detección del objetivo y mensaje
        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const isGroup = jid.endsWith('@g.us');
        let targetJid = null;
        let fakeText = '';

        if (mentioned.length > 0) {
            // .fakechat @usuario mensaje falso
            targetJid = mentioned[0];
            fakeText = (args || [])
                .join(' ')
                .replace(/@\d+/g, '')
                .trim();
        } else if (m.quoted && (m.quoted.sender || m.quoted.key?.participant)) {
            // Citar mensaje de alguien
            targetJid = m.quoted.sender || m.quoted.key?.participant;
            fakeText = (args || []).join(' ').trim();
        } else if (args[0]?.startsWith('+') || /^\d{7,15}$/.test(args[0])) {
            // .fakechat +18094509905 mensaje falso
            const num = args[0].replace(/[^0-9]/g, '');
            targetJid = `${num}@s.whatsapp.net`;
            fakeText = args.slice(1).join(' ').trim();
        } else if (!isGroup) {
            // En chat privado: detecta automáticamente al interlocutor
            targetJid = m.fromMe ? jid : (m.sender || jid);
            fakeText = (args || []).join(' ').trim();
        }

        if (!targetJid) {
            return await sock.sendMessage(jid, {
                text: '╭━━━〔 🎭 *USO DE FAKECHAT* 〕━━━⬣\n' +
                      '┃ 📋 *Uso:* `.fakechat [objetivo] [mensaje]`\n' +
                      '┃ \n' +
                      '┃ 💡 *Formas de uso:*\n' +
                      '┃ • En privado: `.fakechat mensaje` (detecta al usuario)\n' +
                      '┃ • En grupo: `.fakechat @usuario mensaje`\n' +
                      '┃ • Por número: `.fakechat +18094509905 mensaje`\n' +
                      '┃ • Citando: Responde a un mensaje con `.fakechat mensaje`\n' +
                      '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n' +
                      '_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        if (!fakeText) {
            return await sock.sendMessage(jid, {
                text: '❌ Debes escribir el mensaje falso.\n' +
                      '• En privado: `.fakechat [mensaje]` o `.fakechat [msg1] | [msg2]`\n' +
                      '• En grupo: `.fakechat @usuario [mensaje]`\n\n' +
                      '_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        // Normalización rigurosa de JID
        targetJid = targetJid.replace(/:.*@/, '@').trim();
        if (!targetJid.includes('@')) {
            targetJid += '@s.whatsapp.net';
        }

        try {
            // Obtener nombre público del objetivo
            let targetName = targetJid.split('@')[0];
            if (m.pushName && (targetJid === m.sender || targetJid === jid)) {
                targetName = m.pushName;
            } else if (m.quoted && (m.quoted.sender === targetJid) && m.quoted.pushName) {
                targetName = m.quoted.pushName;
            } else {
                try {
                    const contact = await sock.onWhatsApp(targetJid);
                    if (contact && contact[0]?.notify) {
                        targetName = contact[0].notify;
                    }
                } catch (_) {}
            }

            // Soporte opcional para separación de mensaje citado y respuesta (formato: citado | respuesta)
            let targetText = fakeText;
            let replyText = fakeText;
            if (fakeText.includes('|')) {
                const parts = fakeText.split('|');
                targetText = parts[0].trim();
                replyText = parts.slice(1).join('|').trim() || targetText;
            }

            if (isGroup) {
                // Modo Grupo: Inyección directa mediante generateWAMessageFromContent + relayMessage
                let relaySuccess = false;
                try {
                    const fakeMsg = generateWAMessageFromContent(
                        jid,
                        {
                            extendedTextMessage: {
                                text: fakeText,
                                contextInfo: {
                                    mentionedJid: [targetJid]
                                }
                            }
                        },
                        {
                            userJid: targetJid,
                            quoted: m.quoted || undefined
                        }
                    );

                    fakeMsg.key.fromMe = false;
                    fakeMsg.key.participant = targetJid;
                    fakeMsg.key.remoteJid = jid;
                    fakeMsg.pushName = targetName;

                    await sock.relayMessage(jid, fakeMsg.message, {
                        messageId: fakeMsg.key.id,
                        participant: targetJid,
                        additionalAttributes: {
                            participant: targetJid
                        }
                    });

                    relaySuccess = true;
                } catch (errRelay) {
                    logger.warn('[FAKECHAT RELAY GROUP ERROR]:', errRelay.message);
                }

                // Fallback para grupos si relayMessage llegara a fallar
                if (!relaySuccess) {
                    const fakeQuoted = {
                        key: {
                            remoteJid: jid,
                            fromMe: false,
                            id: 'FAKE' + Date.now().toString(36).toUpperCase(),
                            participant: targetJid
                        },
                        message: {
                            conversation: targetText
                        },
                        pushName: targetName
                    };

                    await sock.sendMessage(jid, {
                        text: replyText,
                        contextInfo: {
                            mentionedJid: [targetJid]
                        }
                    }, { quoted: fakeQuoted });
                }
            } else {
                // Modo Chat Privado (DM):
                // En chats 1:1, los servidores de WhatsApp descartan relayMessage con remitente falso por protocolo E2E.
                // Se envía directamente mediante cita simulada (Fake Quote) con renderizado perfecto e infalible.
                const fakeQuoted = {
                    key: {
                        remoteJid: targetJid,
                        fromMe: false,
                        id: 'FAKE' + Date.now().toString(36).toUpperCase(),
                        participant: targetJid
                    },
                    message: {
                        conversation: targetText
                    },
                    pushName: targetName
                };

                await sock.sendMessage(jid, {
                    text: replyText,
                    contextInfo: {
                        mentionedJid: [targetJid]
                    }
                }, { quoted: fakeQuoted });
            }

            if (typeof m.react === 'function') {
                await m.react('🎭');
            }

        } catch (err) {
            logger.error('[FAKECHAT ERROR]:', err);
            await sock.sendMessage(jid, {
                text: `❌ Error al generar el mensaje simulado: ${err.message || 'Error desconocido'}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};

