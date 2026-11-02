'use strict';

const sharp = require('../../lib/sharp');
const logger = require('../../lib/logger');

/**
 * Genera el overlay vectorial de interfaz y ruido VHS de los 90
 */
function createVhsOverlaySvg(width, height) {
    const scale = Math.max(0.6, width / 700);
    const fontSizeLg = Math.round(26 * scale);
    const fontSizeSm = Math.round(20 * scale);
    const margin = Math.round(30 * scale);

    // Patrón de líneas de barrido (scanlines CRT)
    const scanlineCount = Math.floor(height / 4);
    let scanlinesPath = '';
    for (let i = 0; i < scanlineCount; i++) {
        const y = i * 4;
        scanlinesPath += `M0,${y} H${width} `;
    }

    const trackingY = Math.round(height * 0.88);
    const trackingHeight = Math.round(18 * scale);

    return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <filter id="vhsGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>

        <!-- Scanlines entrelazadas de televisor analógico -->
        <path d="${scanlinesPath}" stroke="#000000" stroke-width="1.5" stroke-opacity="0.22"/>

        <!-- Franja de tracking analógico con desajuste de fase -->
        <rect x="0" y="${trackingY}" width="${width}" height="${trackingHeight}" fill="#ffffff" fill-opacity="0.18"/>
        <rect x="0" y="${trackingY + trackingHeight}" width="${width}" height="3" fill="#00ffff" fill-opacity="0.4"/>

        <!-- Menú OSD Superior: Grabación REC y velocidad de cinta -->
        <g filter="url(#vhsGlow)" font-family="'Courier New', monospace" font-weight="900">
            <text x="${margin}" y="${margin + fontSizeLg}" font-size="${fontSizeLg}" fill="#22c55e">REC ● [0:04:19]</text>
            <text x="${width - margin}" y="${margin + fontSizeLg}" font-size="${fontSizeLg}" fill="#f8fafc" text-anchor="end">SP ⯈</text>
        </g>

        <!-- Menú OSD Inferior: Fecha retro noventera y calidad de cinta -->
        <g filter="url(#vhsGlow)" font-family="'Courier New', monospace" font-weight="900">
            <text x="${margin}" y="${height - margin - fontSizeSm - 8}" font-size="${fontSizeLg}" fill="#facc15">14:28:09</text>
            <text x="${margin}" y="${height - margin}" font-size="${fontSizeLg}" fill="#facc15">MAY. 15 1996</text>
            <text x="${width - margin}" y="${height - margin}" font-size="${fontSizeSm}" fill="#cbd5e1" text-anchor="end">VHS-HQ • STEREO</text>
        </g>
    </svg>`;
}

module.exports = {
    name: 'fakevhs',
    alias: ['vhs', 'retro90s', 'efectovhs', 'camaravhs', 'retrovhs'],
    category: 'media',
    desc: 'Aplica un auténtico efecto estético de cámara VHS retro de los 90 a una imagen',
    usage: '.fakevhs (respondiendo a una foto o enviando una foto con .fakevhs)',

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
                    '┏❐ 《 📼 FILTRO DE CÁMARA RETRO VHS 》 ❐',
                    '┃',
                    '┃├◆ 📋 *¿Para qué sirve?*',
                    '┃  Aplica un efecto estético de videocámara de los 90s,',
                    '┃  con scanlines de televisión, fecha retro,',
                    '┃  indicador REC y colores vintage.',
                    '┃',
                    '┃├◆ 📌 *Modo de uso:*',
                    '┃  1. Envía una foto con el texto `.fakevhs`',
                    '┃  2. O responde a cualquier foto con `.fakevhs`',
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
                    text: '❌ No se pudo descargar la imagen para procesar el efecto VHS.'
                }, { quoted: m });
            }

            // Cargar imagen con Sharp para obtener dimensiones
            const image = sharp(buffer);
            const metadata = await image.metadata();
            const width = metadata.width || 800;
            const height = metadata.height || 600;

            // Generar overlay VHS
            const overlaySvg = createVhsOverlaySvg(width, height);
            const overlayBuffer = Buffer.from(overlaySvg);

            // Modular colores estilo película VHS (más cálido, mayor contraste analógico)
            const processedBuffer = await sharp(buffer)
                .modulate({
                    brightness: 1.03,
                    saturation: 1.28,
                    hue: 6
                })
                .composite([{
                    input: overlayBuffer,
                    top: 0,
                    left: 0
                }])
                .jpeg({ quality: 90 })
                .toBuffer();

            await m.react?.('📼');
            await sock.sendMessage(jid, {
                image: processedBuffer,
                caption: '📼 *Efecto VHS Camcorder (1996) Aplicado*\n\n_Unknown Codexツ</>_'
            }, { quoted: m });

        } catch (err) {
            logger.error('[FAKEVHS ERROR]:', err.message);
            await sock.sendMessage(jid, {
                text: `❌ Error al aplicar efecto VHS: ${err.message}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};

