const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const webpmux = require('node-webpmux');
const qrcode = require('qrcode');
const jsQR = require('jsqr');
const fs = require('fs-extra');
const config = require('../config');
const { createTempPath, safeUnlink } = require('./cleaner');

// Configuración prioritaria de FFmpeg (preferir sistema si existe para soporte completo, fallback a precompilado)
try {
    const { execSync } = require('child_process');
    execSync('ffmpeg -version', { stdio: 'ignore' });
    ffmpeg.setFfmpegPath('ffmpeg');
} catch (e) {
    try {
        const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
        if (ffmpegInstaller && ffmpegInstaller.path) {
            ffmpeg.setFfmpegPath(ffmpegInstaller.path);
        }
    } catch (_) {}
}

/**
 * Inserta metadatos EXIF a un buffer WebP (Packname y Author para WhatsApp)
 */
const writeExif = async (webpBuffer, metadata = {}) => {
    try {
        const packname = metadata.packname || config.packName;
        const author = metadata.author || config.authorName;

        const json = {
            'sticker-pack-id': 'https://github.com/whiskeysockets/baileys',
            'sticker-pack-name': packname,
            'sticker-pack-publisher': author,
            'emojis': metadata.emojis || ['🤖']
        };

        const exifAttr = Buffer.from([
            0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
            0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x16, 0x00, 0x00, 0x00
        ]);

        const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
        const exif = Buffer.concat([exifAttr, jsonBuff]);
        exif.writeUIntLE(jsonBuff.length, 14, 4);

        const img = new webpmux.Image();
        await img.load(webpBuffer);
        img.exif = exif;
        return await img.save(null);
    } catch (err) {
        console.error('[MEDIA] Error escribiendo EXIF de sticker:', err.message);
        return webpBuffer; // Fallback al buffer sin metadatos si falla
    }
};

/**
 * Convierte imagen a Sticker WebP (512x512)
 */
const imageToSticker = async (imageBuffer, metadata = {}) => {
    const webpBuffer = await sharp(imageBuffer)
        .resize(512, 512, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({ quality: 85 })
        .toBuffer();

    return await writeExif(webpBuffer, metadata);
};

/**
 * Convierte video corto / GIF a Sticker Animado WebP
 */
const videoToSticker = async (videoBuffer, metadata = {}) => {
    const inputPath = createTempPath('mp4');
    const outputPath = createTempPath('webp');

    await fs.writeFile(inputPath, videoBuffer);

    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .inputOptions(['-y'])
            .outputOptions([
                '-vcodec', 'libwebp',
                '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=12,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
                '-loop', '0',
                '-ss', '00:00:00',
                '-t', '00:00:10',
                '-preset', 'default',
                '-an',
                '-vsync', '0',
                '-s', '512:512',
                '-qscale', '60'
            ])
            .toFormat('webp')
            .save(outputPath)
            .on('end', async () => {
                try {
                    const buffer = await fs.readFile(outputPath);
                    await safeUnlink(inputPath);
                    await safeUnlink(outputPath);
                    const finalSticker = await writeExif(buffer, metadata);
                    resolve(finalSticker);
                } catch (e) {
                    reject(e);
                }
            })
            .on('error', async (err) => {
                await safeUnlink(inputPath);
                await safeUnlink(outputPath);
                reject(err);
            });
    });
};

/**
 * Convierte Sticker WebP estático a imagen JPG o PNG
 */
const stickerToImage = async (stickerBuffer) => {
    return await sharp(stickerBuffer)
        .png()
        .toBuffer();
};

/**
 * Extrae audio MP3 de un buffer de video o audio
 */
const toMp3 = async (mediaBuffer) => {
    const inputPath = createTempPath('bin');
    const outputPath = createTempPath('mp3');

    await fs.writeFile(inputPath, mediaBuffer);

    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions([
                '-vn',
                '-c:a', 'libmp3lame',
                '-b:a', '128k',
                '-ar', '44100',
                '-ac', '2'
            ])
            .toFormat('mp3')
            .save(outputPath)
            .on('end', async () => {
                try {
                    const buffer = await fs.readFile(outputPath);
                    await safeUnlink(inputPath);
                    await safeUnlink(outputPath);
                    resolve(buffer);
                } catch (e) {
                    reject(e);
                }
            })
            .on('error', async (err) => {
                await safeUnlink(inputPath);
                await safeUnlink(outputPath);
                reject(err);
            });
    });
};

/**
 * Convierte audio a Nota de Voz PTT (Opus compatible con WhatsApp)
 */
const toVoiceNote = async (mediaBuffer) => {
    const inputPath = createTempPath('bin');
    const outputPath = createTempPath('opus');

    await fs.writeFile(inputPath, mediaBuffer);

    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions([
                '-vn',
                '-c:a', 'libopus',
                '-b:a', '64k',
                '-vbr', 'on',
                '-ar', '48000',
                '-ac', '1'
            ])
            .toFormat('opus')
            .save(outputPath)
            .on('end', async () => {
                try {
                    const buffer = await fs.readFile(outputPath);
                    await safeUnlink(inputPath);
                    await safeUnlink(outputPath);
                    resolve(buffer);
                } catch (e) {
                    reject(e);
                }
            })
            .on('error', async (err) => {
                await safeUnlink(inputPath);
                await safeUnlink(outputPath);
                reject(err);
            });
    });
};

/**
 * Escapa caracteres especiales para SVG XML
 */
const escapeXml = (str) => {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
};

/**
 * Divide y calcula el ajuste dinámico de texto para que no desborde la imagen
 */
const wrapMemeText = (text, width) => {
    if (!text) return { lines: [], fontSize: 32, strokeWidth: 4 };

    const upper = text.trim().toUpperCase();
    const maxWidth = width * 0.92;

    // Calcular tamaño de fuente inicial dinámico
    let fontSize = Math.floor(width / 11);
    if (upper.length > 50) fontSize = Math.floor(width / 18);
    else if (upper.length > 30) fontSize = Math.floor(width / 14);

    fontSize = Math.max(18, Math.min(65, fontSize));

    const words = upper.split(/\s+/);
    const lines = [];
    let currentLine = '';

    const getEstimatedWidth = (str) => str.length * (fontSize * 0.60);

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (getEstimatedWidth(testLine) <= maxWidth) {
            currentLine = testLine;
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);

    // Reducir tamaño de fuente si alguna palabra larga aún sobrepasa
    while (lines.some(l => getEstimatedWidth(l) > maxWidth) && fontSize > 16) {
        fontSize -= 2;
    }

    const strokeWidth = Math.max(3, Math.floor(fontSize / 7.5));
    return { lines, fontSize, strokeWidth };
};

/**
 * Genera un meme agregando texto superior e inferior a una imagen con ajuste dinámico
 */
const createMeme = async (imageBuffer, topText = '', bottomText = '') => {
    const meta = await sharp(imageBuffer).metadata();
    const width = meta.width || 600;
    const height = meta.height || 600;

    const top = wrapMemeText(topText, width);
    const bottom = wrapMemeText(bottomText, width);

    let textElements = '';

    // Renderizar líneas de texto superior
    if (top.lines.length > 0) {
        const lineHeight = top.fontSize * 1.15;
        let y = top.fontSize + 15;
        for (const line of top.lines) {
            textElements += `<text x="${Math.floor(width / 2)}" y="${Math.floor(y)}" font-size="${top.fontSize}px" stroke-width="${top.strokeWidth}px" class="meme-text">${escapeXml(line)}</text>\n`;
            y += lineHeight;
        }
    }

    // Renderizar líneas de texto inferior
    if (bottom.lines.length > 0) {
        const lineHeight = bottom.fontSize * 1.15;
        const totalBottomHeight = (bottom.lines.length - 1) * lineHeight;
        let y = (height - 25) - totalBottomHeight;
        for (const line of bottom.lines) {
            textElements += `<text x="${Math.floor(width / 2)}" y="${Math.floor(y)}" font-size="${bottom.fontSize}px" stroke-width="${bottom.strokeWidth}px" class="meme-text">${escapeXml(line)}</text>\n`;
            y += lineHeight;
        }
    }

    const svg = `
    <svg width="${width}" height="${height}">
      <style>
        .meme-text {
          font-family: Impact, "Arial Black", "Trebuchet MS", sans-serif;
          font-weight: 900;
          fill: #FFFFFF;
          stroke: #000000;
          paint-order: stroke fill;
          text-anchor: middle;
          letter-spacing: 1px;
        }
      </style>
      ${textElements}
    </svg>`;

    return await sharp(imageBuffer)
        .composite([{ input: Buffer.from(svg) }])
        .jpeg({ quality: 90 })
        .toBuffer();
};

/**
 * Aplica filtro de desenfoque Gaussiano a una imagen
 */
const blurImage = async (imageBuffer, sigma = 15) => {
    return await sharp(imageBuffer)
        .blur(sigma)
        .jpeg({ quality: 90 })
        .toBuffer();
};

/**
 * Genera una imagen QR a partir de texto
 */
const generateQR = async (text) => {
    return await qrcode.toBuffer(text, {
        type: 'png',
        margin: 2,
        scale: 8,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        }
    });
};

/**
 * Lee y decodifica un código QR desde un buffer de imagen
 */
const readQRCode = async (imageBuffer) => {
    const { data, info } = await sharp(imageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    return code ? code.data : null;
};

module.exports = {
    writeExif,
    imageToSticker,
    videoToSticker,
    stickerToImage,
    toMp3,
    toVoiceNote,
    createMeme,
    blurImage,
    generateQR,
    readQRCode
};

