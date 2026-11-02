'use strict';

const sharp = require('../../lib/sharp');
const logger = require('../../lib/logger');
const userNames = require('../../lib/userNames');

function escapeXml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Genera una tarjeta visual que simula la interfaz y revela la broma de "Ver una vez"
 */
async function generateTrollViewOnceImage(customText = '', authorName = '') {
    const mainJoke = customText.trim() || '¡La curiosidad mató al gato! Pensaste que era una foto secreta 🤣';
    const safeJoke = escapeXml(mainJoke.slice(0, 90));
    const safeAuthor = escapeXml(authorName.slice(0, 30));

    const svg = `
<svg width="720" height="720" viewBox="0 0 720 720" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B141A"/>
      <stop offset="50%" stop-color="#111B21"/>
      <stop offset="100%" stop-color="#0A1014"/>
    </linearGradient>
    <linearGradient id="card" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#202C33"/>
      <stop offset="100%" stop-color="#182229"/>
    </linearGradient>
  </defs>

  <rect width="720" height="720" fill="url(#bg)"/>

  <!-- Tarjeta central estilo WhatsApp Dark -->
  <rect x="45" y="60" width="630" height="600" rx="24" fill="url(#card)" stroke="#00A884" stroke-width="3" stroke-dasharray="12 6"/>

  <!-- Círculo punteado característico de View Once -->
  <circle cx="360" cy="200" r="65" fill="none" stroke="#00A884" stroke-width="6" stroke-dasharray="14 8"/>
  <text x="360" y="218" font-family="Arial, sans-serif" font-size="50" font-weight="bold" fill="#00A884" text-anchor="middle">1</text>

  <!-- Encabezado de la broma -->
  <text x="360" y="315" font-family="Arial, sans-serif" font-size="34" font-weight="bold" fill="#E9EDEF" text-anchor="middle">¡CAÍSTE EN LA TRAMPA! 🤡</text>
  <text x="360" y="360" font-family="Arial, sans-serif" font-size="20" fill="#8696A0" text-anchor="middle">Mensaje de visualización única simulado</text>

  <!-- Caja del texto personalizado / remate -->
  <rect x="85" y="405" width="550" height="135" rx="16" fill="#111B21" stroke="#2A3942" stroke-width="1.5"/>
  <text x="360" y="475" font-family="Arial, sans-serif" font-size="22" font-style="italic" fill="#25D366" text-anchor="middle">"${safeJoke}"</text>
  ${safeAuthor ? `<text x="360" y="515" font-family="Arial, sans-serif" font-size="16" fill="#8696A0" text-anchor="middle">Enviado por: @${safeAuthor}</text>` : ''}

  <!-- Footer -->
  <text x="360" y="615" font-family="Arial, sans-serif" font-size="16" fill="#667781" text-anchor="middle">Unknown Codexツ&lt;/&gt; • Fake View Once Prank</text>
</svg>
`;

    return await sharp(Buffer.from(svg))
        .png({ quality: 90 })
        .toBuffer();
}

module.exports = {
    name: 'fakevv',
    alias: ['fakeviewonce', 'vvfake', 'fakevo', 'verunavezfake', 'trollvv'],
    category: 'herramientas',
    desc: 'Envía una foto o video como mensaje de "Ver una vez" (View Once) real o genera una broma de Ver Una Vez si no citas nada',
    usage: '.fakevv (respondiendo a foto/video) | .fakevv [texto de la broma]',

    execute: async ({ sock, m, args = [] }) => {
        const jid = m.chat || m.key.remoteJid;
        const quoted = m.quoted;

        // Resolver nombre y número del usuario
        const senderNum = (m.sender || m.key?.participant || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        const rawUser = (m.pushName || '').trim() || userNames.get(m.sender) || userNames.get(m.key?.participant) || '';
        const authorName = rawUser || (senderNum ? `+${senderNum}` : 'Usuario');

        const customCaption = args.join(' ').trim();

        // ── CASO 1: El usuario cita una foto o un video para convertirlo en Ver Una Vez real ──
        const isQuotedImage = Boolean(
            quoted && (
                quoted.type === 'imageMessage' ||
                quoted.mtype === 'imageMessage' ||
                quoted.message?.imageMessage ||
                (quoted.mimetype && quoted.mimetype.startsWith('image/'))
            )
        );

        const isQuotedVideo = Boolean(
            quoted && (
                quoted.type === 'videoMessage' ||
                quoted.mtype === 'videoMessage' ||
                quoted.message?.videoMessage ||
                (quoted.mimetype && quoted.mimetype.startsWith('video/'))
            )
        );

        if (isQuotedImage || isQuotedVideo) {
            await m.react?.('⏳');

            let buffer = null;
            try {
                if (typeof quoted.download === 'function') {
                    buffer = await quoted.download();
                }
                if (!buffer && (quoted.message?.imageMessage || quoted.message?.videoMessage)) {
                    const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                    buffer = await downloadMediaMessage(
                        { message: quoted.message, key: quoted.key || m.key },
                        'buffer',
                        {},
                        { logger, reuploadRequest: sock.updateMediaMessage }
                    );
                }
            } catch (dlErr) {
                logger.error('[FAKEVV DOWNLOAD ERROR]:', dlErr.message);
            }

            if (!buffer || buffer.length === 0) {
                await m.react?.('❌');
                return await sock.sendMessage(jid, {
                    text: '❌ No se pudo descargar la imagen o video citado para enviarlo como Ver Una Vez.\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            try {
                if (isQuotedImage) {
                    await sock.sendMessage(jid, {
                        image: buffer,
                        caption: customCaption || undefined,
                        viewOnce: true
                    }, { quoted: m });
                } else {
                    await sock.sendMessage(jid, {
                        video: buffer,
                        caption: customCaption || undefined,
                        viewOnce: true
                    }, { quoted: m });
                }

                await m.react?.('👁️');
                return;
            } catch (sendErr) {
                logger.error('[FAKEVV SEND MEDIA ERROR]:', sendErr.message);
                await m.react?.('❌');
                return await sock.sendMessage(jid, {
                    text: `❌ Error al enviar el medio como Ver Una Vez: ${sendErr.message}\n\n_Unknown Codexツ</>_`
                }, { quoted: m });
            }
        }

        // ── CASO 2: Modo Broma / Troll View Once (genera imagen troll simulada que desaparece al abrir) ──
        await m.react?.('👁️');

        try {
            const trollImage = await generateTrollViewOnceImage(customCaption, authorName);

            await sock.sendMessage(jid, {
                image: trollImage,
                caption: undefined,
                viewOnce: true
            }, { quoted: m });

        } catch (err) {
            logger.error('[FAKEVV TROLL ERROR]:', err.message);
            await sock.sendMessage(jid, {
                text: `❌ Error al generar la broma de Ver Una Vez: ${err.message}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};

