const { imageToSticker, videoToSticker } = require('../../lib/media');
const config = require('../../config');
const logger = require('../../lib/logger');

module.exports = {
    name: 'sticker',
    alias: ['s', 'pegatina'],
    category: 'multimedia',
    desc: 'Convierte una imagen o video corto a Sticker WebP con metadatos personalizados',
    usage: '.sticker [citando o enviando imagen o video corto]',
    execute: async ({ sock, m, text }) => {
        let mediaBuffer = null;
        let isVideo = false;

        // Verificar si se citó un mensaje con multimedia
        if (m.quoted) {
            const qType = m.quoted.type;
            if (qType === 'imageMessage') {
                mediaBuffer = await m.quoted.download();
            } else if (qType === 'videoMessage' || qType === 'ptvMessage') {
                const duration = m.quoted.message?.videoMessage?.seconds || m.quoted.message?.ptvMessage?.seconds || 0;
                if (duration > 15) {
                    return await m.reply('❌ El video es demasiado largo (máximo 10 a 15 segundos para stickers).');
                }
                mediaBuffer = await m.quoted.download();
                isVideo = true;
            } else {
                return await m.reply('❌ Por favor, cita una imagen o video corto para convertirlo en sticker.');
            }
        } else if (m.type === 'imageMessage') {
            mediaBuffer = await m.download();
        } else if (m.type === 'videoMessage' || m.type === 'ptvMessage') {
            const duration = m.message?.videoMessage?.seconds || m.message?.ptvMessage?.seconds || 0;
            if (duration > 15) {
                return await m.reply('❌ El video supera los 15 segundos permitidos.');
            }
            mediaBuffer = await m.download();
            isVideo = true;
        } else {
            return await m.reply('❌ Envía o cita una imagen o video corto con el comando *.s* o *.sticker*');
        }

        if (!mediaBuffer) {
            return await m.reply('❌ No se pudo descargar el archivo multimedia.');
        }

        await m.react('⏳');

        // Metadatos por defecto: "Unsk1ngMD" y "Dev"
        let packname = config.packName || 'Unsk1ngMD';
        let author = config.authorName || 'Dev';
        if (text && text.includes('|')) {
            const parts = text.split('|').map(s => s.trim());
            if (parts[0]) packname = parts[0];
            if (parts[1]) author = parts[1];
        }

        try {
            let stickerBuffer;
            if (isVideo) {
                stickerBuffer = await videoToSticker(mediaBuffer, { packname, author });
            } else {
                stickerBuffer = await imageToSticker(mediaBuffer, { packname, author });
            }

            await sock.sendMessage(m.chat, {
                sticker: stickerBuffer
            }, { quoted: m });

            await m.react('✅');
        } catch (err) {
            await m.react('❌');
            logger.error(`[STICKER] Fallo al generar el sticker: ${err.message}`);
            return await sock.sendMessage(m.chat, {
                text: `❌ Fallo al generar el sticker: ${err.message || 'Error procesando multimedia'}`
            }, { quoted: m });
        }
    }
};
