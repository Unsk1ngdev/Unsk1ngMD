const axios = require('axios');

module.exports = {
    name: 'twitter',
    alias: ['x', 'tw', 'xdl', 'twitterdl'],
    category: 'descargas',
    desc: 'Descarga videos de X / Twitter en formato MP4 reproducible',
    usage: '.x [enlace de X / Twitter]',
    execute: async ({ sock, m, text }) => {
        if (!text) {
            return await m.reply('❌ Por favor, proporciona el enlace del tweet o post de X.\nEjemplo: *.x https://x.com/user/status/...*');
        }

        const match = text.match(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/i);
        if (!match) {
            return await m.reply('❌ Enlace no válido. Asegúrate de incluir un link directo a un tweet/post de X o Twitter.');
        }

        const username = match[1];
        const statusId = match[2];
        const tweetUrl = match[0];
        await m.react('⏳');

        try {
            let downloadUrl = null;
            let title = 'Video de X / Twitter';

            // 1. Intentar con API abierta de VxTwitter / FxTwitter
            try {
                const vxRes = await axios.get(`https://api.vxtwitter.com/${username}/status/${statusId}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 10000
                });

                if (vxRes.data?.media_extended && vxRes.data.media_extended.length > 0) {
                    const videoItem = vxRes.data.media_extended.find(item => item.type === 'video' || item.type === 'gif');
                    if (videoItem?.url) {
                        downloadUrl = videoItem.url;
                        title = vxRes.data.text?.slice(0, 60) || title;
                    }
                }
            } catch (vxErr) {
                // Continuar a fallback
            }

            // Fallback con FxTwitter
            if (!downloadUrl) {
                try {
                    const fxRes = await axios.get(`https://api.fxtwitter.com/${username}/status/${statusId}`, {
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                        timeout: 10000
                    });

                    const media = fxRes.data?.tweet?.media;
                    if (media?.videos && media.videos.length > 0) {
                        downloadUrl = media.videos[0].url;
                        title = fxRes.data.tweet?.text?.slice(0, 60) || title;
                    }
                } catch (fxErr) {}
            }

            // 2. Intentar con Twitsave scraper
            if (!downloadUrl) {
                try {
                    const twitRes = await axios.get(`https://twitsave.com/info?url=${encodeURIComponent(tweetUrl)}`, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                        timeout: 10000
                    });
                    const html = twitRes.data;
                    const linkMatch = html.match(/href="([^"]+)"[^>]*download/i) || html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/i);
                    if (linkMatch && linkMatch[1]) {
                        downloadUrl = linkMatch[1];
                    }
                } catch (e) {}
            }

            // 3. Fallback con Cobalt
            if (!downloadUrl) {
                const cobaltInstances = [
                    'https://co.wuk.sh',
                    'https://api.cobalt.tools',
                    'https://cobalt-api.kwiatekm.tokyo'
                ];

                for (const inst of cobaltInstances) {
                    try {
                        const res = await axios.post(inst, {
                            url: tweetUrl,
                            downloadMode: 'auto'
                        }, {
                            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                            timeout: 10000
                        });
                        if (res.data?.url) {
                            downloadUrl = res.data.url;
                            break;
                        }
                    } catch (e) {}
                }
            }

            if (!downloadUrl) {
                throw new Error('No se pudo extraer el video de X/Twitter.');
            }

            const caption = `🎬 *Video de X (Twitter):*\n*${title}*\n🔗 ${tweetUrl}`;

            // Optimización de Memoria RAM: Enviar URL directa antes que buffer
            try {
                await sock.sendMessage(m.chat, {
                    video: { url: downloadUrl },
                    caption: caption,
                    mimetype: 'video/mp4'
                }, { quoted: m });
            } catch (sendErr) {
                // Fallback de contingencia con buffer controlado
                const videoRes = await axios.get(downloadUrl, {
                    responseType: 'arraybuffer',
                    timeout: 45000,
                    maxContentLength: 50 * 1024 * 1024 // 50MB
                });

                await sock.sendMessage(m.chat, {
                    video: Buffer.from(videoRes.data),
                    caption: caption,
                    mimetype: 'video/mp4'
                }, { quoted: m });
            }

            await m.react('✅');

        } catch (err) {
            await m.react('❌');
            await m.reply('❌ No se pudo descargar el contenido en este momento. Verifica que el enlace sea público.');
        }
    }
};
