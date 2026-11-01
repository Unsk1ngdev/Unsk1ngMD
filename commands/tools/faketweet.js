'use strict';

const sharp = require('sharp');
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
 * Envuelve texto en múltiples líneas de ancho fijo para SVG
 */
function wrapText(text, maxCharsPerLine = 48) {
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (const w of words) {
        if ((currentLine + ' ' + w).trim().length <= maxCharsPerLine) {
            currentLine = (currentLine + ' ' + w).trim();
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = w;
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines.slice(0, 10);
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
            // Es un nombre personalizado explícito (ej: "Elon Musk", "cristiano", "Carlos")
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

    // 5. Fallback final limpio (nunca mostrar IDs numéricos o JIDs)
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
 * Genera la imagen del tweet falso en formato PNG
 */
async function generateFakeTweetBuffer(displayName, handle, text, avatarBuffer = null) {
    const lines = wrapText(text, 50);
    const cardWidth = 720;
    const tweetTextHeight = lines.length * 28;
    const cardHeight = Math.max(340, 220 + tweetTextHeight);

    // Preparar avatar si el usuario citó una imagen
    let avatarBase64 = null;
    if (avatarBuffer) {
        try {
            const circularAvatar = await sharp(avatarBuffer)
                .resize(60, 60, { fit: 'cover' })
                .composite([{
                    input: Buffer.from('<svg width="60" height="60"><circle cx="30" cy="30" r="30" fill="#000"/></svg>'),
                    blend: 'dest-in'
                }])
                .png()
                .toBuffer();
            avatarBase64 = `data:image/png;base64,${circularAvatar.toString('base64')}`;
        } catch (_) {}
    }

    const textLinesSvg = lines.map((l, idx) => {
        const y = 120 + idx * 28;
        return `<text x="35" y="${y}" font-family="'Segoe UI', -apple-system, sans-serif" font-size="19" fill="#e7e9ea">${escapeXml(l)}</text>`;
    }).join('');

    const dateY = 135 + lines.length * 28;
    const lineY = dateY + 20;
    const statsY = lineY + 30;

    // Calcular posición de la insignia de verificado
    const nameWidthApprox = Math.min(360, displayName.length * 11);
    const badgeX = 110 + nameWidthApprox;

    const svg = `
    <svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <clipPath id="avatarClip">
                <circle cx="65" cy="55" r="28"/>
            </clipPath>
        </defs>

        <!-- Fondo del tweet (Tema oscuro X / Twitter) -->
        <rect width="${cardWidth}" height="${cardHeight}" rx="16" fill="#000000"/>
        <rect x="2" y="2" width="${cardWidth - 4}" height="${cardHeight - 4}" rx="15" fill="none" stroke="#2f3336" stroke-width="1.5"/>

        <!-- Avatar de perfil -->
        ${avatarBase64 ? `
            <image href="${avatarBase64}" x="37" y="27" width="56" height="56" clip-path="url(#avatarClip)"/>
        ` : `
            <circle cx="65" cy="55" r="28" fill="#1d9bf0"/>
            <text x="65" y="63" font-family="'Segoe UI', sans-serif" font-size="24" font-weight="bold" fill="#ffffff" text-anchor="middle">${displayName.charAt(0).toUpperCase()}</text>
        `}

        <!-- Nombre visible y verificación -->
        <text x="105" y="48" font-family="'Segoe UI', sans-serif" font-size="18" font-weight="bold" fill="#f7f9f9">${escapeXml(displayName)}</text>
        <!-- Insignia azul de verificado -->
        <circle cx="${badgeX}" cy="42" r="8" fill="#1d9bf0"/>
        <path d="M${badgeX - 4} 42 L${badgeX - 1} 45 L${badgeX + 4} 39" stroke="#ffffff" stroke-width="2" fill="none"/>

        <!-- Handle @usuario -->
        <text x="105" y="70" font-family="'Segoe UI', sans-serif" font-size="15" fill="#71767b">${escapeXml(handle)}</text>

        <!-- Logo de X a la derecha -->
        <text x="${cardWidth - 45}" y="52" font-family="'Segoe UI', sans-serif" font-size="22" font-weight="900" fill="#e7e9ea">𝕏</text>

        <!-- Texto del tweet -->
        ${textLinesSvg}

        <!-- Fecha, hora y reproducciones -->
        <text x="35" y="${dateY}" font-family="'Segoe UI', sans-serif" font-size="14" fill="#71767b">10:42 PM · 1 nov. 2026 · <tspan fill="#e7e9ea" font-weight="bold">1.8M</tspan> Reproducciones</text>

        <!-- Línea divisoria -->
        <line x1="35" y1="${lineY}" x2="${cardWidth - 35}" y2="${lineY}" stroke="#2f3336" stroke-width="1"/>

        <!-- Métricas del tweet (Retweets, Citas, Me gusta, Guardados) -->
        <g font-family="'Segoe UI', sans-serif" font-size="14" fill="#71767b">
            <text x="50" y="${statsY}">💬 <tspan fill="#e7e9ea" font-weight="bold">2,410</tspan></text>
            <text x="190" y="${statsY}">🔁 <tspan fill="#e7e9ea" font-weight="bold">14.2K</tspan></text>
            <text x="340" y="${statsY}">❤️ <tspan fill="#e7e9ea" font-weight="bold">89.5K</tspan></text>
            <text x="490" y="${statsY}">🔖 <tspan fill="#e7e9ea" font-weight="bold">4,120</tspan></text>
            <text x="640" y="${statsY}">📤</text>
        </g>
    </svg>`;

    return await sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = {
    name: 'faketweet',
    alias: ['tweetfalso', 'falsotweet', 'fakex', 'mocktweet'],
    category: 'tools',
    desc: 'Genera una captura de pantalla realista e idéntica a un tweet de X (Twitter) con el nombre de usuario de la persona',
    usage: '.faketweet [usuario] | <texto> (o responde a una foto para usarla como foto de perfil)',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const fullText = (args || []).join(' ').trim();

        let rawUser = '';
        let tweetText = '';

        if (fullText.includes('|')) {
            const separatorIdx = fullText.indexOf('|');
            rawUser = fullText.slice(0, separatorIdx).trim();
            tweetText = fullText.slice(separatorIdx + 1).trim();
        } else if (fullText) {
            tweetText = fullText.trim();
        }

        if (!tweetText) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🐦 GENERADOR DE FAKE TWEET (X) 》 ❐',
                    '┃',
                    '┃├◆ 📋 *¿Para qué sirve?*',
                    '┃  Crea una imagen idéntica a una captura de pantalla',
                    '┃  de un tweet real de X con el nombre de la persona.',
                    '┃',
                    '┃├◆ 📌 *Formatos:*',
                    '┃  • `.faketweet @usuario | <texto del tweet>`',
                    '┃  • `.faketweet Elon Musk | <texto del tweet>`',
                    '┃  • `.faketweet <texto>` (usa tu propio nombre)',
                    '┃',
                    '┃├◆ 💡 *Ejemplos:*',
                    '┃  • `.faketweet @amigo | Mañana nos vemos`',
                    '┃  • `.faketweet elonmusk | Mañana compramos WhatsApp`',
                    '┃',
                    '┃├◆ 🖼️ *Tip:* Si citas una foto, se usará como foto de perfil.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        try {
            await m.react?.('⏳');

            // Resolver información de la persona (nombre y handle limpios)
            const { displayName, handle } = resolvePersonInfo(rawUser, m);

            // Comprobar si el usuario citó una imagen para usar de avatar
            let avatarBuffer = null;
            if (m.quoted) {
                const qMsg = m.quoted.message || {};
                const isImage = Boolean(qMsg.imageMessage || m.quoted.type === 'imageMessage' || m.quoted.mtype === 'imageMessage');
                if (isImage) {
                    if (typeof m.quoted.download === 'function') {
                        try { avatarBuffer = await m.quoted.download(); } catch (_) {}
                    }
                    if (!avatarBuffer) {
                        const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                        avatarBuffer = await downloadMediaMessage(
                            { message: qMsg, key: m.quoted.key || m.key },
                            'buffer',
                            {},
                            { logger, reuploadRequest: sock.updateMediaMessage }
                        );
                    }
                }
            }

            const tweetBuffer = await generateFakeTweetBuffer(displayName, handle, tweetText, avatarBuffer);

            await m.react?.('🐦');
            await sock.sendMessage(jid, {
                image: tweetBuffer,
                caption: `🐦 *Tweet de ${displayName} (${handle})*\n\n_Unknown Codexツ</>_`
            }, { quoted: m });

        } catch (err) {
            logger.error('[FAKETWEET ERROR]:', err.message);
            await sock.sendMessage(jid, {
                text: `❌ Error al generar tweet falso: ${err.message}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};

module.exports.resolvePersonInfo = resolvePersonInfo;
