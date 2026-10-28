'use strict';

const sharp = require('sharp');
const axios = require('axios');

/**
 * Normaliza cualquier JID
 */
function cleanJid(id) {
    if (!id) return '';
    return id.replace(/:.*@/, '@').split('@')[0] + '@s.whatsapp.net';
}

/**
 * Obtiene el buffer de imagen objetivo (mensaje citado, imagen propia o foto de perfil)
 */
async function getTargetImageBuffer(sock, m) {
    // 1. Imagen citada o adjunta
    if (m.quoted && (m.quoted.type === 'imageMessage' || m.quoted.mtype === 'imageMessage')) {
        try {
            return await m.quoted.download();
        } catch (_) {}
    }
    if (m.type === 'imageMessage' || m.mtype === 'imageMessage') {
        try {
            return await m.download();
        } catch (_) {}
    }

    // 2. Foto de perfil de usuario mencionado o remitente
    let targetJid = null;
    if (m.mentionedJid && m.mentionedJid.length > 0) {
        targetJid = cleanJid(m.mentionedJid[0]);
    } else if (m.quoted && m.quoted.sender) {
        targetJid = cleanJid(m.quoted.sender);
    } else {
        targetJid = cleanJid(m.sender);
    }

    if (targetJid) {
        try {
            const ppUrl = await sock.profilePictureUrl(targetJid, 'image').catch(() => null);
            if (ppUrl) {
                const res = await axios.get(ppUrl, { responseType: 'arraybuffer', timeout: 8000 });
                return Buffer.from(res.data);
            }
        } catch (_) {}
    }

    return null;
}

/**
 * Genera el overlay del efecto mediante Sharp
 */
async function applyEffect(buffer, effectName) {
    const base = sharp(buffer).resize(600, 600, { fit: 'cover' });

    switch (effectName) {
        case 'jail': {
            const barsSvg = `
                <svg width="600" height="600" xmlns="http://www.w3.org/2000/svg">
                    <!-- Barras verticales de prisión -->
                    <rect x="60" y="0" width="30" height="600" fill="#1c1c1e" stroke="#000" stroke-width="2"/>
                    <rect x="160" y="0" width="30" height="600" fill="#1c1c1e" stroke="#000" stroke-width="2"/>
                    <rect x="260" y="0" width="30" height="600" fill="#1c1c1e" stroke="#000" stroke-width="2"/>
                    <rect x="360" y="0" width="30" height="600" fill="#1c1c1e" stroke="#000" stroke-width="2"/>
                    <rect x="460" y="0" width="30" height="600" fill="#1c1c1e" stroke="#000" stroke-width="2"/>
                    <rect x="560" y="0" width="25" height="600" fill="#1c1c1e" stroke="#000" stroke-width="2"/>
                    <!-- Barras horizontales -->
                    <rect x="0" y="140" width="600" height="24" fill="#2c2c2e" stroke="#000" stroke-width="2"/>
                    <rect x="0" y="440" width="600" height="24" fill="#2c2c2e" stroke="#000" stroke-width="2"/>
                    <!-- Remaches -->
                    <circle cx="75" cy="152" r="5" fill="#555"/>
                    <circle cx="175" cy="152" r="5" fill="#555"/>
                    <circle cx="275" cy="152" r="5" fill="#555"/>
                    <circle cx="375" cy="152" r="5" fill="#555"/>
                    <circle cx="475" cy="152" r="5" fill="#555"/>
                    <circle cx="75" cy="452" r="5" fill="#555"/>
                    <circle cx="175" cy="452" r="5" fill="#555"/>
                    <circle cx="275" cy="452" r="5" fill="#555"/>
                    <circle cx="375" cy="452" r="5" fill="#555"/>
                    <circle cx="475" cy="452" r="5" fill="#555"/>
                </svg>
            `;
            return await base
                .grayscale()
                .modulate({ brightness: 0.9 })
                .composite([{ input: Buffer.from(barsSvg), top: 0, left: 0 }])
                .png()
                .toBuffer();
        }

        case 'passed': {
            const passedSvg = `
                <svg width="600" height="600" xmlns="http://www.w3.org/2000/svg">
                    <!-- Tinte cinematográfico -->
                    <rect width="600" height="600" fill="#664400" opacity="0.3"/>
                    <!-- Banner GTA -->
                    <rect x="0" y="240" width="600" height="120" fill="#000000" opacity="0.85"/>
                    <text x="50%" y="290" font-family="Arial Black, Impact, sans-serif" font-size="44" font-weight="900" fill="#f5ba13" text-anchor="middle" letter-spacing="3">MISIÓN PASADA</text>
                    <text x="50%" y="335" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#00ff66" text-anchor="middle" letter-spacing="2">RESPETO +</text>
                </svg>
            `;
            return await base
                .modulate({ saturation: 0.7, brightness: 0.95 })
                .composite([{ input: Buffer.from(passedSvg), top: 0, left: 0 }])
                .png()
                .toBuffer();
        }

        case 'triggered': {
            const trigSvg = `
                <svg width="600" height="600" xmlns="http://www.w3.org/2000/svg">
                    <!-- Tinte rojo furioso -->
                    <rect width="600" height="600" fill="#ff0000" opacity="0.35"/>
                    <!-- Banner Inferior -->
                    <rect x="0" y="500" width="600" height="100" fill="#ff0000"/>
                    <rect x="0" y="500" width="600" height="100" fill="#ffffff" opacity="0.15"/>
                    <text x="50%" y="565" font-family="Arial Black, Impact, sans-serif" font-size="52" font-weight="900" fill="#ffffff" text-anchor="middle" font-style="italic" letter-spacing="4">TRIGGERED</text>
                </svg>
            `;
            return await base
                .modulate({ brightness: 1.1, saturation: 1.4 })
                .composite([{ input: Buffer.from(trigSvg), top: 0, left: 0 }])
                .png()
                .toBuffer();
        }

        case 'circle': {
            const circleSvg = `
                <svg width="600" height="600">
                    <circle cx="300" cy="300" r="300" fill="#fff"/>
                </svg>
            `;
            return await base
                .composite([{ input: Buffer.from(circleSvg), blend: 'dest-in' }])
                .png()
                .toBuffer();
        }

        case 'glass': {
            const glassSvg = `
                <svg width="600" height="600" xmlns="http://www.w3.org/2000/svg">
                    <rect width="600" height="600" fill="#00ccff" opacity="0.2"/>
                    <!-- Reflejo diagonal -->
                    <polygon points="0,0 200,0 450,600 250,600" fill="#ffffff" opacity="0.25"/>
                    <polygon points="260,0 340,0 590,600 510,600" fill="#ffffff" opacity="0.15"/>
                    <line x1="150" y1="200" x2="350" y2="400" stroke="#ffffff" stroke-width="2" opacity="0.5"/>
                    <line x1="350" y1="400" x2="300" y2="550" stroke="#ffffff" stroke-width="1.5" opacity="0.4"/>
                    <line x1="350" y1="400" x2="500" y2="380" stroke="#ffffff" stroke-width="1.5" opacity="0.4"/>
                </svg>
            `;
            return await base
                .composite([{ input: Buffer.from(glassSvg), top: 0, left: 0 }])
                .png()
                .toBuffer();
        }

        case 'lgbt':
        default: {
            const rainbowSvg = `
                <svg width="600" height="600" xmlns="http://www.w3.org/2000/svg">
                    <rect x="0" y="0" width="600" height="100" fill="#e40303" opacity="0.4"/>
                    <rect x="0" y="100" width="600" height="100" fill="#ff8c00" opacity="0.4"/>
                    <rect x="0" y="200" width="600" height="100" fill="#ffed00" opacity="0.4"/>
                    <rect x="0" y="300" width="600" height="100" fill="#008026" opacity="0.4"/>
                    <rect x="0" y="400" width="600" height="100" fill="#24408e" opacity="0.4"/>
                    <rect x="0" y="500" width="600" height="100" fill="#732982" opacity="0.4"/>
                </svg>
            `;
            return await base
                .composite([{ input: Buffer.from(rainbowSvg), top: 0, left: 0 }])
                .png()
                .toBuffer();
        }
    }
}

/**
 * Ejecutor común para los comandos de edición de fotos
 */
async function handleImageEdit({ sock, m, effectName, title, emoji }) {
    try {
        if (typeof m.react === 'function') await m.react('⏳').catch(() => {});
    } catch (_) {}

    const rawBuffer = await getTargetImageBuffer(sock, m);

    if (!rawBuffer) {
        return await sock.sendMessage(m.chat, {
            text: `❌ Debes enviar/citar una imagen o mencionar a un usuario con foto de perfil.\n\nEjemplo: *${m.prefix || '.'}${effectName} @usuario*\n\n_Unknown Codexツ</>_`
        }, { quoted: m });
    }

    try {
        const resultBuffer = await applyEffect(rawBuffer, effectName);

        await sock.sendMessage(m.chat, {
            image: resultBuffer,
            caption: `${emoji} *EFECTO: ${title}*\n\n_Unknown Codexツ</>_`
        }, { quoted: m });

        try {
            if (typeof m.react === 'function') await m.react(emoji).catch(() => {});
        } catch (_) {}

    } catch (err) {
        console.error(`Error aplicando efecto ${effectName}:`, err);
        await sock.sendMessage(m.chat, {
            text: `❌ Error al procesar la imagen: ${err.message}`
        }, { quoted: m });
    }
}

module.exports = [
    {
        name: 'jail',
        alias: ['carcel', 'prision'],
        category: 'multimedia',
        desc: 'Pone rejas de prisión sobre una imagen o foto de perfil',
        usage: '.jail [@usuario o citando foto]',
        execute: async (ctx) => handleImageEdit({ ...ctx, effectName: 'jail', title: 'A LA CÁRCEL 👮‍♂️', emoji: '⛓️' })
    },
    {
        name: 'passed',
        alias: ['misionpasada', 'gtapassed', 'gta'],
        category: 'multimedia',
        desc: 'Aplica el efecto GTA "Misión Pasada / Respeto +"',
        usage: '.passed [@usuario o citando foto]',
        execute: async (ctx) => handleImageEdit({ ...ctx, effectName: 'passed', title: 'GTA MISIÓN PASADA', emoji: '⭐' })
    },
    {
        name: 'triggered',
        alias: ['enojado', 'furia'],
        category: 'multimedia',
        desc: 'Aplica el efecto meme "Triggered" con filtro rojo de ira',
        usage: '.triggered [@usuario o citando foto]',
        execute: async (ctx) => handleImageEdit({ ...ctx, effectName: 'triggered', title: 'TRIGGERED!', emoji: '💢' })
    },
    {
        name: 'circle',
        alias: ['circulo', 'redondo'],
        category: 'multimedia',
        desc: 'Recorta una foto en un avatar circular perfecto',
        usage: '.circle [@usuario o citando foto]',
        execute: async (ctx) => handleImageEdit({ ...ctx, effectName: 'circle', title: 'FOTO CIRCULAR', emoji: '⭕' })
    },
    {
        name: 'glass',
        alias: ['vidrio', 'cristal'],
        category: 'multimedia',
        desc: 'Aplica un filtro de cristal polarizado y reflejo',
        usage: '.glass [@usuario o citando foto]',
        execute: async (ctx) => handleImageEdit({ ...ctx, effectName: 'glass', title: 'EFECTO CRISTAL', emoji: '🪟' })
    },
    {
        name: 'gay',
        alias: ['lgbt', 'rainbow', 'arcoiris'],
        category: 'multimedia',
        desc: 'Aplica un filtro con los colores del arcoíris LGBT',
        usage: '.gay [@usuario o citando foto]',
        execute: async (ctx) => handleImageEdit({ ...ctx, effectName: 'lgbt', title: 'FILTRO ARCOÍRIS', emoji: '🌈' })
    }
];

