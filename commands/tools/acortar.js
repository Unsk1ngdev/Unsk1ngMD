'use strict';

const axios = require('axios');

module.exports = {
    name: 'acortar',
    alias: ['shorturl', 'tinyurl', 'cuttly'],
    category: 'herramientas',
    desc: 'Acorta una URL larga usando servicios gratuitos TinyURL e Is.gd (público)',
    usage: '.acortar [url]',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const url = args[0] ? args[0].trim() : '';

        if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
            return await sock.sendMessage(jid, {
                text: '❌ Uso: *.acortar [url]*\nEjemplo: *.acortar https://www.google.com*'
            }, { quoted: m });
        }

        await sock.sendMessage(jid, {
            text: '🔗 Acortando link...'
        }, { quoted: m });

        let linkCorto = null;

        // 1. Intentar con TinyURL
        try {
            const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, {
                timeout: 10000
            });
            if (typeof res.data === 'string' && (res.data.startsWith('http://') || res.data.startsWith('https://'))) {
                linkCorto = res.data.trim();
            }
        } catch (_) {}

        // 2. Fallback a is.gd
        if (!linkCorto) {
            try {
                const res = await axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`, {
                    timeout: 10000
                });
                if (typeof res.data === 'string' && (res.data.startsWith('http://') || res.data.startsWith('https://'))) {
                    linkCorto = res.data.trim();
                }
            } catch (_) {}
        }

        if (!linkCorto) {
            return await sock.sendMessage(jid, {
                text: '❌ Error al acortar el link.\nVerifica que la URL sea válida y accesible.'
            }, { quoted: m });
        }

        await sock.sendMessage(jid, {
            text: `🔗 *Link acortado*\n\n` +
                  `📎 *Original:*\n${url}\n\n` +
                  `✅ *Acortado:*\n${linkCorto}\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

