'use strict';

const { writeExif, imageToSticker, videoToSticker } = require('../../lib/media');
const config = require('../../config');
const logger = require('../../lib/logger');

module.exports = {
    name: 'wm',
    alias: ['take', 'watermark', 'stickerwm', 'marcadeagua', 'sautor'],
    category: 'multimedia',
    desc: 'Cambia o crea la marca de agua de un sticker con tu nombre de usuario y frase personalizada',
    usage: '.wm [frase] o .wm [pack | autor] (respondiendo a sticker, imagen o video corto)',

    execute: async ({ sock, m, text }) => {
        const jid = m.chat;

        // 1. Determinar tipo de multimedia
        const quoted = m.quoted;
        let isSticker = false;
        let isImage = false;
        let isVideo = false;
        let targetDuration = 0;

        if (quoted) {
            if (quoted.type === 'stickerMessage') {
                isSticker = true;
            } else if (quoted.type === 'imageMessage') {
                isImage = true;
            } else if (quoted.type === 'videoMessage' || quoted.type === 'ptvMessage') {
                isVideo = true;
                targetDuration = quoted.message?.videoMessage?.seconds || quoted.message?.ptvMessage?.seconds || 0;
            }
        } else if (m.type === 'imageMessage') {
            isImage = true;
        } else if (m.type === 'videoMessage' || m.type === 'ptvMessage') {
            isVideo = true;
            targetDuration = m.message?.videoMessage?.seconds || m.message?.ptvMessage?.seconds || 0;
        }

        if (!isSticker && !isImage && !isVideo) {
            const prefix = config.defaultPrefix || '.';
            return await sock.sendMessage(jid, {
                text: [
                    '🏷️ *MARCA DE AGUA PERSONALIZADA (.wm)*',
                    '',
                    '❌ *Debes responder a un sticker, imagen o video corto.*',
                    '',
                    '📌 *Ejemplos de uso:*',
                    `• *${prefix}wm hola* (Pone tu nombre arriba y "hola" abajo)`,
                    `• *${prefix}wm MiPack | MiFrase* (Personaliza ambos lados)`,
                    `• *${prefix}wm* (Usa tu nombre de usuario automáticamente)`,
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        if (isVideo && targetDuration > 10) {
            return await sock.sendMessage(jid, {
                text: '❌ El video es demasiado largo (máximo 10 segundos para stickers animados).'
            }, { quoted: m });
        }

        // 2. Determinar Packname (Arriba) y Author (Abajo)
        const userName = (m.pushName || '').trim() || 'Usuario';
        let packname = userName;
        let author = config.authorName || 'Unknown Codexツ</>';

        if (text && text.trim()) {
            const rawText = text.trim();
            if (rawText.includes('|')) {
                const parts = rawText.split('|').map(s => s.trim());
                packname = parts[0] || userName;
                author = parts.slice(1).join('|').trim() || (config.authorName || 'Unknown Codexツ</>');
            } else {
                // Si el usuario escribe una frase (ej: .wm hola),
                // arriba va su nombre de usuario y abajo la frase que escribió
                packname = userName;
                author = rawText;
            }
        }

        await m.react?.('⏳');

        try {
            // 3. Descargar el buffer multimedia
            const mediaBuffer = quoted ? await quoted.download() : await m.download();
            if (!mediaBuffer || mediaBuffer.length === 0) {
                await m.react?.('❌');
                return await sock.sendMessage(jid, {
                    text: '❌ No se pudo descargar el archivo multimedia.'
                }, { quoted: m });
            }

            let stickerBuffer;

            // 4. Procesar según el tipo
            if (isSticker) {
                // Re-empaquetar sticker existente (conserva animaciones si es animado)
                stickerBuffer = await writeExif(mediaBuffer, { packname, author });
            } else if (isImage) {
                stickerBuffer = await imageToSticker(mediaBuffer, { packname, author });
            } else if (isVideo) {
                stickerBuffer = await videoToSticker(mediaBuffer, { packname, author });
            }

            if (!stickerBuffer) {
                throw new Error('No se pudo generar el buffer final del sticker.');
            }

            // 5. Enviar el sticker resultante
            await sock.sendMessage(jid, {
                sticker: stickerBuffer
            }, { quoted: m });

            await m.react?.('✅');

        } catch (err) {
            logger.error('[WM ERROR]:', err.message);
            await m.react?.('❌');
            await sock.sendMessage(jid, {
                text: `❌ Ocurrió un error al procesar el sticker: ${err.message}`
            }, { quoted: m });
        }
    }
};

