const axios = require('axios');
const logger = require('../../lib/logger');

module.exports = {
    name: 'screenshot',
    alias: ['ss', 'capture', 'captura'],
    category: 'multimedia',
    desc: 'Captura de pantalla de cualquier página web pública usando la API de Microlink (sin Chromium/Puppeteer)',
    usage: '.screenshot [https://url-del-sitio.com]',
    execute: async ({ sock, m, text }) => {
        const jid = m.chat;
        const rawInput = text?.trim() || m.quoted?.body?.trim();

        // 1. Validación de entrada
        if (!rawInput) {
            return await sock.sendMessage(jid, {
                text: '❌ Debes proporcionar una URL válida.\nEjemplo: *.screenshot https://github.com*'
            }, { quoted: m });
        }

        // 2. Normalización de protocolo HTTP/HTTPS
        let targetUrl = rawInput;
        if (!/^https?:\/\//i.test(targetUrl)) {
            targetUrl = 'https://' + targetUrl;
        }

        // Validar formato de URL
        try {
            new URL(targetUrl);
        } catch (_) {
            return await sock.sendMessage(jid, {
                text: '❌ La URL proporcionada no tiene un formato válido. Asegúrate de escribir un dominio correcto (ej: https://google.com).'
            }, { quoted: m });
        }

        await m.react('⏳');

        try {
            // 3. Consulta HTTP directa con axios a la API de Microlink
            const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(targetUrl)}&screenshot=true&meta=false&embed=screenshot.url`;

            const response = await axios.get(apiUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                }
            });

            if (!response.data || response.data.length === 0) {
                throw new Error('La API devolvió un buffer de imagen vacío.');
            }

            const imageBuffer = Buffer.from(response.data);

            // 4. Enviar imagen capturada mediante Baileys
            await sock.sendMessage(jid, {
                image: imageBuffer,
                caption: `📸 *Captura de Pantalla Realizada:*\n🔗 *URL:* ${targetUrl}`
            }, { quoted: m });

            await m.react('✅');

        } catch (err) {
            logger.error('[SCREENSHOT ERROR]:', err.message);
            await m.react('❌');

            let errorDesc = err.message;
            if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
                errorDesc = 'El sitio web tardó demasiado en responder al renderizado (tiempo límite de 30s agotado).';
            } else if (err.response?.status === 400 || err.response?.status === 422) {
                errorDesc = 'La URL indicada no pudo ser resuelta o no es accesible públicamente.';
            }

            await sock.sendMessage(jid, {
                text: `❌ No se pudo capturar la página web (${targetUrl}): ${errorDesc}`
            }, { quoted: m });
        }
    }
};
