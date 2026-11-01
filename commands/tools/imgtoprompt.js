'use strict';

const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const logger = require('../../lib/logger');

/**
 * Sube una imagen a un host público temporal para que los modelos de visión la procesen
 */
async function uploadImageToPublicUrl(buffer) {
    // 1. Intento con ImgBB si existe la clave en .env
    const imgbbKey = (process.env.IMGBB_KEY || '').replace(/['"]/g, '').trim();
    if (imgbbKey) {
        try {
            const form = new FormData();
            form.append('key', imgbbKey);
            form.append('image', buffer, { filename: `img_${Date.now()}.jpg`, contentType: 'image/jpeg' });
            form.append('expiration', '600'); // 10 minutos es suficiente para procesar

            const res = await axios.post('https://api.imgbb.com/1/upload', form, {
                headers: form.getHeaders(),
                timeout: 20000
            });
            if (res.data?.data?.url) {
                return res.data.data.url;
            }
        } catch (_) {}
    }

    // 2. Fallback a Catbox (libre, sin registro)
    try {
        const formCat = new FormData();
        formCat.append('reqtype', 'fileupload');
        formCat.append('fileToUpload', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' });

        const resCat = await axios.post('https://catbox.moe/user/api.php', formCat, {
            headers: formCat.getHeaders(),
            timeout: 20000
        });
        if (typeof resCat.data === 'string' && resCat.data.startsWith('http')) {
            return resCat.data.trim();
        }
    } catch (_) {}

    // 3. Fallback a tmpfiles.org
    try {
        const formTmp = new FormData();
        formTmp.append('file', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' });

        const resTmp = await axios.post('https://tmpfiles.org/api/v1/upload', formTmp, {
            headers: formTmp.getHeaders(),
            timeout: 20000
        });
        const tmpUrl = resTmp.data?.data?.url;
        if (tmpUrl) {
            return tmpUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        }
    } catch (_) {}

    return null;
}

module.exports = {
    name: 'imgtoprompt',
    alias: ['imagetoprompt', 'promptai', 'describeimg', 'reverseprompt', 'img2prompt'],
    category: 'ia',
    desc: 'Analiza una imagen y genera el prompt de IA profesional que la describiría (Midjourney / Stable Diffusion)',
    usage: '.imgtoprompt (respondiendo a una imagen o enviando una foto)',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;

        // 1. Detectar si hay una imagen en el mensaje o citada
        const quoted = m.quoted;
        let isImage = false;
        let targetMsg = null;
        let targetKey = null;

        if (quoted) {
            const qMime = quoted.mimetype || quoted.message?.imageMessage?.mimetype || '';
            if (
                quoted.type === 'imageMessage' ||
                qMime.startsWith('image/') ||
                !!quoted.message?.imageMessage ||
                (quoted.type === 'viewOnceMessage' && !!quoted.message?.imageMessage)
            ) {
                isImage = true;
                targetMsg = quoted.message?.imageMessage ? { imageMessage: quoted.message.imageMessage } : quoted.message;
                targetKey = quoted.key || m.key;
            }
        } else if (
            m.type === 'imageMessage' ||
            (m.mimetype || '').startsWith('image/') ||
            !!m.message?.imageMessage
        ) {
            isImage = true;
            targetMsg = m.message?.imageMessage ? { imageMessage: m.message.imageMessage } : m.message;
            targetKey = m.key;
        }

        if (!isImage) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🎨 IMAGE TO PROMPT (PROMPT INVERSO) 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* Responde a una imagen con `.imgtoprompt`',
                    '┃├◆ 💡 *Función:* Genera un prompt hiperdetallado en inglés',
                    '┃  y español optimizado para Midjourney, Flux, SDXL y DALL-E.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        await m.react?.('⏳');
        await sock.sendMessage(jid, {
            text: '👁️ *Analizando imagen con visión artificial para generar el prompt...*'
        }, { quoted: m });

        try {
            // 2. Descargar el buffer de la imagen
            let buffer = null;
            if (quoted && typeof quoted.download === 'function') {
                try { buffer = await quoted.download(); } catch (_) {}
            }
            if (!buffer && typeof m.download === 'function') {
                try { buffer = await m.download(); } catch (_) {}
            }
            if (!buffer && targetMsg) {
                buffer = await downloadMediaMessage(
                    { message: targetMsg, key: targetKey },
                    'buffer',
                    {},
                    { logger, reuploadRequest: sock.updateMediaMessage }
                );
            }

            if (!buffer || buffer.length === 0) {
                await m.react?.('❌');
                return await sock.sendMessage(jid, {
                    text: '❌ No se pudo descargar la imagen desde WhatsApp.'
                }, { quoted: m });
            }

            // 3. Subir imagen para obtener URL pública
            const publicUrl = await uploadImageToPublicUrl(buffer);
            if (!publicUrl) {
                await m.react?.('❌');
                return await sock.sendMessage(jid, {
                    text: '❌ Error temporal al alojar la imagen para su análisis por IA.'
                }, { quoted: m });
            }

            // 4. Consultar modelo de visión IA solicitando explícitamente el prompt en español
            const promptQuery = encodeURIComponent(
                `Analiza esta imagen con precisión y proporciona OBLIGATORIAMENTE EN ESPAÑOL: 1) Un prompt hiperdetallado y profesional en español para generadores de imágenes por IA (Midjourney, DALL-E 3, Stable Diffusion, Flux). Describe detalladamente: sujeto principal, iluminación, ángulo de cámara, estilo visual, paleta de colores y detalles de textura. 2) Una versión en inglés del prompt para motores que requieran inglés. Formato: Presenta claramente primero el prompt en español y luego la traducción al inglés. URL de la imagen: ${publicUrl}`
            );

            const aiRes = await axios.get(`https://text.pollinations.ai/${promptQuery}`, {
                timeout: 35000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            const promptText = (aiRes.data || '').toString().trim();
            if (!promptText || promptText.length < 20) {
                throw new Error('Respuesta vacía o insuficiente del modelo de visión.');
            }

            await m.react?.('✅');

            const msg = [
                '┏❐ 《 🎨 REVERSE IMAGE PROMPT (IA) 》 ❐',
                '┃',
                '┃├◆ 🖼️ *Imagen analizada exitosamente*',
                '┃',
                '┃├◆ 📝 *PROMPT GENERADO (Listo para copiar):*',
                `\`\`\`\n${promptText}\n\`\`\``,
                '┃',
                '┃├◆ ⚙️ *Parámetros recomendados:*',
                '┃  • Midjourney: `--v 6.1 --style raw --ar 16:9`',
                '┃  • Stable Diffusion / Flux: `CFG Scale: 7, Steps: 30`',
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n');

            return await sock.sendMessage(jid, { text: msg }, { quoted: m });

        } catch (err) {
            logger.error('[IMGTOPROMPT ERROR]:', err.message);
            await m.react?.('❌');
            return await sock.sendMessage(jid, {
                text: `❌ Ocurrió un error al procesar la imagen: ${err.message}`
            }, { quoted: m });
        }
    }
};

