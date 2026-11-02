'use strict';

const axios = require('axios');
const sharp = require('../../lib/sharp');
const logger = require('../../lib/logger');

/**
 * Divide el texto en líneas que quepan en el ancho del cuaderno
 */
function wrapText(text, maxCharsPerLine = 48) {
    const rawLines = text.split('\n');
    const wrapped = [];

    for (const line of rawLines) {
        if (line.length <= maxCharsPerLine) {
            wrapped.push(line);
        } else {
            const words = line.split(' ');
            let currentLine = '';
            for (const word of words) {
                if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
                    currentLine = (currentLine + ' ' + word).trim();
                } else {
                    if (currentLine) wrapped.push(currentLine);
                    currentLine = word;
                }
            }
            if (currentLine) wrapped.push(currentLine);
        }
    }

    return wrapped.slice(0, 24); // Máximo 24 líneas por página
}

/**
 * Escapa caracteres especiales para SVG
 */
function escapeXml(unsafe) {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Genera el buffer PNG de una hoja de cuaderno escrita a mano
 */
async function generateNotebookImage(text, dateStr) {
    const width = 800;
    const height = 950;
    const lineSpacing = 32;
    const startY = 140;
    const marginX = 110;

    const wrappedLines = wrapText(text, 44);

    // Generar las líneas azules horizontales
    let horizontalLinesSvg = '';
    for (let y = startY; y < height - 40; y += lineSpacing) {
        horizontalLinesSvg += `<line x1="50" y1="${y}" x2="${width - 40}" y2="${y}" stroke="#b0c4de" stroke-width="1.2" stroke-opacity="0.85"/>`;
    }

    // Generar el texto alineado con los renglones
    let textElementsSvg = '';
    wrappedLines.forEach((line, index) => {
        const textY = startY + (index * lineSpacing) - 6;
        textElementsSvg += `<text x="${marginX + 5}" y="${textY}" font-family="'Comic Sans MS', 'Caveat', 'Segoe Print', cursive, sans-serif" font-size="20" font-weight="500" fill="#1b2a4a" font-style="italic">${escapeXml(line)}</text>`;
    });

    // Anillas / Espirales del cuaderno
    let ringsSvg = '';
    for (let y = 60; y < height - 50; y += 45) {
        ringsSvg += `<circle cx="28" cy="${y}" r="8" fill="#d1d5db" stroke="#9ca3af" stroke-width="2"/>`;
        ringsSvg += `<rect x="15" y="${y - 4}" width="22" height="8" rx="4" fill="#9ca3af"/>`;
    }

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <!-- Fondo de papel -->
        <rect width="100%" height="100%" fill="#fcfbf7"/>

        <!-- Sombra sutil del borde derecho e inferior -->
        <rect x="${width - 8}" y="0" width="8" height="${height}" fill="#000000" opacity="0.04"/>
        <rect x="0" y="${height - 8}" width="${width}" height="8" fill="#000000" opacity="0.04"/>

        <!-- Líneas guía horizontales del cuaderno -->
        ${horizontalLinesSvg}

        <!-- Margen rojo vertical -->
        <line x1="${marginX}" y1="40" x2="${marginX}" y2="${height - 30}" stroke="#f87171" stroke-width="2" stroke-opacity="0.9"/>

        <!-- Espirales del cuaderno en el lateral izquierdo -->
        ${ringsSvg}

        <!-- Encabezado de fecha -->
        <text x="${width - 240}" y="85" font-family="'Segoe UI', sans-serif" font-size="14" fill="#6b7280" font-weight="bold">FECHA:</text>
        <text x="${width - 175}" y="85" font-family="'Segoe Print', cursive, sans-serif" font-size="15" fill="#1b2a4a">${escapeXml(dateStr)}</text>
        <line x1="${width - 180}" y1="90" x2="${width - 50}" y2="90" stroke="#b0c4de" stroke-width="1.5"/>

        <text x="${width - 240}" y="115" font-family="'Segoe UI', sans-serif" font-size="14" fill="#6b7280" font-weight="bold">PÁG:</text>
        <text x="${width - 190}" y="115" font-family="'Segoe Print', cursive, sans-serif" font-size="15" fill="#1b2a4a">01</text>
        <line x1="${width - 195}" y1="120" x2="${width - 140}" y2="120" stroke="#b0c4de" stroke-width="1.5"/>

        <!-- Contenido escrito a mano -->
        ${textElementsSvg}
    </svg>`;

    return await sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = {
    name: 'nulis',
    alias: ['escribir', 'cuaderno', 'manoescrito', 'handwrite', 'papel'],
    category: 'herramientas',
    desc: 'Genera una imagen realista de una hoja de cuaderno escrita a mano con tu texto',
    usage: '.nulis <texto a escribir en la hoja>',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        const input = (args && args.length > 0 ? args.join(' ') : (text || m.quoted?.body || '')).trim();

        if (!input) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 📝 ESCRITURA EN CUADERNO (NULIS) 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* `.nulis <tu texto>`',
                    '┃├◆ 📌 *Ejemplo:*',
                    '┃   `.nulis Querido diario: Hoy fue un gran día aprendiendo a programar bots de WhatsApp.`',
                    '┃',
                    '┃├◆ ✍️ Genera una hoja de libreta rayada con texto',
                    '┃  manuscrito con tinta azul en alta resolución.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        await m.react?.('✍️');

        const now = new Date();
        const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;

        try {
            // Generar la imagen localmente con Sharp
            const imageBuffer = await generateNotebookImage(input, dateStr);

            await sock.sendMessage(jid, {
                image: imageBuffer,
                caption: '📝 *Texto escrito a mano en cuaderno*\n_Unknown Codexツ</>_'
            }, { quoted: m });

            await m.react?.('✅');

        } catch (err) {
            logger.error('[NULIS ERROR]:', err.message);
            await m.react?.('❌');
            await sock.sendMessage(jid, {
                text: `❌ Error al generar la hoja de cuaderno: ${err.message}`
            }, { quoted: m });
        }
    }
};

