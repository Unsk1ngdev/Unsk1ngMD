'use strict';

const axios = require('axios');
const logger = require('../../lib/logger');

/**
 * Obtiene captura web utilizando múltiples proveedores de respaldo
 */
async function fetchScreenshotBuffer(targetUrl) {
    const providers = [
        // Proveedor 1: Microlink
        {
            name: 'Microlink',
            url: `https://api.microlink.io?url=${encodeURIComponent(targetUrl)}&screenshot=true&meta=false&embed=screenshot.url`,
            timeout: 25000
        },
        // Proveedor 2: Thum.io (Rápido, alta fidelidad)
        {
            name: 'Thum.io',
            url: `https://image.thum.io/get/width/1280/crop/800/noanimate/${targetUrl}`,
            timeout: 20000
        },
        // Proveedor 3: S-Shot CDN
        {
            name: 'S-Shot',
            url: `https://mini.s-shot.ru/1280x800/PNG/1280/Z100/?${encodeURIComponent(targetUrl)}`,
            timeout: 20000
        }
    ];

    let lastError = null;
    for (const provider of providers) {
        try {
            const res = await axios.get(provider.url, {
                responseType: 'arraybuffer',
                timeout: provider.timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/png,image/*,*/*;q=0.8'
                }
            });

            if (res.data && res.data.length > 1000) {
                return {
                    buffer: Buffer.from(res.data),
                    provider: provider.name
                };
            }
        } catch (err) {
            lastError = err;
            logger.warn(`[SCREENSHOT] Falló proveedor ${provider.name}: ${err.message}`);
        }
    }

    throw lastError || new Error('No se pudo generar la captura web con ningún proveedor.');
}

module.exports = {
    name: 'ssweb',
    alias: ['screenshot', 'ss', 'capture', 'captura', 'webshot'],
    category: 'multimedia',
    desc: 'Captura de pantalla en alta resolución de cualquier página web pública con servidores de respaldo',
    usage: '.ssweb [https://url-del-sitio.com]',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        const rawInput = (args && args[0] ? args[0] : (text || m.quoted?.body || '')).trim();

        // 1. Validación de entrada
        if (!rawInput) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 📸 CAPTURA DE PANTALLA WEB (SSWEB) 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* `.ssweb <url>`',
                    '┃├◆ 📌 *Ejemplo 1:* `.ssweb https://github.com`',
                    '┃├◆ 📌 *Ejemplo 2:* `.ssweb google.com`',
                    '┃',
                    '┃├◆ 🌐 Renderiza la página web completa y te envía',
                    '┃  una captura de pantalla nítida al instante.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // 2. Normalización de protocolo HTTP/HTTPS
        let targetUrl = rawInput;
        if (!/^https?:\/\//i.test(targetUrl)) {
            targetUrl = 'https://' + targetUrl;
        }

        // Validar formato de URL
        let parsedUrl = null;
        try {
            parsedUrl = new URL(targetUrl);
        } catch (_) {
            return await sock.sendMessage(jid, {
                text: '❌ La URL proporcionada no tiene un formato válido (ej: https://google.com).'
            }, { quoted: m });
        }

        await m.react?.('⏳');
        await sock.sendMessage(jid, {
            text: `📸 *Tomando captura de pantalla...*\nRenderizando \`${parsedUrl.hostname}\`...`
        }, { quoted: m });

        try {
            const { buffer, provider } = await fetchScreenshotBuffer(targetUrl);

            await sock.sendMessage(jid, {
                image: buffer,
                caption: [
                    '┏❐ 《 📸 CAPTURA DE PANTALLA WEB 》 ❐',
                    '┃',
                    `┃├◆ 🔗 *URL:* ${targetUrl}`,
                    `┃├◆ 🌐 *Servidor:* ${provider} Engine`,
                    `┃├◆ 📐 *Resolución:* 1280x800 HD`,
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });

            await m.react?.('✅');

        } catch (err) {
            logger.error('[SCREENSHOT ERROR]:', err.message);
            await m.react?.('❌');

            let errorDesc = err.message || 'Error desconocido';
            if (err.code === 'ECONNABORTED' || errorDesc.includes('timeout')) {
                errorDesc = 'El sitio web tardó demasiado en responder al renderizado (tiempo límite agotado).';
            } else if (err.response?.status === 400 || err.response?.status === 422) {
                errorDesc = 'La URL indicada no pudo ser resuelta o no es accesible públicamente.';
            }

            await sock.sendMessage(jid, {
                text: `❌ No se pudo capturar la página web (${targetUrl}):\n${errorDesc}`
            }, { quoted: m });
        }
    }
};
