const { videoToSticker, writeExif } = require('../../lib/media');
const config = require('../../config');
const logger = require('../../lib/logger');

module.exports = {
    name: 'gif',
    alias: ['smp4', 'stickergif', 'sgif'],
    category: 'multimedia',
    desc: 'Convierte un video corto (máximo 10s) o GIF en un sticker animado optimizado',
    usage: '.gif [citando o enviando video corto o GIF]',
    execute: async ({ sock, m, text }) => {
        let mediaBuffer = null;
        let isSticker = false;

        // 1. Detectar si el mensaje es citado o directo
        if (m.quoted) {
            const qType = m.quoted.type;
            const qDocMime = m.quoted.message?.documentMessage?.mimetype || '';

            if (qType === 'videoMessage' || qType === 'ptvMessage') {
                const duration = m.quoted.message?.videoMessage?.seconds || m.quoted.message?.ptvMessage?.seconds || 0;
                if (duration > 15) {
                    return await m.reply('❌ El video es demasiado largo. El límite máximo para stickers animados es de 10 a 15 segundos.');
                }
                mediaBuffer = await m.quoted.download();
            } else if (qType === 'documentMessage' && (qDocMime.startsWith('video/') || qDocMime === 'image/gif')) {
                mediaBuffer = await m.quoted.download();
            } else if (qType === 'stickerMessage') {
                isSticker = true;
                mediaBuffer = await m.quoted.download();
            } else {
                return await m.reply('❌ Cita un video corto, GIF o sticker animado para convertirlo a sticker animado.');
            }
        } else if (m.type === 'videoMessage' || m.type === 'ptvMessage') {
            const duration = m.message?.videoMessage?.seconds || m.message?.ptvMessage?.seconds || 0;
            if (duration > 15) {
                return await m.reply('❌ El video supera los 15 segundos permitidos para stickers animados.');
            }
            mediaBuffer = await m.download();
        } else if (m.type === 'documentMessage') {
            const docMime = m.message?.documentMessage?.mimetype || '';
            if (docMime.startsWith('video/') || docMime === 'image/gif') {
                mediaBuffer = await m.download();
            } else {
                return await m.reply('❌ Debes enviar o citar un video corto (máx. 10s) o GIF usando el comando *.gif*');
            }
        } else {
            return await m.reply('❌ Debes enviar o citar un video corto (máx. 10s) o GIF usando el comando *.gif*');
        }

        if (!mediaBuffer || mediaBuffer.length === 0) {
            return await m.reply('❌ No se pudo descargar el video/GIF.');
        }

        await m.react('⏳');

        // Metadatos por defecto: packName y authorName
        let packname = config.packName || 'Unsk1ngMD';
        let author = config.authorName || 'Dev';
        if (text && text.includes('|')) {
            const parts = text.split('|').map(s => s.trim());
            if (parts[0]) packname = parts[0];
            if (parts[1]) author = parts[1];
        } else if (text && text.trim()) {
            packname = text.trim();
        }

        try {
            let animatedSticker;
            if (isSticker) {
                // Si ya es sticker, re-empaquetamos con metadatos
                animatedSticker = await writeExif(mediaBuffer, { packname, author });
            } else {
                animatedSticker = await videoToSticker(mediaBuffer, { packname, author });
            }

            await sock.sendMessage(m.chat, {
                sticker: animatedSticker
            }, { quoted: m });

            await m.react('✅');
        } catch (err) {
            await m.react('❌');
            logger.error(`[GIF] Error al generar sticker animado: ${err.message}`);
            return await sock.sendMessage(m.chat, {
                text: `❌ Error al generar sticker animado: ${err.message || 'No se pudo procesar el archivo multimedia'}. Asegúrate de que el video o GIF no esté corrupto.`
            }, { quoted: m });
        }
    }
};

