'use strict';

const sharp = require('../../lib/sharp');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const logger = require('../../lib/logger');
const userNames = require('../../lib/userNames');

/**
 * Escapa texto para inclusión en SVG
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
 * Resuelve el nombre visible y handle de la persona de forma inteligente
 * Evitando colocar números de teléfono o IDs crudos de WhatsApp
 */
function resolvePersonInfo(rawInput, m) {
    let resolvedName = null;
    const cleanInput = String(rawInput || '').trim();

    // 1. Si hay una mención explícita (@usuario en WhatsApp)
    if (m.mentionedJid && m.mentionedJid.length > 0) {
        const taggedJid = m.mentionedJid[0];
        const fromCache = userNames.get(taggedJid);
        if (fromCache && !/^@?[0-9]+$/.test(fromCache)) {
            resolvedName = fromCache;
        }
    }

    // 2. Si el texto ingresado parece un número de teléfono o ID (ej. 18091234567, @18091234567)
    if (!resolvedName && cleanInput) {
        const isId = /^@?[0-9]{6,25}(?::\d+)?(?:@[\w.]+)?$/.test(cleanInput);
        if (isId) {
            const digits = cleanInput.replace(/[^0-9]/g, '');
            const fromCache = userNames.get(digits) || userNames.get(`${digits}@s.whatsapp.net`);
            if (fromCache && !/^@?[0-9]+$/.test(fromCache)) {
                resolvedName = fromCache;
            } else if (m.sender && m.sender.replace(/[^0-9]/g, '').includes(digits) && m.pushName) {
                resolvedName = m.pushName;
            } else if (m.quoted && (m.quoted.sender || '').replace(/[^0-9]/g, '').includes(digits) && m.quoted.pushName) {
                resolvedName = m.quoted.pushName;
            }
        } else {
            // Nombre explícito ingresado
            resolvedName = cleanInput.replace(/^@/, '');
        }
    }

    // 3. Si no hay nombre y se citó un mensaje, usar el nombre del citado
    if (!resolvedName && m.quoted) {
        if (m.quoted.pushName && m.quoted.pushName !== 'Sin Nombre' && m.quoted.pushName !== 'Usuario') {
            resolvedName = m.quoted.pushName;
        } else if (m.quoted.sender) {
            const fromCache = userNames.get(m.quoted.sender);
            if (fromCache && !/^@?[0-9]+$/.test(fromCache)) {
                resolvedName = fromCache;
            }
        }
    }

    // 4. Si no se especificó y no se citó a nadie, usar el nombre del que ejecuta el comando
    if (!resolvedName) {
        if (m.pushName && m.pushName !== 'Sin Nombre' && m.pushName !== 'Usuario') {
            resolvedName = m.pushName;
        } else if (m.sender) {
            const fromCache = userNames.get(m.sender);
            if (fromCache && !/^@?[0-9]+$/.test(fromCache)) {
                resolvedName = fromCache;
            }
        }
    }

    // 5. Fallback final limpio (nunca mostrar IDs numéricos)
    if (!resolvedName || /^@?[0-9]+$/.test(resolvedName)) {
        resolvedName = 'Usuario';
    }

    resolvedName = resolvedName.replace(/@s\.whatsapp\.net|@lid/g, '').trim();

    // Generar handle / username slugificado limpio (ej: "Carlos Gómez" -> "@carlos_gomez")
    const cleanSlug = resolvedName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 15) || 'usuario';

    return {
        displayName: resolvedName,
        handle: `@${cleanSlug}`
    };
}

/**
 * Genera el overlay vectorial con la UI completa de Instagram Reels / TikTok
 */
function createSocialOverlaySvg(width, height, displayName, handle, caption) {
    const scale = Math.max(0.6, width / 720);
    const cleanCaption = caption || 'Disfrutando del momento ✨ #fyp #viral';

    const rightMargin = Math.round(25 * scale);
    const rightColX = width - rightMargin - Math.round(20 * scale);

    return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bottomShadow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
                <stop offset="60%" stop-color="#000000" stop-opacity="0.4"/>
                <stop offset="100%" stop-color="#000000" stop-opacity="0.85"/>
            </linearGradient>
            <linearGradient id="topShadow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#000000" stop-opacity="0.6"/>
                <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
            </linearGradient>
            <filter id="iconShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.7"/>
            </filter>
        </defs>

        <!-- Sombra superior para legibilidad -->
        <rect x="0" y="0" width="${width}" height="${Math.round(120 * scale)}" fill="url(#topShadow)"/>

        <!-- Header superior estilo Reels -->
        <g font-family="'Segoe UI', Roboto, sans-serif" font-weight="bold">
            <text x="${Math.round(30 * scale)}" y="${Math.round(55 * scale)}" font-size="${Math.round(26 * scale)}" fill="#ffffff">Reels</text>
            <text x="${width - Math.round(40 * scale)}" y="${Math.round(55 * scale)}" font-size="${Math.round(24 * scale)}" fill="#ffffff" text-anchor="end">📷</text>
        </g>

        <!-- Sombra inferior para legibilidad de subtítulos y controles -->
        <rect x="0" y="${height - Math.round(280 * scale)}" width="${width}" height="${Math.round(280 * scale)}" fill="url(#bottomShadow)"/>

        <!-- Columna lateral derecha de acciones sociales -->
        <g filter="url(#iconShadow)" text-anchor="middle" font-family="'Segoe UI', sans-serif">
            <!-- Botón Me Gusta (Corazón) -->
            <g transform="translate(${rightColX}, ${height - Math.round(360 * scale)})">
                <text x="0" y="0" font-size="${Math.round(36 * scale)}" fill="#ff3040">❤️</text>
                <text x="0" y="${Math.round(24 * scale)}" font-size="${Math.round(13 * scale)}" font-weight="bold" fill="#ffffff">184K</text>
            </g>

            <!-- Botón Comentarios -->
            <g transform="translate(${rightColX}, ${height - Math.round(280 * scale)})">
                <text x="0" y="0" font-size="${Math.round(34 * scale)}" fill="#ffffff">💬</text>
                <text x="0" y="${Math.round(24 * scale)}" font-size="${Math.round(13 * scale)}" font-weight="bold" fill="#ffffff">3,240</text>
            </g>

            <!-- Botón Compartir -->
            <g transform="translate(${rightColX}, ${height - Math.round(200 * scale)})">
                <text x="0" y="0" font-size="${Math.round(34 * scale)}" fill="#ffffff">✈️</text>
                <text x="0" y="${Math.round(24 * scale)}" font-size="${Math.round(13 * scale)}" font-weight="bold" fill="#ffffff">28.5K</text>
            </g>

            <!-- Botón Guardar -->
            <g transform="translate(${rightColX}, ${height - Math.round(130 * scale)})">
                <text x="0" y="0" font-size="${Math.round(32 * scale)}" fill="#ffffff">🔖</text>
            </g>

            <!-- Vinilo giratorio de audio -->
            <g transform="translate(${rightColX}, ${height - Math.round(60 * scale)})">
                <circle cx="0" cy="0" r="${Math.round(20 * scale)}" fill="#262626" stroke="#404040" stroke-width="3"/>
                <circle cx="0" cy="0" r="${Math.round(8 * scale)}" fill="#ff0055"/>
            </g>
        </g>

        <!-- Bloque inferior izquierdo: Usuario, botón seguir, caption y audio -->
        <g transform="translate(${Math.round(25 * scale)}, ${height - Math.round(120 * scale)})" font-family="'Segoe UI', Roboto, sans-serif">
            <!-- Avatar circular con la inicial del nombre -->
            <circle cx="${Math.round(18 * scale)}" cy="${Math.round(18 * scale)}" r="${Math.round(18 * scale)}" fill="#e11d48"/>
            <text x="${Math.round(18 * scale)}" y="${Math.round(24 * scale)}" font-size="${Math.round(16 * scale)}" font-weight="bold" fill="#ffffff" text-anchor="middle">${displayName.charAt(0).toUpperCase()}</text>

            <!-- Nombre de usuario / handle -->
            <text x="${Math.round(48 * scale)}" y="${Math.round(24 * scale)}" font-size="${Math.round(17 * scale)}" font-weight="bold" fill="#ffffff">${escapeXml(handle)}</text>

            <!-- Botón Seguir -->
            <rect x="${Math.round(55 * scale + handle.length * 10 * scale)}" y="${Math.round(6 * scale)}" width="${Math.round(75 * scale)}" height="${Math.round(26 * scale)}" rx="${Math.round(6 * scale)}" fill="none" stroke="#ffffff" stroke-width="1.5"/>
            <text x="${Math.round(92 * scale + handle.length * 10 * scale)}" y="${Math.round(23 * scale)}" font-size="${Math.round(12 * scale)}" font-weight="bold" fill="#ffffff" text-anchor="middle">Seguir</text>

            <!-- Descripción / Caption -->
            <text x="0" y="${Math.round(55 * scale)}" font-size="${Math.round(15 * scale)}" fill="#f8fafc">${escapeXml(cleanCaption)}</text>

            <!-- Título de pista musical -->
            <text x="0" y="${Math.round(82 * scale)}" font-size="${Math.round(13 * scale)}" fill="#cbd5e1">♫ Sonido original - ${escapeXml(handle)}</text>
        </g>
    </svg>`;
}

module.exports = {
    name: 'fagsocial',
    alias: ['fakesocial', 'reelsui', 'tiktokui', 'socialmockup', 'reelsmockup'],
    category: 'tools',
    desc: 'Coloca tu foto con la interfaz y overlay completo de Instagram Reels o TikTok FYP con el nombre de usuario de la persona',
    usage: '.fagsocial [usuario] | <caption> (respondiendo a una foto o enviando una foto)',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const fullText = (args || []).join(' ').trim();
        const quoted = m.quoted;

        // Comprobar si hay una imagen citada o en el mensaje actual
        const isImage = Boolean(
            (quoted && (quoted.type === 'imageMessage' || quoted.mtype === 'imageMessage' || quoted.message?.imageMessage)) ||
            (m.type === 'imageMessage' || m.message?.imageMessage)
        );

        if (!isImage) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 📱 OVERLAY SOCIAL (REELS / TIKTOK) 》 ❐',
                    '┃',
                    '┃├◆ 📋 *¿Para qué sirve?*',
                    '┃  Pone cualquier foto con la interfaz completa de',
                    '┃  Instagram Reels o TikTok FYP usando el nombre de la persona.',
                    '┃',
                    '┃├◆ 📌 *Modo de uso:*',
                    '┃  Responde a una foto con:',
                    '┃  • `.fagsocial @usuario | <caption>`',
                    '┃  • `.fagsocial <usuario> | <caption>`',
                    '┃  • `.fagsocial <caption>` (usa tu propio nombre)',
                    '┃',
                    '┃├◆ 💡 *Ejemplos:*',
                    '┃  • `.fagsocial @carlos | Día soleado en la playa 🏖️`',
                    '┃  • `.fagsocial sofia | Mi outfit favorito de hoy ✨`',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        let rawUser = '';
        let caption = 'Increíble momento ✨ #fyp #viral #reels';

        if (fullText.includes('|')) {
            const sep = fullText.indexOf('|');
            rawUser = fullText.slice(0, sep).trim();
            caption = fullText.slice(sep + 1).trim() || caption;
        } else if (fullText) {
            // Si no usó '|', el texto se toma como caption y el usuario es el remitente
            caption = fullText.trim();
        }

        try {
            await m.react?.('⏳');

            // Resolver nombre y handle de la persona sin IDs numéricos
            const { displayName, handle } = resolvePersonInfo(rawUser, m);

            let buffer = null;
            const target = quoted || m;

            if (typeof target.download === 'function') {
                try { buffer = await target.download(); } catch (_) {}
            }

            if (!buffer && target.message?.imageMessage) {
                buffer = await downloadMediaMessage(
                    { message: target.message, key: target.key || m.key },
                    'buffer',
                    {},
                    { logger, reuploadRequest: sock.updateMediaMessage }
                );
            }

            if (!buffer || buffer.length === 0) {
                return await sock.sendMessage(jid, {
                    text: '❌ No se pudo descargar la imagen para colocar el overlay social.'
                }, { quoted: m });
            }

            const targetWidth = 720;
            const targetHeight = 1280;

            const baseResized = await sharp(buffer)
                .resize(targetWidth, targetHeight, {
                    fit: 'cover',
                    position: 'center'
                })
                .toBuffer();

            const overlaySvg = createSocialOverlaySvg(targetWidth, targetHeight, displayName, handle, caption);
            const overlayBuffer = Buffer.from(overlaySvg);

            const compositeBuffer = await sharp(baseResized)
                .composite([{
                    input: overlayBuffer,
                    top: 0,
                    left: 0
                }])
                .jpeg({ quality: 92 })
                .toBuffer();

            await m.react?.('📱');
            await sock.sendMessage(jid, {
                image: compositeBuffer,
                caption: `📱 *Mockup de Reels de ${displayName} (${handle})*\n\n_Unknown Codexツ</>_`
            }, { quoted: m });

        } catch (err) {
            logger.error('[FAGSOCIAL ERROR]:', err.message);
            await sock.sendMessage(jid, {
                text: `❌ Error al generar mockup social: ${err.message}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};

module.exports.resolvePersonInfo = resolvePersonInfo;
