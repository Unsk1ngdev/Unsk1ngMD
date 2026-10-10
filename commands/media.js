const fs = require('fs-extra');
const sharp = require('sharp');
const webpmux = require('node-webpmux');
const axios = require('axios');
const FormData = require('form-data');
const { createTempPath, safeUnlink } = require('../lib/cleaner');
const { runFfmpeg } = require('../lib/ffmpeg');

/**
 * Handler centralizado para conversión de stickers (.toimg y .tovideo)
 */
const handleStickerConversion = async ({ sock, m }) => {
    if (!m.quoted || m.quoted.type !== 'stickerMessage') {
        return await m.reply('❌ Debes citar un sticker para convertirlo en imagen o video.');
    }

    await m.react('⏳');

    const stickerBuffer = await m.quoted.download();
    if (!stickerBuffer || stickerBuffer.length === 0) {
        await m.react('❌');
        return await m.reply('❌ No se pudo descargar el sticker citado.');
    }

    // Detectar si el sticker es animado
    let isAnimated = !!(m.quoted.message?.stickerMessage?.isAnimated);
    if (!isAnimated) {
        try {
            const img = new webpmux.Image();
            await img.load(stickerBuffer);
            isAnimated = !!img.hasAnim;
        } catch (_) {}
    }

    if (!isAnimated) {
        // --- STICKER ESTÁTICO: CONVERTIR A JPEG LIMPIO ---
        try {
            const jpegBuffer = await sharp(stickerBuffer)
                .jpeg({ quality: 90 })
                .toBuffer();

            await sock.sendMessage(m.chat, {
                image: jpegBuffer,
                caption: '✅ Sticker convertido a imagen JPEG con éxito.'
            }, { quoted: m });

            await m.react('✅');
        } catch (err) {
            await m.react('❌');
            throw new Error(`Error convirtiendo sticker estático a imagen: ${err.message}`);
        }
    } else {
        // --- STICKER ANIMADO: PROCESAR CON FFMPEG A MP4 CORTO ---
        const inputPath = createTempPath('webp');
        const outputPath = createTempPath('mp4');

        await fs.writeFile(inputPath, stickerBuffer);

        try {
            await runFfmpeg([
                '-y',
                '-i', inputPath,
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-movflags', 'faststart',
                '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
                outputPath
            ]);

            const videoBuffer = await fs.readFile(outputPath);

            await sock.sendMessage(m.chat, {
                video: videoBuffer,
                mimetype: 'video/mp4',
                caption: '✅ Sticker animado convertido a video MP4 con éxito.'
            }, { quoted: m });

            await m.react('✅');
        } catch (err) {
            await m.react('❌');
            throw new Error(`Error convirtiendo sticker animado a video: ${err.message}`);
        } finally {
            // Limpieza estricta de archivos temporales
            await safeUnlink(inputPath);
            await safeUnlink(outputPath);
        }
    }
};

module.exports = [
    // 1. .toimg
    {
        name: 'toimg',
        alias: ['toimage', 'aimg'],
        category: 'multimedia',
        desc: 'Convierte un sticker estático a imagen JPEG (o animado a MP4)',
        usage: '.toimg [citando un sticker]',
        execute: handleStickerConversion
    },

    // 2. .tovideo
    {
        name: 'tovideo',
        alias: ['tovid', 'videosticker'],
        category: 'multimedia',
        desc: 'Convierte un sticker animado a video MP4 reproducible',
        usage: '.tovideo [citando un sticker]',
        execute: handleStickerConversion
    },

    // 3. .tovn
    {
        name: 'tovn',
        alias: ['vn', 'ptt'],
        category: 'multimedia',
        desc: 'Convierte un video o audio en nota de voz real de WhatsApp (PTT)',
        usage: '.tovn [citando video o audio]',
        execute: async ({ sock, m }) => {
            let mediaBuffer = null;

            if (m.quoted && (m.quoted.type === 'videoMessage' || m.quoted.type === 'audioMessage')) {
                mediaBuffer = await m.quoted.download();
            } else if (m.type === 'videoMessage' || m.type === 'audioMessage') {
                mediaBuffer = await m.download();
            } else {
                return await m.reply('❌ Debes citar o enviar un video o audio para convertirlo a nota de voz.');
            }

            await m.react('⏳');

            const inputPath = createTempPath('bin');
            const outputPath = createTempPath('opus');

            await fs.writeFile(inputPath, mediaBuffer);

            try {
                await runFfmpeg([
                    '-y',
                    '-i', inputPath,
                    '-vn',
                    '-c:a', 'libopus',
                    '-b:a', '64k',
                    '-vbr', 'on',
                    '-ar', '48000',
                    '-ac', '1',
                    outputPath
                ]);

                const opusBuffer = await fs.readFile(outputPath);

                await sock.sendMessage(m.chat, {
                    audio: opusBuffer,
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt: true
                }, { quoted: m });

                await m.react('✅');
            } catch (err) {
                await m.react('❌');
                throw new Error(`Fallo al transcodificar a nota de voz Opus: ${err.message}`);
            } finally {
                await safeUnlink(inputPath);
                await safeUnlink(outputPath);
            }
        }
    },

    // 4. .tomp3
    {
        name: 'tomp3',
        alias: ['mp3', 'extractaudio'],
        category: 'multimedia',
        desc: 'Extrae y transcodifica el audio de un video o nota de voz a MP3 estándar',
        usage: '.tomp3 [citando video o audio]',
        execute: async ({ sock, m }) => {
            let mediaBuffer = null;

            if (m.quoted && (m.quoted.type === 'videoMessage' || m.quoted.type === 'audioMessage')) {
                mediaBuffer = await m.quoted.download();
            } else if (m.type === 'videoMessage' || m.type === 'audioMessage') {
                mediaBuffer = await m.download();
            } else {
                return await m.reply('❌ Debes citar o enviar un video o nota de voz para extraer el audio en MP3.');
            }

            await m.react('⏳');

            const inputPath = createTempPath('bin');
            const outputPath = createTempPath('mp3');

            await fs.writeFile(inputPath, mediaBuffer);

            try {
                await runFfmpeg([
                    '-y',
                    '-i', inputPath,
                    '-vn',
                    '-c:a', 'libmp3lame',
                    '-b:a', '128k',
                    '-ar', '44100',
                    '-ac', '2',
                    outputPath
                ]);

                const mp3Buffer = await fs.readFile(outputPath);

                await sock.sendMessage(m.chat, {
                    audio: mp3Buffer,
                    mimetype: 'audio/mp4',
                    fileName: 'audio.mp3'
                }, { quoted: m });

                await m.react('✅');
            } catch (err) {
                await m.react('❌');
                throw new Error(`Fallo al convertir a MP3 estándar: ${err.message}`);
            } finally {
                await safeUnlink(inputPath);
                await safeUnlink(outputPath);
            }
        }
    },

    // 5. .tourl
    {
        name: 'tourl',
        alias: ['upload', 'subir'],
        category: 'multimedia',
        desc: 'Sube una imagen o video citado a la nube y genera un enlace directo permanente (máx. 15 MB)',
        usage: '.tourl [citando imagen o video]',
        execute: async ({ sock, m }) => {
            let mediaMsg = null;
            let ext = 'bin';
            let mime = 'application/octet-stream';

            if (m.quoted) {
                if (m.quoted.type === 'imageMessage') {
                    mediaMsg = m.quoted;
                    ext = 'jpg';
                    mime = 'image/jpeg';
                } else if (m.quoted.type === 'videoMessage') {
                    mediaMsg = m.quoted;
                    ext = 'mp4';
                    mime = 'video/mp4';
                } else if (m.quoted.type === 'stickerMessage') {
                    mediaMsg = m.quoted;
                    ext = 'webp';
                    mime = 'image/webp';
                } else if (m.quoted.type === 'audioMessage') {
                    mediaMsg = m.quoted;
                    ext = 'mp3';
                    mime = 'audio/mpeg';
                }
            } else if (m.type === 'imageMessage') {
                mediaMsg = m;
                ext = 'jpg';
                mime = 'image/jpeg';
            } else if (m.type === 'videoMessage') {
                mediaMsg = m;
                ext = 'mp4';
                mime = 'video/mp4';
            }

            if (!mediaMsg) {
                return await m.reply('❌ Debes citar o enviar una imagen o video (máximo 15 MB) para generar un enlace.');
            }

            const buffer = await mediaMsg.download();
            if (!buffer || buffer.length === 0) {
                return await m.reply('❌ Error al descargar el archivo multimedia.');
            }

            const MAX_SIZE = 15 * 1024 * 1024; // 15 MB
            if (buffer.length > MAX_SIZE) {
                const currentMb = (buffer.length / (1024 * 1024)).toFixed(2);
                return await m.reply(`❌ El archivo excede el tamaño máximo permitido de 15 MB (Tamaño actual: ${currentMb} MB).`);
            }

            await m.react('⏳');

            let directUrl = null;
            const filename = `media_${Date.now()}.${ext}`;

            // Primario: Catbox API
            try {
                const form = new FormData();
                form.append('reqtype', 'fileupload');
                form.append('fileToUpload', buffer, { filename, contentType: mime });

                const res = await axios.post('https://catbox.moe/user/api.php', form, {
                    headers: form.getHeaders(),
                    timeout: 35000
                });

                if (res.data && typeof res.data === 'string' && res.data.startsWith('http')) {
                    directUrl = res.data.trim();
                }
            } catch (catboxErr) {
                // Continuar a fallback Qu.ax
            }

            // Secundario (Fallback): Qu.ax API
            if (!directUrl) {
                try {
                    const form = new FormData();
                    form.append('files[]', buffer, { filename, contentType: mime });

                    const res = await axios.post('https://qu.ax/upload.php', form, {
                        headers: form.getHeaders(),
                        timeout: 35000
                    });

                    if (res.data?.success && res.data.files?.[0]?.url) {
                        directUrl = res.data.files[0].url;
                    }
                } catch (quaxErr) {
                    await m.react('❌');
                    throw new Error(`Fallaron los servidores de alojamiento: ${quaxErr.message}`);
                }
            }

            if (!directUrl) {
                await m.react('❌');
                return await m.reply('❌ No fue posible obtener un enlace del archivo en este momento.');
            }

            await m.react('✅');
            const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);

            const responseText =
                `🌐 *ENLACE DIRECTO GENERADO*\n\n` +
                `🔗 *URL:* ${directUrl}\n` +
                `📦 *Tamaño:* ${sizeMb} MB\n` +
                `📁 *Formato:* .${ext.toUpperCase()}\n\n` +
                `_El enlace es público y permanente._`;

            await sock.sendMessage(m.chat, { text: responseText }, { quoted: m });
        }
    }
];

