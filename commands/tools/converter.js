'use strict';

const path = require('path');
const fs = require('fs-extra');
const sharp = require('../../lib/sharp');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const logger = require('../../lib/logger');
const { runFfmpeg, isFfmpegAvailable } = require('../../lib/ffmpeg');

const tmpDir = path.join(process.cwd(), 'tmp');
fs.ensureDirSync(tmpDir);

/**
 * Convierte un buffer de imagen a documento PDF estándar (100% nativo en Node.js)
 */
function imageToPdf(jpegBuffer, width, height) {
    const stream = jpegBuffer;
    const contentStream = Buffer.from(`q\n${width} 0 0 ${height} 0 0 cm\n/Im Do\nQ\n`);

    const offsets = [];
    let pdf = '%PDF-1.4\n';

    offsets.push(pdf.length);
    pdf += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';

    offsets.push(pdf.length);
    pdf += '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';

    offsets.push(pdf.length);
    pdf += `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;

    offsets.push(pdf.length);
    const obj4Header = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${stream.length} >>\nstream\n`;
    const obj4Footer = '\nendstream\nendobj\n';

    const part1 = Buffer.from(pdf + obj4Header);
    const part2 = Buffer.concat([part1, stream, Buffer.from(obj4Footer)]);

    let part3Str = '';
    const obj5Offset = part2.length;
    offsets.push(obj5Offset);
    part3Str += `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream.toString()}endstream\nendobj\n`;

    const startXref = part2.length + Buffer.byteLength(part3Str);
    part3Str += 'xref\n0 6\n0000000000 65535 f \n';
    for (const off of offsets) {
        part3Str += String(off).padStart(10, '0') + ' 00000 n \n';
    }
    part3Str += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;

    return Buffer.concat([part2, Buffer.from(part3Str)]);
}

module.exports = {
    name: 'converter',
    alias: ['convertir', 'formatconvert', 'toformat', 'convert'],
    category: 'tools',
    desc: 'Convierte archivos entre múltiples formatos (mp3, wav, ogg, mp4, gif, jpg, png, webp, pdf)',
    usage: '.converter <formato> (respondiendo a un archivo, audio, video, imagen o sticker)',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const targetFormat = (args[0] || '').toLowerCase().replace(/^[.\s]+/, '').trim();
        const quoted = m.quoted;

        if (!targetFormat || !quoted) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🔄 CONVERSOR DE FORMATOS UNIVERSAL 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Formatos de salida disponibles:*',
                    '┃  • 🎵 *Audio:* `mp3`, `wav`, `ogg`, `m4a`',
                    '┃  • 🎬 *Video / GIF:* `mp4`, `gif`',
                    '┃  • 🖼️ *Imagen:* `jpg`, `png`, `webp`',
                    '┃  • 📄 *Documento:* `pdf`',
                    '┃',
                    '┃├◆ 📌 *Modo de uso:*',
                    '┃  1. Mantén presionado cualquier audio, video o foto.',
                    '┃  2. Dale a *Responder* (Reply).',
                    '┃  3. Escribe `.converter <formato>`',
                    '┃',
                    '┃├◆ 💡 *Ejemplos:*',
                    '┃  • Responde a una nota de voz: `.converter mp3`',
                    '┃  • Responde a un video corto: `.converter gif`',
                    '┃  • Responde a una foto o sticker: `.converter png`',
                    '┃  • Responde a una imagen: `.converter pdf`',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        const validFormats = ['mp3', 'wav', 'ogg', 'm4a', 'mp4', 'gif', 'jpg', 'jpeg', 'png', 'webp', 'pdf'];
        if (!validFormats.includes(targetFormat)) {
            return await sock.sendMessage(jid, {
                text: `❌ Formato no soportado: \`${targetFormat}\`.\n📌 Formatos válidos: \`mp3, wav, ogg, m4a, mp4, gif, jpg, png, webp, pdf\`\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        try {
            await m.react?.('⏳');

            // 1. Descargar archivo citado
            let buffer = null;
            if (typeof quoted.download === 'function') {
                try { buffer = await quoted.download(); } catch (_) {}
            }

            if (!buffer && quoted.message) {
                buffer = await downloadMediaMessage(
                    { message: quoted.message, key: quoted.key || m.key },
                    'buffer',
                    {},
                    { logger, reuploadRequest: sock.updateMediaMessage }
                );
            }

            if (!buffer || buffer.length === 0) {
                return await sock.sendMessage(jid, {
                    text: '❌ No se pudo descargar el archivo citado para convertirlo.\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            const qType = quoted.type || quoted.mtype || '';
            const qMime = quoted.mimetype || '';
            const isAudio = qType.includes('audio') || qMime.startsWith('audio/');
            const isVideo = qType.includes('video') || qMime.startsWith('video/');
            const isImage = qType.includes('image') || qMime.startsWith('image/');
            const isSticker = qType.includes('sticker') || qMime.includes('webp');

            const timestamp = Date.now();
            const randId = Math.random().toString(36).substring(7);

            // ── Conversión A: Imagen/Sticker a Imagen o PDF ──
            if (['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(targetFormat)) {
                if (targetFormat === 'pdf') {
                    // Convertir primero a JPEG para empaquetado PDF estándar
                    const jpegBuffer = await sharp(buffer).jpeg({ quality: 92 }).toBuffer();
                    const meta = await sharp(jpegBuffer).metadata();
                    const pdfBuffer = imageToPdf(jpegBuffer, meta.width || 600, meta.height || 800);

                    await m.react?.('📄');
                    return await sock.sendMessage(jid, {
                        document: pdfBuffer,
                        mimetype: 'application/pdf',
                        fileName: `convertido_${timestamp}.pdf`,
                        caption: `✅ *Imagen convertida a PDF con éxito*\n\n_Unknown Codexツ</>_`
                    }, { quoted: m });
                }

                let outputBuffer = null;
                let mimeType = 'image/jpeg';

                if (targetFormat === 'png') {
                    outputBuffer = await sharp(buffer).png().toBuffer();
                    mimeType = 'image/png';
                } else if (targetFormat === 'webp') {
                    outputBuffer = await sharp(buffer).webp({ quality: 90 }).toBuffer();
                    mimeType = 'image/webp';
                } else {
                    outputBuffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
                    mimeType = 'image/jpeg';
                }

                await m.react?.('✅');
                if (targetFormat === 'webp') {
                    return await sock.sendMessage(jid, {
                        sticker: outputBuffer
                    }, { quoted: m });
                } else {
                    return await sock.sendMessage(jid, {
                        image: outputBuffer,
                        caption: `✅ *Convertido a formato .${targetFormat.toUpperCase()} exitosamente*\n\n_Unknown Codexツ</>_`
                    }, { quoted: m });
                }
            }

            // ── Conversión B: Audio / Video / GIF mediante FFmpeg ──
            if (!isFfmpegAvailable()) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ FFmpeg no está disponible en este momento para conversiones de audio/video.'
                }, { quoted: m });
            }

            const inputExt = isVideo ? 'mp4' : (isAudio ? 'ogg' : 'webp');
            const tempIn = path.join(tmpDir, `conv_in_${timestamp}_${randId}.${inputExt}`);
            const tempOut = path.join(tmpDir, `conv_out_${timestamp}_${randId}.${targetFormat}`);
            await fs.writeFile(tempIn, buffer);

            const filesToClean = [tempIn, tempOut];

            try {
                let ffmpegArgs = [];

                if (['mp3', 'wav', 'ogg', 'm4a'].includes(targetFormat)) {
                    // Extracción o transcodificación de audio
                    ffmpegArgs = ['-y', '-i', tempIn, '-vn'];
                    if (targetFormat === 'mp3') ffmpegArgs.push('-c:a', 'libmp3lame', '-b:a', '192k');
                    else if (targetFormat === 'wav') ffmpegArgs.push('-c:a', 'pcm_s16le');
                    else if (targetFormat === 'ogg') ffmpegArgs.push('-c:a', 'libopus', '-b:a', '128k');
                    else if (targetFormat === 'm4a') ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
                    ffmpegArgs.push(tempOut);
                } else if (targetFormat === 'gif') {
                    // Video a GIF animado
                    ffmpegArgs = [
                        '-y', '-i', tempIn,
                        '-vf', 'fps=12,scale=360:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
                        '-t', '15',
                        tempOut
                    ];
                } else if (targetFormat === 'mp4') {
                    // Conversión a MP4 universal
                    ffmpegArgs = [
                        '-y', '-i', tempIn,
                        '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
                        '-pix_fmt', 'yuv420p',
                        '-c:a', 'aac', '-b:a', '128k',
                        tempOut
                    ];
                }

                await runFfmpeg(ffmpegArgs, { timeout: 60000 });

                if (!fs.existsSync(tempOut)) {
                    throw new Error('El conversor no generó el archivo de salida.');
                }

                const convertedData = await fs.readFile(tempOut);
                await m.react?.('✅');

                if (['mp3', 'wav', 'ogg', 'm4a'].includes(targetFormat)) {
                    const audioMime = targetFormat === 'ogg' ? 'audio/ogg; codecs=opus' : (targetFormat === 'mp3' ? 'audio/mpeg' : `audio/${targetFormat}`);
                    return await sock.sendMessage(jid, {
                        audio: convertedData,
                        mimetype: audioMime,
                        ptt: targetFormat === 'ogg'
                    }, { quoted: m });
                } else if (targetFormat === 'gif') {
                    return await sock.sendMessage(jid, {
                        video: convertedData,
                        gifPlayback: true,
                        caption: `✅ *Video convertido a GIF animado*\n\n_Unknown Codexツ</>_`
                    }, { quoted: m });
                } else if (targetFormat === 'mp4') {
                    return await sock.sendMessage(jid, {
                        video: convertedData,
                        caption: `✅ *Convertido a MP4 exitosamente*\n\n_Unknown Codexツ</>_`
                    }, { quoted: m });
                }

            } finally {
                for (const f of filesToClean) {
                    try { if (fs.existsSync(f)) await fs.remove(f); } catch (_) {}
                }
            }

        } catch (err) {
            logger.error('[CONVERTER ERROR]:', err.message);
            await sock.sendMessage(jid, {
                text: `❌ Error al convertir archivo: ${err.message}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};

