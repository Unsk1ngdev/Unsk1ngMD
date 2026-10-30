'use strict';

const axios = require('axios');
const { imageToSticker } = require('../../lib/media');
const config = require('../../config');
const logger = require('../../lib/logger');

module.exports = {
    name: 'emojimix',
    alias: ['mixemoji', 'emix', 'combinaremoji'],
    category: 'multimedia',
    desc: 'Mezcla dos emojis usando Google Emoji Kitchen y devuelve un sticker exclusivo',
    usage: '.emojimix 🔥+💀  o  .emojimix 🔥 💀',

    execute: async ({ sock, m, text }) => {
        const jid = m.chat;

        // 1. Extraer los emojis del texto del usuario
        const emojis = (text || '').match(/\p{Extended_Pictographic}/gu) || [];

        if (emojis.length < 2) {
            return await sock.sendMessage(jid, {
                text: [
                    '✨ *EMOJIMIX — GOOGLE EMOJI KITCHEN* ✨',
                    '',
                    '❌ *Debes ingresar al menos 2 emojis para combinarlos.*',
                    '',
                    '📌 *Ejemplos de uso:*',
                    '• *.emojimix 🔥+💀*',
                    '• *.emojimix 🤠 👽*',
                    '• *.emojimix 🐱🤖*',
                    '• *.emojimix 🥺+✨*',
                    '',
                    '_Prueba combinando emojis clásicos y caras populares._'
                ].join('\n')
            }, { quoted: m });
        }

        const emoji1 = emojis[0];
        const emoji2 = emojis[1];

        await m.react?.('⏳');

        // 2. Endpoints de Google Emoji Kitchen (con orden directo y orden inverso como fallback)
        const endpoints = [
            `https://emojik.vercel.app/s/${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}?size=512`,
            `https://emojik.vercel.app/s/${encodeURIComponent(emoji2)}_${encodeURIComponent(emoji1)}?size=512`,
            `https://emk.vercel.app/s/${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}?size=512`,
            `https://emk.vercel.app/s/${encodeURIComponent(emoji2)}_${encodeURIComponent(emoji1)}?size=512`
        ];

        let imageBuffer = null;

        for (const url of endpoints) {
            try {
                const response = await axios.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 8000
                });

                if (response.status === 200 && response.data && response.data.length > 50) {
                    imageBuffer = Buffer.from(response.data);
                    break;
                }
            } catch (_) {
                // Siguiente fallback
            }
        }

        if (!imageBuffer) {
            await m.react?.('❌');
            return await sock.sendMessage(jid, {
                text: `❌ Google Emoji Kitchen no tiene una combinación para *${emoji1} + ${emoji2}* todavía.\n\n💡 _Intenta con otros emojis (ej: 🔥, 💀, 🤠, 🐱, 👽, 🤖, 🥺, 👻, 💩, 🤡)._`
            }, { quoted: m });
        }

        try {
            // 3. Convertir a Sticker transparente WebP con metadatos
            const packname = config.packName || 'Unsk1ngMD';
            const author = `${emoji1} + ${emoji2}`;
            const stickerBuffer = await imageToSticker(imageBuffer, { packname, author });

            await sock.sendMessage(jid, {
                sticker: stickerBuffer
            }, { quoted: m });

            await m.react?.('✅');
        } catch (err) {
            logger.error(`[EMOJIMIX] Error generando sticker: ${err.message}`);
            // Fallback a imagen PNG si la conversión a sticker fallara
            await sock.sendMessage(jid, {
                image: imageBuffer,
                caption: `✨ *EmojiMix:* ${emoji1} + ${emoji2}`
            }, { quoted: m });
            await m.react?.('✅');
        }
    }
};
