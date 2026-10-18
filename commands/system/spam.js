'use strict';

const config = require('../../config');
const logger = require('../../lib/logger');

module.exports = {
    name: 'spam',
    alias: ['spammsg', 'spammear'],
    category: 'sistema',
    desc: 'Envía un mensaje repetidas veces al usuario o chat especificado (solo owner)',
    usage: '.spam @usuario [mensaje] [cantidad] | .spam [número] [mensaje] [cantidad]',
    ownerOnly: true,

    execute: async ({ sock, m, args, isOwner }) => {
        if (!isOwner) return;

        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        let target = mentioned[0] || (m.quoted && m.quoted.sender ? m.quoted.sender : null);
        let remainingArgs = [...(args || [])];

        // 1. Extraer objetivo si fue mencionado o si el primer argumento es un número telefónico
        if (target && remainingArgs.length > 0 && (remainingArgs[0].includes('@') || remainingArgs[0].startsWith('@'))) {
            remainingArgs.shift();
        } else if (!target && remainingArgs.length > 0) {
            const cleanNum = remainingArgs[0].replace(/[^0-9]/g, '');
            if (cleanNum.length >= 7 && cleanNum.length <= 16) {
                target = `${cleanNum}@s.whatsapp.net`;
                remainingArgs.shift();
            }
        }

        // Si no se especificó target explícito, el objetivo es el chat actual
        if (!target) {
            target = m.chat || m.key.remoteJid;
        }

        // Limpiar target
        target = target.replace(/:\d+@/, '@').trim();

        // 2. Extraer la cantidad del final de los argumentos si se especificó un número
        let cantidad = 5;
        if (remainingArgs.length > 0 && /^\d+$/.test(remainingArgs[remainingArgs.length - 1])) {
            const parsedCant = parseInt(remainingArgs[remainingArgs.length - 1], 10);
            if (parsedCant > 0) {
                cantidad = parsedCant;
                remainingArgs.pop();
            }
        }

        // 3. Extraer contenido del mensaje; si está vacío, usar el nombre del owner
        const ownerFallback = config.ownerName || 'Unknown Codexツ</>';
        const mensaje = remainingArgs.join(' ').trim() || ownerFallback;

        // Máximo 20 mensajes para proteger la integridad de la cuenta
        const total = Math.min(Math.max(cantidad || 5, 1), 20);

        const targetDisplay = target.replace('@s.whatsapp.net', '').replace('@g.us', ' (Grupo)');

        await sock.sendMessage(m.chat, {
            text: `📨 Enviando *${total}* mensajes a *${targetDisplay}*...`
        }, { quoted: m });

        let enviados = 0;
        for (let i = 0; i < total; i++) {
            try {
                await sock.sendMessage(target, { text: mensaje });
                enviados++;
                await new Promise((resolve) => setTimeout(resolve, 300));
            } catch (err) {
                logger.error('[SPAM] Error enviando mensaje individual:', err.message);
            }
        }

        await sock.sendMessage(m.chat, {
            text: `✅ *Spam completado*\n\n` +
                  `📨 Enviados: *${enviados}/${total}*\n` +
                  `👤 A: *${targetDisplay}*\n` +
                  `💬 Mensaje: *${mensaje}*\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};
