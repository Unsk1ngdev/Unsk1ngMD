'use strict';

/**
 * Comando: .sms <número | @tag | reply> | <mensaje>
 *
 * Envía un mensaje anónimo a cualquier usuario o número de WhatsApp.
 * El destinatario puede responder de forma interactiva y la respuesta
 * llega de vuelta al remitente original sin revelar la identidad de ninguno.
 *
 * Extras incluidos:
 * - Soporte para @mención y respuesta (reply) a miembros de grupo.
 * - Hilo bidireccional continuo de conversación anónima.
 * - Protección contra spam y rate limit (5 envíos / 5 min).
 * - Bloqueo de privacidad: .sms block / .sms unblock para no recibir mensajes secretos.
 */

const smsManager = require('../../lib/smsAnon');

module.exports = {
    name: 'sms',
    alias: ['mensajeanon', 'anonmsg', 'secreto', 'smsanon'],
    category: 'herramientas',
    desc: 'Envía un mensaje 100% anónimo a cualquier número o usuario de WhatsApp con respuesta interactiva protegida.',
    usage: '.sms <número | @tag | reply> | <mensaje> (o .sms block / .sms unblock)',
    ownerOnly: false,

    execute: async ({ sock, m, args, text, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;
        const senderCleanNum = String(sender).split('@')[0].split(':')[0].replace(/\D/g, '');
        const fullText = (args && args.length > 0 ? args.join(' ') : (text || '')).trim();

        // ── 1. Comandos de Privacidad: .sms block / .sms unblock ──
        const lowerFirst = (args[0] || '').toLowerCase();
        if (lowerFirst === 'block' || lowerFirst === 'bloquear' || lowerFirst === 'optout') {
            smsManager.setBlocked(senderCleanNum, true);
            return await sock.sendMessage(jid, {
                text: [
                    '🛑 *[SMS ANÓNIMO - PRIVACIDAD]*',
                    '',
                    '🔒 Has *bloqueado* la recepción de mensajes anónimos.',
                    'A partir de ahora, nadie podrá enviarte mensajes secretos a través del bot.',
                    '',
                    '💡 _Si en el futuro deseas volver a activarlo, usa:_ `.sms unblock`',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        if (lowerFirst === 'unblock' || lowerFirst === 'desbloquear') {
            smsManager.setBlocked(senderCleanNum, false);
            return await sock.sendMessage(jid, {
                text: [
                    '✅ *[SMS ANÓNIMO - PRIVACIDAD]*',
                    '',
                    '🔓 Has *desbloqueado* la recepción de mensajes anónimos.',
                    'Ahora puedes volver a recibir mensajes secretos y responderlos.',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // ── 2. Verificar si es una RESPUESTA explícita a un SMS anónimo existente ──
        if (m.quoted) {
            const quotedId = m.quoted?.key?.id || m.quoted?.id;
            const session = quotedId ? smsManager.getSession(quotedId) : null;

            if (session) {
                const handled = await smsManager.handleReply(sock, m, fullText);
                if (handled) return;
            }
        }

        // ── 3. Guía interactiva si no hay argumentos o falta el separador ──
        if (!fullText || (!fullText.includes('|') && !m.quoted?.sender)) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 📨 SMS ANÓNIMO PREMIUM 》 ❐',
                    '┃',
                    '┃├◆ Envía mensajes anónimos a cualquier',
                    '┃  número o usuario de WhatsApp.',
                    '┃  *Tu identidad nunca será revelada.*',
                    '┃',
                    '┃├◆ 📋 *Formas de uso:*',
                    '┃  1️⃣ *Por número:*',
                    '┃     `.sms 18091234567 | Hola, me gustas 👀`',
                    '┃  2️⃣ *Por mención (@tag):*',
                    '┃     `.sms @usuario | Eres increíble!`',
                    '┃  3️⃣ *Respondiendo a un mensaje:*',
                    '┃     Cita a alguien y escribe: `.sms | Hola secreto`',
                    '┃',
                    '┃├◆ 🛡️ *Privacidad:*',
                    '┃  • `.sms block` ➔ Bloquear recepción de anónimos',
                    '┃  • `.sms unblock` ➔ Desbloquear recepción',
                    '┃',
                    '┃├◆ 💡 *Respuestas:*',
                    '┃  El destinatario puede pulsar *Reply* en',
                    '┃  el mensaje secreto y su respuesta te',
                    '┃  llegará manteniendo el anonimato.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // ── 4. Control de Spam / Rate limit (5 envíos cada 5 min) ──
        if (!isOwner && smsManager.isRateLimited(sender)) {
            return await sock.sendMessage(jid, {
                text: [
                    '⏳ *[LÍMITE DE VELOCIDAD]*',
                    'Has enviado demasiados SMS anónimos recientemente.',
                    'Por favor espera *5 minutos* antes de enviar otro mensaje.',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // ── 5. Parsear Destinatario y Mensaje ──
        let rawTarget = '';
        let mensaje = '';

        if (fullText.includes('|')) {
            const separadorIdx = fullText.indexOf('|');
            rawTarget = fullText.slice(0, separadorIdx).trim();
            mensaje = fullText.slice(separadorIdx + 1).trim();
        } else if (m.quoted?.sender) {
            rawTarget = m.quoted.sender;
            mensaje = fullText;
        }

        // Si usó mención (@usuario) en la primera parte
        if (m.mentionedJid && m.mentionedJid.length > 0 && (!rawTarget || rawTarget.includes('@'))) {
            rawTarget = m.mentionedJid[0];
        } else if (!rawTarget && m.quoted?.sender) {
            rawTarget = m.quoted.sender;
        }

        if (!rawTarget || !mensaje) {
            return await sock.sendMessage(jid, {
                text: '❌ *Formato incorrecto.*\n📌 Usa: `.sms número | mensaje` o `.sms @usuario | mensaje`\n\n_Unknown Codexツ</>_',
            }, { quoted: m });
        }

        // ── 6. Normalización y limpieza del número de destino ──
        let numLimpio = rawTarget.replace(/@s\.whatsapp\.net|@lid/g, '').replace(/[\s\-\(\)\+\.]/g, '');

        // Formatos dominicanos / NANP locales de 10 dígitos (809, 829, 849)
        if (['809', '829', '849'].some(c => numLimpio.startsWith(c)) && numLimpio.length === 10) {
            numLimpio = '1' + numLimpio;
        }
        // Formato local Venezuela (0416, 0414, 0424, 0412) de 11 dígitos
        if (numLimpio.startsWith('04') && numLimpio.length === 11) {
            numLimpio = '58' + numLimpio.slice(1);
        }

        numLimpio = numLimpio.replace(/\D/g, '');

        if (numLimpio.length < 7 || numLimpio.length > 15) {
            return await sock.sendMessage(jid, {
                text: `❌ Número o destinatario inválido: \`${rawTarget}\`\n💡 Usa el formato: \`18091234567\` o menciona con \`@usuario\`\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        const targetJid = numLimpio + '@s.whatsapp.net';
        const botNumber = (sock.user?.id || sock.user?.jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');

        // ── 7. Validaciones de Destino ──
        if (numLimpio === senderCleanNum) {
            return await sock.sendMessage(jid, {
                text: '😂 No puedes enviarte un SMS anónimo a ti mismo.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        if (botNumber && numLimpio === botNumber) {
            return await sock.sendMessage(jid, {
                text: '🤖 ¡No me envíes mensajes anónimos a mí! Ya sé todo lo que pasa aquí 😉\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        if (smsManager.isBlocked(numLimpio)) {
            return await sock.sendMessage(jid, {
                text: '🚫 *[DESTINATARIO NO DISPONIBLE]*\nEste usuario ha desactivado la recepción de mensajes anónimos.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        if (mensaje.length < 2) {
            return await sock.sendMessage(jid, {
                text: '❌ El mensaje es muy corto. Mínimo 2 caracteres.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        if (mensaje.length > 1500) {
            return await sock.sendMessage(jid, {
                text: `❌ El mensaje supera el límite máximo de 1500 caracteres (tienes ${mensaje.length}).\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // ── 8. Verificación de existencia en WhatsApp ──
        try {
            if (typeof sock.onWhatsApp === 'function') {
                const [existe] = await sock.onWhatsApp(numLimpio);
                if (existe && !existe.exists) {
                    return await sock.sendMessage(jid, {
                        text: `❌ El número \`${numLimpio}\` no tiene una cuenta activa en WhatsApp.\n\n_Unknown Codexツ</>_`
                    }, { quoted: m });
                }
            }
        } catch (_) {}

        // ── 9. Enviar el mensaje limpio sin plantillas ni decoraciones ──
        try {
            await m.react?.('⏳');

            const sentMsg = await sock.sendMessage(targetJid, {
                text: mensaje
            });

            // Registrar sesión para habilitar el canal de respuesta
            if (sentMsg?.key?.id) {
                smsManager.registerMessage(sentMsg.key.id, {
                    senderJid: sender,
                    senderChat: jid,
                    targetJid: targetJid
                });
            }

            await m.react?.('✅');

            await sock.sendMessage(jid, {
                text: `✅ Mensaje enviado exitosamente a +${numLimpio}.`
            }, { quoted: m });

        } catch (err) {
            await m.react?.('❌');
            await sock.sendMessage(jid, {
                text: `❌ Error al enviar: ${err.message}`
            }, { quoted: m });
        }
    }
};
