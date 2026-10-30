'use strict';

const fs = require('fs-extra');
const sharp = require('sharp');
const webpmux = require('node-webpmux');
const { createTempPath, safeUnlink } = require('../../lib/cleaner');
const { runFfmpeg, isFfmpegAvailable } = require('../../lib/ffmpeg');
const logger = require('../../lib/logger');

/**
 * Detecta si un buffer WebP contiene múltiples fotogramas (animación)
 */
async function detectWebpAnimation(buffer, quotedMessage) {
    if (quotedMessage?.isAnimated) {
        return true;
    }
    try {
        const img = new webpmux.Image();
        await img.load(buffer);
        if (img.hasAnim) return true;
    } catch (_) {}

    try {
        const meta = await sharp(buffer, { animated: true }).metadata();
        if (meta && meta.pages && meta.pages > 1) {
            return true;
        }
    } catch (_) {}

    return false;
}

module.exports = {
    name: 'tovideo',
    alias: ['tovid', 'videosticker', 'mp4sticker', 'tomp4'],
    category: 'multimedia',
    desc: 'Convierte un sticker (animado o estático), imagen o video corto a video MP4 compatible con WhatsApp',
    usage: '.tovideo [citando sticker, imagen o video corto]',

    execute: async ({ sock, m }) => {
        let mediaTarget = null;
        let mediaType = null;

        // 1. Identificar si el medio proviene de un mensaje citado o del mensaje actual
        if (m.quoted) {
            const qType = m.quoted.type;
            if (['stickerMessage', 'videoMessage', 'imageMessage'].includes(qType)) {
                mediaTarget = m.quoted;
                mediaType = qType;
            }
        } else if (['stickerMessage', 'videoMessage', 'imageMessage'].includes(m.type)) {
            mediaTarget = m;
            mediaType = m.type;
        }

        // 2. Si no hay medio válido, mostrar ayuda interactiva
        if (!mediaTarget) {
            return await m.reply(
                '╭━━━〔 🎬 *CONVERSOR A VIDEO MP4* 〕━━━╮\n' +
                '┃\n' +
                '┃ 📌 *Uso:* Envía o cita un sticker, imagen o video con:\n' +
                '┃ 💬 *.tovideo*\n' +
                '┃\n' +
                '┃ 💡 *Formatos soportados:*\n' +
                '┃ • Stickers animados (WebP → MP4)\n' +
                '┃ • Stickers estáticos (WebP → MP4 de 3 segundos)\n' +
                '┃ • Imágenes normales (JPEG/PNG → MP4 de 3 segundos)\n' +
                '┃ • Videos cortos o GIFs\n' +
                '┃\n' +
                '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n' +
                '_Unknown Codexツ</>_'
            );
        }

        // 3. Verificar disponibilidad de FFmpeg con instrucciones claras para cada sistema
        if (!isFfmpegAvailable()) {
            await m.react('❌');
            return await m.reply(
                '⚠️ *El conversor multimedia (FFmpeg) no está disponible en este servidor.*\n\n' +
                '📌 *Instrucciones para activarlo:*\n' +
                '• En *Linux / Cloud Shell / VPS*: ejecuta `sudo apt update && sudo apt install -y ffmpeg`\n' +
                '• En *Termux (Android)*: ejecuta `pkg install ffmpeg -y`\n' +
                '• En *Windows*: asegúrate de tener `ffmpeg` instalado y agregado al PATH.'
            );
        }

        await m.react('⏳');

        let mediaBuffer = null;
        try {
            mediaBuffer = await mediaTarget.download();
        } catch (dlErr) {
            logger.error('[TOVIDEO] Error descargando multimedia:', dlErr.message);
        }

        if (!mediaBuffer || mediaBuffer.length === 0) {
            await m.react('❌');
            return await m.reply('❌ No se pudo descargar el archivo multimedia citado.');
        }

        const inputExt = mediaType === 'videoMessage' ? 'mp4' : (mediaType === 'imageMessage' ? 'jpg' : 'webp');
        const inputPath = createTempPath(inputExt);
        const outputPath = createTempPath('mp4');
        let tempGifPath = null;

        try {
            await fs.writeFile(inputPath, mediaBuffer);

            let isAnimatedSticker = false;
            if (mediaType === 'stickerMessage') {
                isAnimatedSticker = await detectWebpAnimation(
                    mediaBuffer,
                    mediaTarget.message?.stickerMessage
                );
            }

            let converted = false;

            if (mediaType === 'stickerMessage' && isAnimatedSticker) {
                // ── A. STICKER ANIMADO ──
                // Intento 1: Conversión directa de WebP animado a MP4 con pista de audio silenciosa
                try {
                    await runFfmpeg([
                        '-y',
                        '-i', inputPath,
                        '-f', 'lavfi',
                        '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
                        '-c:v', 'libx264',
                        '-pix_fmt', 'yuv420p',
                        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=20',
                        '-c:a', 'aac',
                        '-shortest',
                        '-preset', 'veryfast',
                        '-crf', '23',
                        '-movflags', '+faststart',
                        outputPath
                    ], { timeout: 35000 });
                    converted = fs.existsSync(outputPath) && (await fs.stat(outputPath)).size > 0;
                } catch (directErr) {
                    logger.warn('[TOVIDEO] Conversión directa falló, probando con Sharp a GIF:', directErr.message);
                }

                // Fallback 1: Si falló con audio o demuxer, intentar transcodificar fotogramas con Sharp a GIF
                if (!converted) {
                    try {
                        tempGifPath = createTempPath('gif');
                        const gifBuf = await sharp(inputPath, { animated: true }).gif().toBuffer();
                        await fs.writeFile(tempGifPath, gifBuf);

                        await runFfmpeg([
                            '-y',
                            '-i', tempGifPath,
                            '-f', 'lavfi',
                            '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
                            '-c:v', 'libx264',
                            '-pix_fmt', 'yuv420p',
                            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=20',
                            '-c:a', 'aac',
                            '-shortest',
                            '-preset', 'veryfast',
                            '-crf', '23',
                            '-movflags', '+faststart',
                            outputPath
                        ], { timeout: 35000 });
                        converted = fs.existsSync(outputPath) && (await fs.stat(outputPath)).size > 0;
                    } catch (fallbackErr) {
                        logger.warn('[TOVIDEO] Fallback con audio falló, probando sin audio:', fallbackErr.message);
                    }
                }

                // Fallback 2: Sin audio (-an) si anullsrc no está soportado en la compilación de FFmpeg
                if (!converted) {
                    const srcPath = tempGifPath || inputPath;
                    await runFfmpeg([
                        '-y',
                        '-i', srcPath,
                        '-c:v', 'libx264',
                        '-pix_fmt', 'yuv420p',
                        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=20',
                        '-an',
                        '-preset', 'veryfast',
                        '-crf', '23',
                        '-movflags', '+faststart',
                        outputPath
                    ], { timeout: 35000 });
                    converted = fs.existsSync(outputPath) && (await fs.stat(outputPath)).size > 0;
                }

            } else if (mediaType === 'stickerMessage' || mediaType === 'imageMessage') {
                // ── B. STICKER ESTÁTICO O IMAGEN NORMAL ──
                // Crear un video de 3 segundos en bucle con pista de audio silenciosa
                // para que WhatsApp lo acepte y reproduzca sin errores
                try {
                    await runFfmpeg([
                        '-y',
                        '-loop', '1',
                        '-i', inputPath,
                        '-f', 'lavfi',
                        '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
                        '-c:v', 'libx264',
                        '-t', '3',
                        '-pix_fmt', 'yuv420p',
                        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=25',
                        '-c:a', 'aac',
                        '-shortest',
                        '-preset', 'veryfast',
                        '-crf', '23',
                        '-movflags', '+faststart',
                        outputPath
                    ], { timeout: 30000 });
                    converted = fs.existsSync(outputPath) && (await fs.stat(outputPath)).size > 0;
                } catch (staticWithAudioErr) {
                    logger.warn('[TOVIDEO] Loop con audio falló, probando sin audio:', staticWithAudioErr.message);
                    await runFfmpeg([
                        '-y',
                        '-loop', '1',
                        '-i', inputPath,
                        '-c:v', 'libx264',
                        '-t', '3',
                        '-pix_fmt', 'yuv420p',
                        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=25',
                        '-an',
                        '-preset', 'veryfast',
                        '-crf', '23',
                        '-movflags', '+faststart',
                        outputPath
                    ], { timeout: 30000 });
                    converted = fs.existsSync(outputPath) && (await fs.stat(outputPath)).size > 0;
                }

            } else {
                // ── C. VIDEO CORTO O GIF ──
                // Re-codificar a MP4 estandarizado para máxima compatibilidad
                try {
                    await runFfmpeg([
                        '-y',
                        '-i', inputPath,
                        '-c:v', 'libx264',
                        '-pix_fmt', 'yuv420p',
                        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
                        '-c:a', 'aac',
                        '-preset', 'veryfast',
                        '-crf', '23',
                        '-movflags', '+faststart',
                        outputPath
                    ], { timeout: 45000 });
                    converted = fs.existsSync(outputPath) && (await fs.stat(outputPath)).size > 0;
                } catch (vidErr) {
                    logger.warn('[TOVIDEO] Re-encode de video falló:', vidErr.message);
                }
            }

            if (!converted || !fs.existsSync(outputPath)) {
                throw new Error('No se pudo generar el video MP4 de salida.');
            }

            const videoBuffer = await fs.readFile(outputPath);
            if (!videoBuffer || videoBuffer.length === 0) {
                throw new Error('El archivo de video generado está vacío.');
            }

            let captionText = '✅ *Sticker animado convertido a video MP4 con éxito.*';
            if (mediaType === 'imageMessage') {
                captionText = '✅ *Imagen convertida a video MP4 con éxito.*';
            } else if (mediaType === 'stickerMessage' && !isAnimatedSticker) {
                captionText = '✅ *Sticker convertido a video MP4 con éxito.*';
            } else if (mediaType === 'videoMessage') {
                captionText = '✅ *Video optimizado a MP4 con éxito.*';
            }

            // Enviar mensaje de video a través de Baileys
            await sock.sendMessage(m.chat, {
                video: videoBuffer,
                mimetype: 'video/mp4',
                fileName: 'video.mp4',
                caption: `${captionText}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });

            await m.react('✅');

        } catch (err) {
            logger.error('[TOVIDEO ERROR]:', err.message);
            await m.react('❌');
            await m.reply(`❌ Ocurrió un error al convertir a video: ${err.message}`);
        } finally {
            await safeUnlink(inputPath);
            await safeUnlink(outputPath);
            if (tempGifPath) await safeUnlink(tempGifPath);
        }
    }
};
