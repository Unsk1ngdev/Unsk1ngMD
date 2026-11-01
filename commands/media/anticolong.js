'use strict';

const logger = require('../../lib/logger');

module.exports = {
    name: 'anticolong',
    alias: ['anticuri', 'protegersticker', 'stickersafe', 'nosteal'],
    category: 'media',
    desc: 'Convierte un sticker en anti-colong (protegido con atributos de avatar para evitar que sea guardado o robado)',
    usage: '.anticolong (respondiendo a un sticker)',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const quoted = m.quoted;

        // Comprobar si el mensaje citado es un sticker
        const isSticker = Boolean(
            quoted && (
                quoted.type === 'stickerMessage' ||
                quoted.mtype === 'stickerMessage' ||
                quoted.message?.stickerMessage
            )
        );

        if (!isSticker) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🛡️ STICKER ANTI-COLONG 》 ❐',
                    '┃',
                    '┃├◆ 📋 *¿Qué hace este comando?*',
                    '┃  Convierte cualquier sticker en un sticker con',
                    '┃  atributos protegidos de WhatsApp (Avatar/Sistema).',
                    '┃  Esto dificulta que otros usuarios lo añadan a favoritos',
                    '┃  o lo reenvíen fácilmente (Anti-Curi).',
                    '┃',
                    '┃├◆ 📌 *Modo de uso:*',
                    '┃  1. Mantén presionado cualquier sticker en el chat.',
                    '┃  2. Dale a *Responder* (Reply).',
                    '┃  3. Escribe `.anticolong`',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        try {
            await m.react?.('⏳');

            let buffer = null;
            if (typeof quoted.download === 'function') {
                try {
                    buffer = await quoted.download();
                } catch (_) {}
            }

            if (!buffer && quoted.message?.stickerMessage) {
                const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                buffer = await downloadMediaMessage(
                    { message: quoted.message, key: quoted.key || m.key },
                    'buffer',
                    {},
                    { logger, reuploadRequest: sock.updateMediaMessage }
                );
            }

            if (!buffer || buffer.length === 0) {
                return await sock.sendMessage(jid, {
                    text: '❌ No se pudo descargar el sticker citado para protegerlo.\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            // Enviar con flags isAvatar e isAiSticker para activar la protección
            await sock.sendMessage(jid, {
                sticker: buffer,
                isAvatar: true,
                isAiSticker: true
            }, { quoted: m });

            await m.react?.('🛡️');
            await sock.sendMessage(jid, {
                text: '🛡️ *¡Sticker protegido con éxito (Anti-Colong)!*\nAhora cuenta con metadatos protegidos de sistema de WhatsApp para dificultar su robo y guardado.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });

        } catch (err) {
            logger.error('[ANTICOLONG ERROR]:', err.message);
            await sock.sendMessage(jid, {
                text: `❌ Error al proteger el sticker: ${err.message}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};

