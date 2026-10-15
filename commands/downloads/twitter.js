'use strict';

const axios = require('axios');

module.exports = {
    name: 'twitter',
    alias: ['x', 'tw', 'xdl', 'twitterdl'],
    category: 'descargas',
    desc: 'Descarga videos de X / Twitter en formato MP4 de alta velocidad',
    usage: '.x [enlace de X / Twitter]',
    execute: async ({ sock, m, text }) => {
        if (!text) {
            return await m.reply('❌ Por favor, proporciona el enlace del tweet o post de X.\nEjemplo: *.x https://x.com/user/status/...*');
        }

        const match = text.match(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/(?:[a-zA-Z0-9_]+|i)\/status\/(\d+)/i);
        if (!match) {
            return await m.reply('❌ Enlace no válido. Asegúrate de incluir un link directo a un tweet/post de X o Twitter.');
        }

        const statusId = match[1];
        const tweetUrl = match[0];
        await m.react('⏳');

        try {
            // Cabecera bot que evita bloqueos y retos Cloudflare en proxies de X
            const botHeaders = {
                'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
                'Accept': 'application/json'
            };

            const endpoints = [
                `https://api.fxtwitter.com/2/status/${statusId}`,
                `https://api.fixupx.com/2/status/${statusId}`,
                `https://api.fixvx.com/Twitter/status/${statusId}`,
                `https://api.vxtwitter.com/Twitter/status/${statusId}`
            ];

            // Resolución ultra rápida en paralelo con carrera
            const fetchers = endpoints.map(async (url) => {
                const res = await axios.get(url, { headers: botHeaders, timeout: 4500 });
                const data = res.data;
                if (!data) throw new Error('Sin datos');

                let videoUrl = null;
                let title = 'Video de X / Twitter';

                // 1. FxTwitter v2
                if (data.status?.media?.videos?.length > 0) {
                    const videoObj = data.status.media.videos[0];
                    if (Array.isArray(videoObj.formats) && videoObj.formats.length > 0) {
                        const mp4s = videoObj.formats
                            .filter(f => f.container === 'mp4' && f.url)
                            .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
                        // Seleccionar la mejor calidad disponible pero balanceada (<= 1.5 Mbps si hay varias)
                        const optimal = mp4s.find(f => (f.bitrate || 0) <= 1500000) || mp4s[0];
                        videoUrl = optimal?.url || videoObj.url;
                    } else {
                        videoUrl = videoObj.url;
                    }
                    title = data.status.text || title;
                }
                // 2. FxTwitter v1
                else if (data.tweet?.media?.videos?.length > 0) {
                    videoUrl = data.tweet.media.videos[0].url;
                    title = data.tweet.text || title;
                }
                // 3. VxTwitter
                else if (data.media_extended?.length > 0) {
                    const vid = data.media_extended.find(item => item.type === 'video' || item.type === 'gif');
                    if (vid?.url) {
                        videoUrl = vid.url;
                        title = data.text || title;
                    }
                }

                if (!videoUrl) throw new Error('No se encontró video');
                return { videoUrl, title };
            });

            let resolved = null;
            try {
                resolved = await Promise.any(fetchers);
            } catch (anyErr) {
                // Si todos fallan o el tweet no tiene video
                throw new Error('El post no contiene videos reproducibles o es privado.');
            }

            if (!resolved || !resolved.videoUrl) {
                throw new Error('No se pudo extraer el video de X/Twitter.');
            }

            const cleanTitle = (resolved.title || 'Video de X / Twitter').trim().slice(0, 150);
            const caption = `🎬 *Video de X (Twitter):*\n*${cleanTitle}*\n🔗 ${tweetUrl}`;

            // Descarga de buffer con timeout controlado de 20s
            let videoBuffer = null;
            try {
                const vidRes = await axios.get(resolved.videoUrl, {
                    responseType: 'arraybuffer',
                    timeout: 20000,
                    maxContentLength: 50 * 1024 * 1024,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                videoBuffer = Buffer.from(vidRes.data);
            } catch (dlErr) {
                console.error('[TWITTER DL] Descarga de buffer falló, probando envío por URL directa:', dlErr.message);
            }

            if (videoBuffer && videoBuffer.length > 500) {
                await sock.sendMessage(m.chat, {
                    video: videoBuffer,
                    caption: caption,
                    mimetype: 'video/mp4'
                }, { quoted: m });
            } else {
                // Fallback enviando enlace directo
                await sock.sendMessage(m.chat, {
                    video: { url: resolved.videoUrl },
                    caption: caption,
                    mimetype: 'video/mp4'
                }, { quoted: m });
            }

            await m.react('✅');

        } catch (err) {
            console.error('[TWITTER DL] Error:', err.message);
            await m.react('❌');
            const msg = err.message && err.message.includes('privado')
                ? `❌ ${err.message}`
                : '❌ No se pudo descargar el contenido en este momento. Verifica que el enlace sea público.';
            await m.reply(msg);
        }
    }
};
