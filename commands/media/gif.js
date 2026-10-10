const { videoToSticker } = require('../../lib/media');
const config = require('../../config');

module.exports = {
    name: 'gif',
    alias: ['smp4', 'stickergif', 'sgif'],
    category: 'multimedia',
    desc: 'Convierte un video corto (máximo 10s) o GIF en un sticker animado optimizado',
    usage: '.gif [citando o enviando video corto o GIF]',
    execute: async ({ sock, m, text }) => {
        let mediaBuffer = null;

        // Verificar si se citó un mensaje con video/gif
        if (m.quoted) {
            if (m.quoted.type === 'videoMessage') {
                const duration = m.quoted.message?.videoMessage?.seconds || 0;
                if (duration > 10) {
                    return await m.reply('❌ El video es demasiado largo. El límite máximo para stickers animados es de 10 segundos.');
                }
                mediaBuffer = await m.quoted.download();
            } else {
                return await m.reply('❌ Cita un video corto o GIF para convertirlo a sticker animado.');
            }
        } else if (m.type === 'videoMessage') {
            const duration = m.message?.videoMessage?.seconds || 0;
            if (duration > 10) {
                return await m.reply('❌ El video supera los 10 segundos permitidos.');
            }
            mediaBuffer = await m.download();
        } else {
            return await m.reply('❌ Debes enviar o citar un video corto (máx. 10s) o GIF usando el comando *.gif*');
        }

        if (!mediaBuffer) {
            return await m.reply('❌ No se pudo descargar el video/GIF.');
        }

        await m.react('⏳');

        // Metadatos por defecto: "Unsk1ngMD" y "Dev" (o personalizados si el usuario los envía)
        let packname = config.packName;
        let author = config.authorName;
        if (text && text.includes('|')) {
            const parts = text.split('|').map(s => s.trim());
            if (parts[0]) packname = parts[0];
            if (parts[1]) author = parts[1];
        }

        try {
            const animatedSticker = await videoToSticker(mediaBuffer, { packname, author });

            await sock.sendMessage(m.chat, {
                sticker: animatedSticker
            }, { quoted: m });

            await m.react('✅');
        } catch (err) {
            await m.react('❌');
            throw new Error(`Error al generar sticker animado: ${err.message}`);
        }
    }
};

