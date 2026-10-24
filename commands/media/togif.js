'use strict';

const fs = require('fs-extra');
const { createTempPath, safeUnlink } = require('../../lib/cleaner');
const { runFfmpeg, isFfmpegAvailable } = require('../../lib/ffmpeg');
const logger = require('../../lib/logger');

module.exports = {
    name: 'togif',
    alias: ['vgif', 'videogif', 'agif'],
    category: 'multimedia',
    desc: 'Convierte un video corto (o sticker animado) en un GIF animado de WhatsApp (en bucle continuo)',
    usage: '.togif [citando o enviando video corto o sticker animado]',

    execute: async ({ sock, m }) => {
        let mediaBuffer = null;
        let isSticker = false;

        // 1. Detectar si el archivo proviene de un mensaje citado o mensaje directo
        if (m.quoted) {
            if (m.quoted.type === 'videoMessage') {
                const duration = m.quoted.message?.videoMessage?.seconds || 0;
                if (duration > 30) {
                    return await m.reply('❌ El video es demasiado largo para un GIF. Envía un video de máximo 30 segundos.');
                }
                mediaBuffer = await m.quoted.download();
            } else if (m.quoted.type === 'stickerMessage') {
                isSticker = true;
                mediaBuffer = await m.quoted.download();
            } else {
                return await m.reply('❌ Debes citar un video corto (máx. 30s) o sticker animado para convertirlo a GIF.');
            }
        } else if (m.type === 'videoMessage') {
            const duration = m.message?.videoMessage?.seconds || 0;
            if (duration > 30) {
                return await m.reply('❌ El video supera los 30 segundos permitidos para un GIF.');
            }
            mediaBuffer = await m.download();
        } else {
            return await m.reply('❌ Debes enviar o citar un video corto (o sticker animado) usando *.togif*');
        }

        if (!mediaBuffer || mediaBuffer.length === 0) {
            return await m.reply('❌ No se pudo descargar el archivo multimedia.');
        }

        await m.react('⏳');

        const inputPath = createTempPath(isSticker ? 'webp' : 'mp4');
        const outputPath = createTempPath('mp4');
        let tempGif = null;

        try {
            await fs.writeFile(inputPath, mediaBuffer);

            let converted = false;

            if (isFfmpegAvailable()) {
                if (isSticker) {
                    // Conversión de sticker animado WebP a MP4
                    try {
                        await runFfmpeg([
                            '-y',
                            '-r', '20',
                            '-i', inputPath,
                            '-an',
                            '-c:v', 'libx264',
                            '-preset', 'veryfast',
                            '-crf', '23',
                            '-pix_fmt', 'yuv420p',
                            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=20',
                            '-movflags', '+faststart',
                            outputPath
                        ], { timeout: 30000 });
                        converted = fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
                    } catch (stkErr) {
                        // Fallback con Sharp a GIF intermedio si FFmpeg no lee los metadatos del sticker WebP
                        try {
                            const sharp = require('sharp');
                            tempGif = createTempPath('gif');
                            const gifBuffer = await sharp(inputPath, { animated: true }).gif().toBuffer();
                            await fs.writeFile(tempGif, gifBuffer);
                            await runFfmpeg([
                                '-y',
                                '-i', tempGif,
                                '-an',
                                '-c:v', 'libx264',
                                '-preset', 'veryfast',
                                '-crf', '23',
                                '-pix_fmt', 'yuv420p',
                                '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
                                '-movflags', '+faststart',
                                outputPath
                            ], { timeout: 30000 });
                            converted = fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
                        } catch (sharpErr) {
                            logger.error('[TOGIF] Fallback Sharp falló:', sharpErr.message);
                        }
                    }
                } else {
                    // Conversión de video: silenciar audio y optimizar contenedor para GIF
                    try {
                        await runFfmpeg([
                            '-y',
                            '-i', inputPath,
                            '-an',
                            '-c:v', 'libx264',
                            '-preset', 'fast',
                            '-crf', '24',
                            '-pix_fmt', 'yuv420p',
                            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
                            '-movflags', '+faststart',
                            outputPath
                        ], { timeout: 30000 });
                        converted = fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
                    } catch (vidErr) {
                        logger.warn('[TOGIF] FFmpeg video encode falló:', vidErr.message);
                    }
                }
            }

            // Seleccionar buffer final (archivo convertido u original si FFmpeg falló en video)
            let finalBuffer = null;
            if (converted && fs.existsSync(outputPath)) {
                finalBuffer = await fs.readFile(outputPath);
            } else if (!isSticker) {
                // Para videos, Baileys puede reproducir el buffer original con gifPlayback si no se pudo convertir
                finalBuffer = mediaBuffer;
            }

            if (!finalBuffer || finalBuffer.length === 0) {
                await m.react('❌');
                return await m.reply('❌ No se pudo convertir el archivo a formato GIF.');
            }

            await sock.sendMessage(m.chat, {
                video: finalBuffer,
                gifPlayback: true,
                caption: `> 🎬 *${isSticker ? 'Sticker' : 'Video'} convertido a GIF con éxito.*`
            }, { quoted: m });

            await m.react('✅');
        } catch (err) {
            logger.error('[TOGIF ERROR]:', err.message);
            await m.react('❌');
            await m.reply(`❌ Ocurrió un error al convertir a GIF: ${err.message}`);
        } finally {
            await safeUnlink(inputPath);
            await safeUnlink(outputPath);
            if (tempGif) await safeUnlink(tempGif);
        }
    }
};

