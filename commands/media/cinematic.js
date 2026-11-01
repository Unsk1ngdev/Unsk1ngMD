'use strict';

const sharp = require('sharp');
const logger = require('../../lib/logger');

/**
 * Genera el overlay de barras negras cinematográficas (Letterbox 2.39:1)
 */
function createCinematicOverlaySvg(width, height) {
    // Proporción cinematográfica estándar (aproximadamente 12% arriba y abajo)
    const barHeight = Math.max(30, Math.round(height * 0.12));
    const scale = Math.max(0.6, width / 700);
    const fontSize = Math.round(11 * scale);

    return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <!-- Barra negra superior de formato anamórfico -->
        <rect x="0" y="0" width="${width}" height="${barHeight}" fill="#000000"/>

        <!-- Barra negra inferior de formato anamórfico -->
        <rect x="0" y="${height - barHeight}" width="${width}" height="${barHeight}" fill="#000000"/>

        <!-- Detalle sutil de producción cinematográfica en la barra inferior -->
        <text x="${width - 25}" y="${height - Math.round(barHeight / 2) + Math.round(fontSize / 3)}" font-family="'Segoe UI', Roboto, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#52525b" text-anchor="end" letter-spacing="2">
            2.39:1 ANAMORPHIC WIDESCREEN • 24 FPS
        </text>
    </svg>`;
}

module.exports = {
    name: 'cinematic',
    alias: ['cine', 'letterbox', 'barrascine', 'pelicula', 'cinematografico'],
    category: 'media',
    desc: 'Aplica barras cinematográficas anamórficas y corrección de color de película a una foto',
    usage: '.cinematic (respondiendo a una foto o enviando una foto con .cinematic)',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const quoted = m.quoted;

        // Comprobar si hay una imagen citada o en el mensaje actual
        const isImage = Boolean(
            (quoted && (quoted.type === 'imageMessage' || quoted.mtype === 'imageMessage' || quoted.message?.imageMessage)) ||
            (m.type === 'imageMessage' || m.message?.imageMessage)
        );

        if (!isImage) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🎬 BARRAS CINEMATOGRÁFICAS 》 ❐',
                    '┃',
                    '┃├◆ 📋 *¿Para qué sirve?*',
                    '┃  Añade las clásicas barras negras de película (Letterbox),',
                    '┃  formato anamórfico 2.39:1 y ajuste de contraste',
                    '┃  cinematográfico a cualquier foto.',
                    '┃',
                    '┃├◆ 📌 *Modo de uso:*',
                    '┃  1. Envía una foto con el texto `.cinematic`',
                    '┃  2. O responde a cualquier foto con `.cinematic`',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        try {
            await m.react?.('⏳');

            let buffer = null;
            const target = quoted || m;

            if (typeof target.download === 'function') {
                try { buffer = await target.download(); } catch (_) {}
            }

            if (!buffer && target.message?.imageMessage) {
                const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                buffer = await downloadMediaMessage(
                    { message: target.message, key: target.key || m.key },
                    'buffer',
                    {},
                    { logger, reuploadRequest: sock.updateMediaMessage }
                );
            }

            if (!buffer || buffer.length === 0) {
                return await sock.sendMessage(jid, {
                    text: '❌ No se pudo descargar la imagen para aplicar el formato cinematográfico.'
                }, { quoted: m });
            }

            const image = sharp(buffer);
            const metadata = await image.metadata();
            const width = metadata.width || 800;
            const height = metadata.height || 600;

            const overlaySvg = createCinematicOverlaySvg(width, height);
            const overlayBuffer = Buffer.from(overlaySvg);

            // Ajuste sutil de película (mayor contraste y saturación rica)
            const processedBuffer = await sharp(buffer)
                .modulate({
                    brightness: 0.98,
                    saturation: 1.15
                })
                .composite([{
                    input: overlayBuffer,
                    top: 0,
                    left: 0
                }])
                .jpeg({ quality: 92 })
                .toBuffer();

            await m.react?.('🎬');
            await sock.sendMessage(jid, {
                image: processedBuffer,
                caption: '🎬 *Formato Cinematográfico 2.39:1 Aplicado*\n\n_Unknown Codexツ</>_'
            }, { quoted: m });

        } catch (err) {
            logger.error('[CINEMATIC ERROR]:', err.message);
            await sock.sendMessage(jid, {
                text: `❌ Error al aplicar barras cinematográficas: ${err.message}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};

