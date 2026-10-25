'use strict';

const database = require('../../lib/database');
const { checkGroupPermissions } = require('../../lib/groupPermissions');

module.exports = {
    name: 'enviarlink',
    alias: ['sendlink', 'invitarto', 'enviargrupo'],
    category: 'grupo',
    desc: 'Envía el enlace de invitación del grupo actual por mensaje privado al número especificado',
    usage: '.enviarlink [número con código de país / @mención / citando mensaje]',
    groupOnly: true,
    adminOnly: true,
    botAdminRequired: true,

    execute: async ({ sock, m, args, text, groupMetadata, isBotAdmin, isAdmin, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;

        // 1. Verificación robusta de Administrador o Dueño
        let isSenderAdmin = isAdmin || isOwner || 
                           database.isOwner(m.sender, sock) || 
                           database.isOwner(m.key?.participant, sock) || 
                           Boolean(m.fromMe);

        if (!isSenderAdmin) {
            const perms = await checkGroupPermissions(sock, jid, m.sender, groupMetadata, m);
            isSenderAdmin = perms.isSenderAdmin || isOwner || database.isOwner(m.sender, sock);
        }

        if (!isSenderAdmin) {
            return await sock.sendMessage(jid, {
                text: '❌ Este comando es exclusivo para administradores del grupo.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        // 2. Extraer número destino por mención, mensaje citado o texto
        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = m.quoted?.sender || m.message?.extendedTextMessage?.contextInfo?.participant;

        let target = mentioned[0] || quotedParticipant;
        if (!target && text) {
            const raw = text.replace(/[^0-9]/g, '');
            if (raw.length >= 7 && raw.length <= 16) {
                target = `${raw}@s.whatsapp.net`;
            }
        }

        if (!target) {
            return await sock.sendMessage(jid, {
                text: '╭━━━━〔 🔗 *ENVIAR ENLACE DE GRUPO* 〕━━━━⬣\n' +
                      '┃\n' +
                      '┃ ❌ *Debes indicar a quién enviar la invitación.*\n' +
                      '┃\n' +
                      '┃ 💡 ═〔 *FORMAS DE USO* 〕═\n' +
                      '┃ ✦ `.enviarlink +18494509905` (Escribiendo el número)\n' +
                      '┃ ✦ `.enviarlink @usuario` (Mencionando en el chat)\n' +
                      '┃ ✦ Responde a un mensaje con `.enviarlink`\n' +
                      '┃\n' +
                      '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n' +
                      '_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const cleanNumber = target.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        if (!cleanNumber || cleanNumber.length < 7 || cleanNumber.length > 16) {
            return await sock.sendMessage(jid, {
                text: '❌ El número de teléfono destino no es válido. Asegúrate de incluir el código de país.\nEjemplo: *.enviarlink 18494509905*\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        if (typeof m.react === 'function') {
            try { await m.react('⏳'); } catch (_) {}
        }

        // 3. Pre-validación con onWhatsApp para evitar bucles de apretón de manos Signal y saturación de la terminal
        let targetJid = `${cleanNumber}@s.whatsapp.net`;
        if (typeof sock.onWhatsApp === 'function') {
            try {
                const results = await Promise.race([
                    sock.onWhatsApp(cleanNumber),
                    new Promise((resolve) => setTimeout(() => resolve([]), 3500))
                ]);
                const onWa = Array.isArray(results) ? results[0] : null;

                if (onWa) {
                    if (onWa.exists === false) {
                        if (typeof m.react === 'function') {
                            try { await m.react('❌'); } catch (_) {}
                        }
                        return await sock.sendMessage(jid, {
                            text: `❌ El número *+${cleanNumber}* no está registrado en WhatsApp.\n\n_Unknown Codexツ</>_`
                        }, { quoted: m });
                    }
                    if (onWa.jid) {
                        targetJid = onWa.jid;
                    }
                }
            } catch (_) {
                // Continuar con targetJid por defecto si falla la comprobación
            }
        }

        // 4. Obtener el código de invitación consultando directamente la autoridad del bot en WhatsApp
        let inviteCode;
        try {
            inviteCode = await sock.groupInviteCode(jid);
        } catch (err) {
            if (typeof m.react === 'function') {
                try { await m.react('❌'); } catch (_) {}
            }
            return await sock.sendMessage(jid, {
                text: '❌ No se pudo generar el enlace de invitación.\n' +
                      'Asegúrate de que el bot tenga el rango de *Administrador* en este grupo.\n\n' +
                      '_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const groupName = groupMetadata?.subject || 'este grupo';
        const inviteUrl = `https://chat.whatsapp.com/${inviteCode}`;
        const senderNum = (m.sender || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

        const privateMessage =
            `╭━━━━〔 📩 *INVITACIÓN DE GRUPO* 〕━━━━⬣\n` +
            `┃\n` +
            `┃ 👋 ¡Hola! Has recibido una invitación para unirte:\n` +
            `┃\n` +
            `┃ 🏷️ *Grupo:* ${groupName}\n` +
            `┃ 🔗 *Enlace de invitación:* ${inviteUrl}\n` +
            `┃ 👤 *Invitado por:* +${senderNum}\n` +
            `┃\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
            `_Unknown Codexツ</>_`;

        // 5. Envío seguro con timeout de protección para evitar bloqueos del socket
        try {
            await Promise.race([
                sock.sendMessage(targetJid, { text: privateMessage }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout_envio_privado')), 6000))
            ]);

            if (typeof m.react === 'function') {
                try { await m.react('✅'); } catch (_) {}
            }

            return await sock.sendMessage(jid, {
                text: `✅ *[ENLACE ENVIADO CON ÉXITO]*\n\n` +
                      `👤 *Destinatario:* +${cleanNumber}\n` +
                      `🏷️ *Grupo:* ${groupName}\n` +
                      `📩 La invitación ha sido enviada por mensaje privado.\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });

        } catch (sendErr) {
            if (typeof m.react === 'function') {
                try { await m.react('❌'); } catch (_) {}
            }
            const isTimeout = sendErr.message === 'timeout_envio_privado';
            return await sock.sendMessage(jid, {
                text: isTimeout 
                    ? `⚠️ El mensaje tardó en confirmarse, pero el enlace fue procesado para +${cleanNumber}.\n\n_Unknown Codexツ</>_`
                    : `❌ No se pudo enviar el mensaje privado a +${cleanNumber}.\nEs posible que el usuario tenga restringidos los mensajes de desconocidos.\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};
