'use strict';

/**
 * Comando: .anticolong
 *
 * Convierte un sticker normal en "anti-robo" (Anti-Colong):
 *   • Capa 1: Inyecta metadatos EXIF oficiales de Avatar/IA de WhatsApp
 *             (is-avatar-sticker, is-ai-sticker, template oficial, etc.)
 *             para que WhatsApp oculte el botón de "Añadir a favoritos" y bloquear guardado.
 *   • Capa 2: Flags de protocolo Baileys (isAvatar: true, isAiSticker: true).
 *   • PRESERVA CRÉDITOS: No modifica el nombre del pack ni el autor original del sticker.
 *   • NO usa viewOnce en stickers (WhatsApp móvil no soporta viewOnce para stickers
 *     y causaba error de descarga / visualización).
 *   • MEJORA:
 *       1. Soporta convertir stickers a foto de Ver Una Vez real (.anticolong vo / foto)
 *       2. Soporta responder a imágenes o videos cortos y convertirlos directo a sticker protegido.
 *
 * Uso:
 *   .anticolong              (reply a sticker -> sticker protegido anti-robo, conserva créditos)
 *   .anticolong vo           (reply a sticker -> foto real Ver Una Vez / View Once)
 *   .anticolong              (reply a imagen/video -> crea sticker protegido)
 */

const crypto = require('crypto');
const webpmux = require('node-webpmux');
const sharp = require('sharp');
const config = require('../../config');
const logger = require('../../lib/logger');
const { imageToSticker, videoToSticker } = require('../../lib/media');

/**
 * Extrae metadatos JSON existentes en el bloque EXIF de un WebP si están presentes.
 */
function extractExifMetadata(exifBuffer) {
    if (!exifBuffer) return {};
    try {
        const rawStr = exifBuffer.toString('utf-8');
        const jsonStart = rawStr.indexOf('{');
        const jsonEnd = rawStr.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
            return JSON.parse(rawStr.slice(jsonStart, jsonEnd + 1));
        }
    } catch (_) {}
    return {};
}

/**
 * Inyecta metadatos de protección Anti-Robo a un buffer WebP sin alterar los créditos originales.
 * Asegura contenedor VP8X válido tanto para stickers estáticos como animados.
 */
async function injectAntiRoboExif(webpBuffer) {
    let existingMeta = {};
    let img = null;

    try {
        img = new webpmux.Image();
        await img.load(webpBuffer);
        if (img.exif) {
            existingMeta = extractExifMetadata(img.exif);
        }
    } catch (err) {
        logger.debug?.('[ANTICOLONG] No se pudo pre-cargar con webpmux:', err.message);
        img = null;
    }

    // Conservar intactos los créditos originales del sticker (packname, author, emojis, etc.)
    const finalMetadata = {
        ...existingMeta,
        // Inyectar ÚNICAMENTE las directivas de protección de sistema WhatsApp
        'is-from-sticker-maker'         : 0,
        'is-avatar-sticker'             : 1,           // clave: WhatsApp lo identifica como avatar oficial del sistema
        'avatar-sticker-template-id'    : 'whatsapp',
        'is-ai-sticker'                 : 1,           // clave: WhatsApp lo identifica como generado por IA
        'is-avatar-country-sticker'     : 1,
        'is-avatar-instant-sticker'     : 1,
        'sticker-maker-source-type'     : 4,
        'is-avatar-social-sticker'      : 1,
        'avatar-sticker-style'          : 'whatsapp',
        'avatar-sticker-revision-id'    : '2026',
        'origin-pack-id'               : 'whatsapp',
        'is-text-sticker'              : 1,
    };

    // Si el sticker original no tenía ID de pack, asignar uno aleatorio
    if (!finalMetadata['sticker-pack-id']) {
        finalMetadata['sticker-pack-id'] = crypto.randomBytes(16).toString('hex');
    }

    const exifAttr = Buffer.from([
        0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x16, 0x00, 0x00, 0x00
    ]);
    const jsonBuff = Buffer.from(JSON.stringify(finalMetadata), 'utf-8');
    const exif = Buffer.concat([exifAttr, jsonBuff]);
    exif.writeUIntLE(jsonBuff.length, 14, 4);

    try {
        if (!img) {
            img = new webpmux.Image();
            await img.load(webpBuffer);
        }
        img.exif = exif;
        return await img.save(null);
    } catch (err) {
        logger.warn('[ANTICOLONG] webpmux falló, aplicando fallback manual:', err.message);
        return fallbackWebpExif(webpBuffer, finalMetadata);
    }
}

/**
 * Fallback de bajo nivel para inyectar EXIF en RIFF WebP si webpmux fallara.
 */
function fallbackWebpExif(webpBuffer, metadata) {
    if (
        !Buffer.isBuffer(webpBuffer) ||
        webpBuffer.length < 12 ||
        webpBuffer.slice(0, 4).toString() !== 'RIFF' ||
        webpBuffer.slice(8, 12).toString() !== 'WEBP'
    ) {
        return webpBuffer;
    }

    const json = Buffer.from(JSON.stringify(metadata), 'utf-8');
    const header = Buffer.from([
        0x49, 0x49, 0x2a, 0x00,
        0x08, 0x00, 0x00, 0x00,
        0x01, 0x00,
        0x41, 0x57, 0x07, 0x00
    ]);
    const sizeLE = Buffer.alloc(4);
    sizeLE.writeUInt32LE(json.length, 0);
    const nextIFD = Buffer.alloc(4);
    const exifPayload = Buffer.concat([header, sizeLE, nextIFD, Buffer.from([0x16, 0x00, 0x00, 0x00]), json]);

    const typeBuf = Buffer.from('EXIF');
    const sizeBuf = Buffer.alloc(4);
    sizeBuf.writeUInt32LE(exifPayload.length, 0);
    const pad = exifPayload.length % 2 === 1 ? Buffer.from([0x00]) : Buffer.alloc(0);
    const exifChunk = Buffer.concat([typeBuf, sizeBuf, exifPayload, pad]);

    const chunks = [];
    let offset = 12;
    while (offset + 8 <= webpBuffer.length) {
        const type = webpBuffer.slice(offset, offset + 4).toString();
        const size = webpBuffer.readUInt32LE(offset + 4);
        const end = offset + 8 + size + (size % 2);
        if (end > webpBuffer.length || end < offset) break;
        if (type !== 'EXIF') chunks.push(webpBuffer.slice(offset, end));
        offset = end;
    }

    const body = Buffer.concat([...chunks, exifChunk]);
    const riffHeader = Buffer.alloc(12);
    riffHeader.write('RIFF', 0);
    riffHeader.writeUInt32LE(body.length + 4, 4);
    riffHeader.write('WEBP', 8);

    return Buffer.concat([riffHeader, body]);
}

// ── Comando ─────────────────────────────────────────────────

module.exports = {
    name: 'anticolong',
    alias: ['ac', 'protegersticker', 'stickervo', 'anticuri', 'stickersafe', 'nosteal'],
    category: 'media',
    desc: 'Convierte un sticker en anti-robo: bloquea la opción de guardar en favoritos sin modificar créditos',
    usage: '.anticolong (reply a sticker) | .anticolong vo (modo Ver Una Vez)',
    ownerOnly: false,

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const quoted = m.quoted;

        // Detectar tipo de mensaje citado
        const isSticker = Boolean(
            quoted && (
                quoted.type === 'stickerMessage' ||
                quoted.mtype === 'stickerMessage' ||
                quoted.message?.stickerMessage
            )
        );

        const isImage = Boolean(
            quoted && (
                quoted.type === 'imageMessage' ||
                quoted.mtype === 'imageMessage' ||
                quoted.message?.imageMessage
            )
        );

        const isVideo = Boolean(
            quoted && (
                quoted.type === 'videoMessage' ||
                quoted.mtype === 'videoMessage' ||
                quoted.message?.videoMessage
            )
        );

        if (!quoted || (!isSticker && !isImage && !isVideo)) {
            return await sock.sendMessage(jid, {
                text:
                    `┏❐ 《 🛡️ STICKER ANTI-COLONG 》 ❐\n` +
                    `┃\n` +
                    `┃├◆ 📋 *¿Qué es el Sticker Anti-Colong?*\n` +
                    `┃  Convierte un sticker en *anti-robo*:\n` +
                    `┃  • No se puede guardar en favoritos (⭐ bloqueado)\n` +
                    `┃  • Deshabilita la opción de añadir a stickers\n` +
                    `┃  • Conserva los créditos originales intactos\n` +
                    `┃  • Se descarga y visualiza normalmente en el chat\n` +
                    `┃\n` +
                    `┃├◆ 🔒 *Modos de uso:*\n` +
                    `┃  1. \`.anticolong\` (respondiendo a un sticker)\n` +
                    `┃     → Genera el sticker protegido con metadatos oficiales de Avatar/IA\n` +
                    `┃\n` +
                    `┃  2. \`.anticolong vo\` o \`.anticolong foto\`\n` +
                    `┃     → Convierte el sticker en una *Foto de Ver Una Vez* real\n` +
                    `┃       (desaparece al abrirse y no permite captura)\n` +
                    `┃\n` +
                    `┃  3. \`.anticolong\` (respondiendo a una imagen o video)\n` +
                    `┃     → Lo convierte directamente en sticker protegido\n` +
                    `┗❐\n\n` +
                    `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        const modeArg = (args && args[0] ? args[0].toLowerCase() : '').trim();
        const wantViewOncePhoto = ['vo', 'viewonce', 'foto', 'photo', '1'].includes(modeArg);

        await m.react?.('⏳');

        let rawBuffer = null;
        try {
            if (typeof quoted.download === 'function') {
                try {
                    rawBuffer = await quoted.download();
                } catch (_) {}
            }
            if ((!rawBuffer || rawBuffer.length === 0) && quoted.message) {
                const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                rawBuffer = await downloadMediaMessage(
                    { message: quoted.message, key: quoted.key || m.key },
                    'buffer',
                    {},
                    { logger, reuploadRequest: sock.updateMediaMessage }
                );
            }
            if (!rawBuffer || rawBuffer.length === 0) {
                throw new Error('No se pudo descargar el archivo citado.');
            }
        } catch (err) {
            await m.react?.('❌');
            return await sock.sendMessage(jid, {
                text: `❌ Error al descargar el contenido citado.\n📋 ${err.message}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // MODO 1: Sticker convertido a Foto de Ver Una Vez (View Once real)
        if (isSticker && wantViewOncePhoto) {
            try {
                // Convertir WebP a PNG/JPEG de alta calidad para View Once
                const imgBuffer = await sharp(rawBuffer).png().toBuffer();
                await sock.sendMessage(jid, {
                    image: imgBuffer,
                    viewOnce: true,
                    caption: '🔒 *Sticker protegido en modo Ver Una Vez (View Once)*\n_Desaparece al abrirlo y no permite guardar._\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
                await m.react?.('👁️');
                return;
            } catch (voErr) {
                logger.warn('[ANTICOLONG] Falló conversión a foto View Once, procediendo como sticker:', voErr.message);
            }
        }

        // Preparar buffer WebP según el origen
        let webpBuffer = rawBuffer;
        if (isImage) {
            try {
                const userNames = require('../../lib/userNames');
                const rawUser = (m.pushName || '').trim() || userNames.get(m.sender) || '';
                const packname = rawUser || config.packName || '';
                const author = config.authorName || '';
                webpBuffer = await imageToSticker(rawBuffer, { packname, author });
            } catch (convErr) {
                await m.react?.('❌');
                return await sock.sendMessage(jid, {
                    text: `❌ Error al convertir la imagen a sticker.\n📋 ${convErr.message}\n\n_Unknown Codexツ</>_`
                }, { quoted: m });
            }
        } else if (isVideo) {
            try {
                const userNames = require('../../lib/userNames');
                const rawUser = (m.pushName || '').trim() || userNames.get(m.sender) || '';
                const packname = rawUser || config.packName || '';
                const author = config.authorName || '';
                webpBuffer = await videoToSticker(rawBuffer, { packname, author });
            } catch (convErr) {
                await m.react?.('❌');
                return await sock.sendMessage(jid, {
                    text: `❌ Error al convertir el video a sticker.\n📋 ${convErr.message}\n\n_Unknown Codexツ</>_`
                }, { quoted: m });
            }
        }

        // Inyectar metadatos protegidos de Avatar e IA preservando los créditos originales
        let protectedBuffer;
        try {
            protectedBuffer = await injectAntiRoboExif(webpBuffer);
        } catch (exifErr) {
            logger.warn('[ANTICOLONG] Error inyectando EXIF protegido:', exifErr.message);
            protectedBuffer = webpBuffer;
        }

        // Enviar como sticker normal pero con flags de protección (SIN viewOnce en el sticker)
        try {
            await sock.sendMessage(
                jid,
                {
                    sticker: protectedBuffer,
                    isAvatar: true,
                    isAiSticker: true
                },
                { quoted: m }
            );
            await m.react?.('🛡️');
        } catch (err) {
            logger.error('[ANTICOLONG ERROR]:', err.message);
            await m.react?.('❌');
            await sock.sendMessage(jid, {
                text: `❌ No se pudo enviar el sticker protegido.\n📋 ${err.message}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};
