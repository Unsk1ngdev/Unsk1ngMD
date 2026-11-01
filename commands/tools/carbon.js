'use strict';

const sharp = require('sharp');
const logger = require('../../lib/logger');

/**
 * Escapa caracteres especiales para SVG
 */
function escapeXml(unsafe) {
    return String(unsafe || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Resalta sintaxis básica estilo Carbon / VSCode en SVG
 */
function highlightCodeLine(line) {
    let escaped = escapeXml(line);

    // Comentarios
    if (/^\s*\/\//.test(line)) {
        return `<tspan fill="#6c7086" font-style="italic">${escaped}</tspan>`;
    }

    // Cadenas de texto
    escaped = escaped.replace(/(['"`])(.*?)\1/g, '<tspan fill="#a6e3a1">$1$2$1</tspan>');

    // Palabras clave
    const keywords = ['const', 'let', 'var', 'function', 'return', 'async', 'await', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'new', 'try', 'catch', 'throw', 'typeof'];
    const kwRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
    escaped = escaped.replace(kwRegex, '<tspan fill="#cba6f7" font-weight="bold">$1</tspan>');

    // Valores booleanos y null
    escaped = escaped.replace(/\b(true|false|null|undefined)\b/g, '<tspan fill="#f38ba8">$1</tspan>');

    // Números
    escaped = escaped.replace(/\b(\d+)\b/g, '<tspan fill="#fab387">$1</tspan>');

    return `<tspan fill="#cdd6f4">${escaped}</tspan>`;
}

/**
 * Genera tarjeta visual estilo Carbon.now.sh
 */
async function generateCarbonBuffer(code) {
    const lines = code.split('\n').slice(0, 35); // Máximo 35 líneas
    const maxLineLen = Math.max(...lines.map(l => l.length), 30);
    const cardWidth = Math.min(950, Math.max(680, maxLineLen * 10 + 140));
    const cardHeight = Math.max(260, lines.length * 24 + 140);

    const codeLinesSvg = lines.map((line, idx) => {
        const lineNum = String(idx + 1).padStart(2, ' ');
        const y = 90 + idx * 24;
        const highlighted = highlightCodeLine(line);
        return `
            <text x="35" y="${y}" font-family="'Fira Code', 'Consolas', monospace" font-size="14" fill="#585b70" text-anchor="end">${lineNum}</text>
            <text x="55" y="${y}" font-family="'Fira Code', 'Consolas', monospace" font-size="14">${highlighted}</text>
        `;
    }).join('');

    const svg = `
    <svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#1e1e2e"/>
                <stop offset="50%" stop-color="#2a2b3d"/>
                <stop offset="100%" stop-color="#181825"/>
            </linearGradient>
            <filter id="editorShadow" x="-5%" y="-5%" width="110%" height="110%">
                <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.6"/>
            </filter>
        </defs>

        <!-- Fondo degradado exterior -->
        <rect width="${cardWidth}" height="${cardHeight}" rx="18" fill="url(#bgGrad)"/>
        <rect x="2" y="2" width="${cardWidth - 4}" height="${cardHeight - 4}" rx="17" fill="none" stroke="#45475a" stroke-width="1.5"/>

        <!-- Ventana interior del editor -->
        <g filter="url(#editorShadow)">
            <rect x="15" y="15" width="${cardWidth - 30}" height="${cardHeight - 30}" rx="12" fill="#11111b" stroke="#313244" stroke-width="1.5"/>
            
            <!-- Barra superior estilo macOS -->
            <rect x="15" y="15" width="${cardWidth - 30}" height="42" rx="12" fill="#181825"/>
            <rect x="15" y="45" width="${cardWidth - 30}" height="12" fill="#181825"/>
            
            <!-- Botones de ventana (Semáforo macOS) -->
            <circle cx="40" cy="36" r="6" fill="#f38ba8"/>
            <circle cx="60" cy="36" r="6" fill="#f9e2af"/>
            <circle cx="80" cy="36" r="6" fill="#a6e3a1"/>

            <!-- Título de archivo -->
            <text x="${cardWidth / 2}" y="40" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="bold" fill="#a6adc8" text-anchor="middle">app.js — Carbon Snippet</text>

            <!-- Separador -->
            <line x1="15" y1="56" x2="${cardWidth - 15}" y2="56" stroke="#313244" stroke-width="1"/>
            
            <!-- Líneas de código -->
            ${codeLinesSvg}
        </g>
    </svg>`;

    return await sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = {
    name: 'carbon',
    alias: ['codeimg', 'carbonsh', 'carboncode', 'snippet'],
    category: 'tools',
    desc: 'Genera una imagen estilizada y elegante de código al estilo carbon.now.sh',
    usage: '.carbon <código> (o respondiendo a un mensaje con código)',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        let code = (args || []).join(' ').trim();

        // Si no envió texto en args, verificar si citó un mensaje
        if (!code && m.quoted) {
            code = (m.quoted.body || m.quoted.text || '').trim();
        }

        if (!code) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 💻 CARBON CODE GENERATOR 》 ❐',
                    '┃',
                    '┃├◆ 📋 *¿Para qué sirve?*',
                    '┃  Convierte cualquier fragmento de código en una imagen',
                    '┃  elegante con tema oscuro al estilo carbon.now.sh.',
                    '┃',
                    '┃├◆ 📌 *Modos de uso:*',
                    '┃  1. `.carbon console.log("Hola mundo");`',
                    '┃  2. O responde a cualquier mensaje de código con `.carbon`',
                    '┃',
                    '┃├◆ 💡 *Ejemplo:*',
                    '┃  `.carbon const bot = new WhatsAppBot();`',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        try {
            await m.react?.('⏳');
            const imgBuffer = await generateCarbonBuffer(code);

            await sock.sendMessage(jid, {
                image: imgBuffer,
                caption: '💻 *Snippet generado con Carbon.now.sh Engine*\n\n_Unknown Codexツ</>_'
            }, { quoted: m });

            await m.react?.('✨');
        } catch (err) {
            logger.error('[CARBON ERROR]:', err.message);
            await sock.sendMessage(jid, {
                text: `❌ Error al generar la imagen de código: ${err.message}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};

