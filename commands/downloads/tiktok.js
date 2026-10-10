const axios = require('axios');

module.exports = {
    name: 'tiktok',
    alias: ['tt', 'tik', 'tiktokdl'],
    category: 'descargas',
    desc: 'Descarga videos públicos de TikTok sin marca de agua en alta definición',
    usage: '.tiktok [enlace de tiktok]',
    execute: async ({ sock, m, text }) => {
        if (!text) {
            return await m.reply('❌ Por favor, ingresa el enlace del video de TikTok.\nEjemplo: *.tiktok https://vm.tiktok.com/...*');
        }

        const match = text.match(/https?:\/\/(?:www\.|v[mt]\.|vt\.)?tiktok\.com\/[^\s]+/i);
        if (!match) {
            return await m.reply('❌ El enlace proporcionado no parece ser un enlace válido de TikTok.');
        }

        const targetUrl = match[0];
        await m.react('⏳');

        try {
            let videoUrl = null;
            let title = 'Video de TikTok';
            let author = 'Usuario de TikTok';

            // 1. Intentar con TikWM API
            try {
                const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`;
                const response = await axios.get(apiUrl, { timeout: 15000 });
                const data = response.data?.data;

                if (data && (data.play || data.wmplay)) {
                    videoUrl = data.play || data.wmplay;
                    title = data.title || title;
                    author = data.author?.nickname || author;
                }
            } catch (e) {
                // Continuar a fallback
            }

            // 2. Fallback secundario si TikWM falla
            if (!videoUrl) {
                try {
                    const fallbackUrl = `https://api.vreden.my.id/api/tiktok?url=${encodeURIComponent(targetUrl)}`;
                    const res = await axios.get(fallbackUrl, { timeout: 15000 });
                    const result = res.data?.result;
                    if (result && (result.nowatermark || result.video)) {
                        videoUrl = result.nowatermark || result.video;
                        title = result.desc || title;
                        author = result.author?.nickname || author;
                    }
                } catch (e) {}
            }

            // 3. Fallback terciario con Agatz API
            if (!videoUrl) {
                try {
                    const altRes = await axios.get(`https://api.agatz.xyz/api/tiktok?url=${encodeURIComponent(targetUrl)}`, { timeout: 15000 });
                    if (altRes.data?.data?.video) {
                        videoUrl = altRes.data.data.video;
                        title = altRes.data.data.title || title;
                    }
                } catch (e) {}
            }

            if (!videoUrl) {
                throw new Error('No se pudo extraer el video de TikTok. Comprueba que el video sea público.');
            }

            const caption = `🎵 *TikTok:* ${title}\n👤 *Autor:* ${author}\n✨ *Descargado sin marca de agua.*`;

            // Optimización de Memoria RAM: Enviar URL directa antes que buffer
            try {
                await sock.sendMessage(m.chat, {
                    video: { url: videoUrl },
                    caption: caption,
                    mimetype: 'video/mp4'
                }, { quoted: m });
            } catch (sendErr) {
                // Fallback de contingencia con buffer controlado
                const videoBuffer = await axios.get(videoUrl, {
                    responseType: 'arraybuffer',
                    timeout: 35000,
                    maxContentLength: 50 * 1024 * 1024 // 50MB
                });

                await sock.sendMessage(m.chat, {
                    video: Buffer.from(videoBuffer.data),
                    caption: caption,
                    mimetype: 'video/mp4'
                }, { quoted: m });
            }

            await m.react('✅');
        } catch (err) {
            await m.react('❌');
            await m.reply(`❌ No se pudo descargar el video de TikTok: ${err.message || 'Verifica que sea público'}`);
        }
    }
};
