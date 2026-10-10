const { imageToSticker, videoToSticker } = require('../../lib/media');
const config = require('../../config');

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
            if (m.quoted.type === 'imageMessage') {
                mediaBuffer = await m.quoted.download();
            } else if (m.quoted.type === 'videoMessage') {
                const duration = m.quoted.message?.videoMessage?.seconds || 0;
                if (duration > 10) {
                    return await m.reply('❌ El video es demasiado largo (máximo 10 segundos para stickers).');
                }
                mediaBuffer = await m.quoted.download();
                isVideo = true;
            } else {
                return await m.reply('❌ Por favor, cita una imagen o video corto para convertirlo en sticker.');
            }
        } else if (m.type === 'imageMessage') {
            mediaBuffer = await m.download();
        } else if (m.type === 'videoMessage') {
            const duration = m.message?.videoMessage?.seconds || 0;
            if (duration > 10) {
                return await m.reply('❌ El video supera los 10 segundos permitidos.');
            }
            mediaBuffer = await m.download();
            isVideo = true;
        } else {
            return await m.reply('❌ Envía o cita una imagen con el comando *.s* o *.sticker*');
        }

        if (!mediaBuffer) {
            return await m.reply('❌ No se pudo descargar el archivo multimedia.');
        }

        await m.react('⏳');

        // Metadatos por defecto: "Unsk1ngMD" y "Dev"
        let packname = config.packName;
        let author = config.authorName;
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
            throw new Error(`Fallo al generar el sticker: ${err.message}`);
        }
    }
};
