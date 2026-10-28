'use strict';

const sharp = require('sharp');

/**
 * Escapa caracteres especiales XML para SVG seguro
 */
function escapeXml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Generador SVG para diferentes estilos de texto
 */
function generateSvgTheme(style, text) {
    const cleanText = escapeXml(text).slice(0, 32); // Máximo 32 caracteres
    const fontSize = cleanText.length > 20 ? 42 : (cleanText.length > 12 ? 56 : 72);

    let defs = '';
    let background = '<rect width="100%" height="100%" fill="#0a0a12"/>';
    let textElement = '';

    switch (style) {
        case 'neon':
            defs = `
                <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="8" result="blur1"/>
                    <feGaussianBlur stdDeviation="16" result="blur2"/>
                    <feMerge>
                        <feMergeNode in="blur2"/>
                        <feMergeNode in="blur1"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#00f0ff"/>
                    <stop offset="50%" stop-color="#7000ff"/>
                    <stop offset="100%" stop-color="#ff007b"/>
                </linearGradient>
            `;
            background = `
                <rect width="100%" height="100%" fill="#05050d"/>
                <circle cx="150" cy="80" r="140" fill="#00f0ff" opacity="0.08"/>
                <circle cx="750" cy="220" r="160" fill="#ff007b" opacity="0.08"/>
                <path d="M 0,260 L 900,260" stroke="#ff007b" stroke-width="2" opacity="0.3"/>
            `;
            textElement = `
                <text x="50%" y="48%" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${fontSize}" fill="url(#neonGrad)" stroke="#ffffff" stroke-width="1.5" text-anchor="middle" dominant-baseline="middle" filter="url(#neonGlow)" letter-spacing="3">${cleanText}</text>
                <text x="50%" y="78%" font-family="Courier, monospace" font-size="14" fill="#00f0ff" text-anchor="middle" letter-spacing="6" opacity="0.8">★ N E O N  E F F E C T ★</text>
            `;
            break;

        case 'glitch':
            defs = `
                <linearGradient id="cyberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#00ffcc"/>
                    <stop offset="100%" stop-color="#ff0055"/>
                </linearGradient>
            `;
            background = `
                <rect width="100%" height="100%" fill="#08070d"/>
                <line x1="0" y1="60" x2="900" y2="60" stroke="#00ffcc" stroke-width="1" opacity="0.2"/>
                <line x1="0" y1="180" x2="900" y2="180" stroke="#ff0055" stroke-width="1" opacity="0.25"/>
                <line x1="0" y1="240" x2="900" y2="240" stroke="#00ffcc" stroke-width="1" opacity="0.15"/>
            `;
            textElement = `
                <text x="50.4%" y="47.6%" font-family="Impact, Arial Black, sans-serif" font-weight="900" font-size="${fontSize}" fill="#ff0055" opacity="0.75" text-anchor="middle" dominant-baseline="middle" letter-spacing="4">${cleanText}</text>
                <text x="49.6%" y="48.4%" font-family="Impact, Arial Black, sans-serif" font-weight="900" font-size="${fontSize}" fill="#00ffcc" opacity="0.75" text-anchor="middle" dominant-baseline="middle" letter-spacing="4">${cleanText}</text>
                <text x="50%" y="48%" font-family="Impact, Arial Black, sans-serif" font-weight="900" font-size="${fontSize}" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" letter-spacing="4">${cleanText}</text>
                <text x="50%" y="80%" font-family="Courier, monospace" font-size="14" fill="#ff0055" text-anchor="middle" letter-spacing="5">SYSTEM_CORRUPTED // GLITCH</text>
            `;
            break;

        case 'matrix':
            background = `
                <rect width="100%" height="100%" fill="#000e05"/>
                <text x="50" y="40" font-family="monospace" font-size="12" fill="#00ff44" opacity="0.25">101001 010110 110011 001010 101101 010101 110110</text>
                <text x="80" y="80" font-family="monospace" font-size="12" fill="#00ff44" opacity="0.25">011010 110101 001100 110101 010110 101001 001101</text>
                <text x="30" y="240" font-family="monospace" font-size="12" fill="#00ff44" opacity="0.2">110101 010110 101001 110011 001010 101101 010101</text>
            `;
            defs = `
                <filter id="matrixGlow">
                    <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            `;
            textElement = `
                <text x="50%" y="48%" font-family="Courier, monospace" font-weight="900" font-size="${fontSize}" fill="#00ff66" text-anchor="middle" dominant-baseline="middle" filter="url(#matrixGlow)" letter-spacing="6">${cleanText}</text>
                <text x="50%" y="78%" font-family="Courier, monospace" font-size="14" fill="#00bb44" text-anchor="middle" letter-spacing="8">[ MATRIX CODE PROTOCOL ]</text>
            `;
            break;

        case 'fire':
            defs = `
                <linearGradient id="fireGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stop-color="#ff1a00"/>
                    <stop offset="45%" stop-color="#ff7b00"/>
                    <stop offset="85%" stop-color="#ffea00"/>
                    <stop offset="100%" stop-color="#ffffff"/>
                </linearGradient>
                <filter id="fireGlow">
                    <feGaussianBlur stdDeviation="7" result="blur"/>
                    <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            `;
            background = `
                <rect width="100%" height="100%" fill="#140200"/>
                <circle cx="450" cy="200" r="190" fill="#ff4400" opacity="0.12"/>
            `;
            textElement = `
                <text x="50%" y="48%" font-family="Impact, Arial Black, sans-serif" font-weight="900" font-size="${fontSize}" fill="url(#fireGrad)" stroke="#440000" stroke-width="1.5" text-anchor="middle" dominant-baseline="middle" filter="url(#fireGlow)" letter-spacing="3">${cleanText}</text>
                <text x="50%" y="80%" font-family="Arial, sans-serif" font-weight="bold" font-size="14" fill="#ff7b00" text-anchor="middle" letter-spacing="6">🔥 F I R E  B U R N  T E X T 🔥</text>
            `;
            break;

        case 'blackpink':
            defs = `
                <linearGradient id="bpGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#ff75a0"/>
                    <stop offset="50%" stop-color="#fce2db"/>
                    <stop offset="100%" stop-color="#ff75a0"/>
                </linearGradient>
                <filter id="bpGlow">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#ff4081" flood-opacity="0.6"/>
                </filter>
            `;
            background = `
                <rect width="100%" height="100%" fill="#0a0a0a"/>
                <rect x="20" y="20" width="860" height="260" fill="none" stroke="#ff75a0" stroke-width="2" opacity="0.5"/>
            `;
            textElement = `
                <text x="50%" y="48%" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${fontSize}" fill="url(#bpGrad)" text-anchor="middle" dominant-baseline="middle" filter="url(#bpGlow)" letter-spacing="5">${cleanText}</text>
                <text x="50%" y="78%" font-family="Arial, sans-serif" font-weight="700" font-size="13" fill="#ff75a0" text-anchor="middle" letter-spacing="8">B L A C K P I N K  S T Y L E</text>
            `;
            break;

        case 'devil':
            defs = `
                <linearGradient id="devilGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#ff2222"/>
                    <stop offset="100%" stop-color="#660000"/>
                </linearGradient>
                <filter id="devilGlow">
                    <feGaussianBlur stdDeviation="6" result="blur"/>
                    <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            `;
            background = `
                <rect width="100%" height="100%" fill="#0d0000"/>
                <polygon points="450,20 480,80 420,80" fill="#ff0000" opacity="0.1"/>
            `;
            textElement = `
                <text x="50%" y="48%" font-family="Impact, Arial Black, sans-serif" font-size="${fontSize}" fill="url(#devilGrad)" stroke="#1a0000" stroke-width="2" text-anchor="middle" dominant-baseline="middle" filter="url(#devilGlow)" letter-spacing="4">${cleanText}</text>
                <text x="50%" y="80%" font-family="Courier, monospace" font-size="14" fill="#ff3333" text-anchor="middle" letter-spacing="6">⛧ D E V I L  T E X T ⛧</text>
            `;
            break;

        case 'thunder':
            defs = `
                <linearGradient id="thunderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#ffffff"/>
                    <stop offset="40%" stop-color="#70d6ff"/>
                    <stop offset="100%" stop-color="#0044ff"/>
                </linearGradient>
                <filter id="thunderGlow">
                    <feGaussianBlur stdDeviation="8" result="blur"/>
                    <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            `;
            background = `
                <rect width="100%" height="100%" fill="#020412"/>
                <path d="M 440,0 L 410,120 L 460,110 L 430,300" stroke="#70d6ff" stroke-width="1.5" opacity="0.25" fill="none"/>
            `;
            textElement = `
                <text x="50%" y="48%" font-family="Impact, Arial Black, sans-serif" font-size="${fontSize}" fill="url(#thunderGrad)" text-anchor="middle" dominant-baseline="middle" filter="url(#thunderGlow)" letter-spacing="4">${cleanText}</text>
                <text x="50%" y="80%" font-family="Arial, sans-serif" font-weight="bold" font-size="14" fill="#70d6ff" text-anchor="middle" letter-spacing="7">⚡ T H U N D E R  S T O R M ⚡</text>
            `;
            break;

        case 'sand':
        default:
            defs = `
                <linearGradient id="sandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#ffe6a7"/>
                    <stop offset="50%" stop-color="#d4a373"/>
                    <stop offset="100%" stop-color="#99582a"/>
                </linearGradient>
                <filter id="sandShadow">
                    <feDropShadow dx="3" dy="4" stdDeviation="3" flood-color="#2b1704" flood-opacity="0.8"/>
                </filter>
            `;
            background = `
                <rect width="100%" height="100%" fill="#3a2510"/>
                <rect width="100%" height="100%" fill="#f5deb3" opacity="0.15"/>
            `;
            textElement = `
                <text x="50%" y="48%" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${fontSize}" fill="url(#sandGrad)" text-anchor="middle" dominant-baseline="middle" filter="url(#sandShadow)" letter-spacing="4">${cleanText}</text>
                <text x="50%" y="78%" font-family="Georgia, serif" font-style="italic" font-size="15" fill="#ffe6a7" text-anchor="middle" letter-spacing="4">~ Desert Gold Sand ~</text>
            `;
            break;
    }

    return `
        <svg width="900" height="300" viewBox="0 0 900 300" xmlns="http://www.w3.org/2000/svg">
            <defs>${defs}</defs>
            ${background}
            ${textElement}
        </svg>
    `;
}

/**
 * Handler genérico para crear y enviar el logo
 */
async function handleTextMaker({ sock, m, text, style, title, icon }) {
    const inputText = text?.trim() || m.quoted?.body?.trim();

    if (!inputText) {
        return await sock.sendMessage(m.chat, {
            text: `❌ Debes proporcionar un texto.\n\nEjemplo: *${m.prefix || '.'}${style} Tu Nombre*\n\n_Unknown Codexツ</>_`
        }, { quoted: m });
    }

    try {
        if (typeof m.react === 'function') await m.react(icon).catch(() => {});
    } catch (_) {}

    try {
        const svgString = generateSvgTheme(style, inputText);
        const imageBuffer = await sharp(Buffer.from(svgString))
            .png({ quality: 90 })
            .toBuffer();

        const caption =
            `╭━━━〔 ${icon} *TEXT MAKER: ${title}* 〕━━━⬣\n` +
            `┃ ✍️ *Texto:* ${inputText}\n` +
            `┃ 🎨 *Efecto:* ${style.toUpperCase()}\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
            `_Unknown Codexツ</>_`;

        await sock.sendMessage(m.chat, {
            image: imageBuffer,
            caption
        }, { quoted: m });

    } catch (err) {
        console.error(`Error generando texto ${style}:`, err);
        await sock.sendMessage(m.chat, {
            text: `❌ Ocurrió un error al generar el logo: ${err.message}`
        }, { quoted: m });
    }
}

module.exports = [
    {
        name: 'neon',
        alias: ['textneon', 'logoneon'],
        category: 'multimedia',
        desc: 'Genera un logo o texto en estilo Neón resplandeciente',
        usage: '.neon [texto]',
        execute: async (ctx) => handleTextMaker({ ...ctx, style: 'neon', title: 'NEÓN BRILLANTE', icon: '✨' })
    },
    {
        name: 'glitch',
        alias: ['cybertext', 'logoglitch'],
        category: 'multimedia',
        desc: 'Genera un texto con efecto Glitch Cyberpunk distorsionado',
        usage: '.glitch [texto]',
        execute: async (ctx) => handleTextMaker({ ...ctx, style: 'glitch', title: 'GLITCH CYBERPUNK', icon: '👾' })
    },
    {
        name: 'matrix',
        alias: ['textmatrix', 'hacktext'],
        category: 'multimedia',
        desc: 'Genera un texto con código digital estilo Matrix',
        usage: '.matrix [texto]',
        execute: async (ctx) => handleTextMaker({ ...ctx, style: 'matrix', title: 'MATRIX DIGITAL', icon: '💻' })
    },
    {
        name: 'fire',
        alias: ['textfire', 'fuegotext', 'llama'],
        category: 'multimedia',
        desc: 'Genera un texto con llamas y efecto ardiente de fuego',
        usage: '.fire [texto]',
        execute: async (ctx) => handleTextMaker({ ...ctx, style: 'fire', title: 'FUEGO ARDIENTE', icon: '🔥' })
    },
    {
        name: 'blackpink',
        alias: ['bptext', 'pinktext'],
        category: 'multimedia',
        desc: 'Genera un texto estilo Blackpink K-Pop rosa y negro',
        usage: '.blackpink [texto]',
        execute: async (ctx) => handleTextMaker({ ...ctx, style: 'blackpink', title: 'BLACKPINK ESTILO', icon: '💖' })
    },
    {
        name: 'devil',
        alias: ['textdevil', 'demonio'],
        category: 'multimedia',
        desc: 'Genera un texto con efecto gótico demoníaco oscuro',
        usage: '.devil [texto]',
        execute: async (ctx) => handleTextMaker({ ...ctx, style: 'devil', title: 'DEMONÍACO / DEVIL', icon: '😈' })
    },
    {
        name: 'thunder',
        alias: ['rayo', 'trueno', 'lightning'],
        category: 'multimedia',
        desc: 'Genera un texto electrizante con relámpagos y truenos',
        usage: '.thunder [texto]',
        execute: async (ctx) => handleTextMaker({ ...ctx, style: 'thunder', title: 'TRUENO & RELÁMPAGO', icon: '⚡' })
    },
    {
        name: 'sand',
        alias: ['arena', 'sandtext'],
        category: 'multimedia',
        desc: 'Genera un texto grabado en arena dorada del desierto',
        usage: '.sand [texto]',
        execute: async (ctx) => handleTextMaker({ ...ctx, style: 'sand', title: 'ARENA DEL DESIERTO', icon: '🏜️' })
    }
];

