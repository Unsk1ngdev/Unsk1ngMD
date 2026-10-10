const axios = require('axios');

module.exports = {
    name: 'screenshot',
    alias: ['ss', 'capture', 'captura'],
    category: 'multimedia',
    desc: 'Captura rápida de pantalla de una URL pública',
    usage: '.screenshot [https://url-del-sitio.com]',
    execute: async ({ sock, m, text }) => {
        if (!text) {
            return await m.reply('❌ Debes proporcionar una URL válida.\nEjemplo: *.screenshot https://github.com*');
        }

        let url = text.trim();
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }

        await m.react('⏳');

        try {
            // API ligera sin necesidad de levantar Chromium/Puppeteer en memoria RAM
            const apiUrl = `https://image.thum.io/get/width/1280/crop/800/noanimate/${encodeURIComponent(url)}`;
            const response = await axios.get(apiUrl, {
                responseType: 'arraybuffer',
                timeout: 20000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                }
            });

            await sock.sendMessage(m.chat, {
                image: Buffer.from(response.data),
                caption: `📸 *Captura de Pantalla:*\n🔗 ${url}`
            }, { quoted: m });

            await m.react('✅');
        } catch (err) {
            await m.react('❌');
            throw new Error(`No se pudo obtener la captura de la URL (${url}): ${err.message}`);
        }
    }
};

