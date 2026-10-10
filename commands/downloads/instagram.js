const axios = require('axios');
const { savefrom } = require('../../lib/savefrom');

module.exports = {
    name: 'instagram',
    alias: ['ig', 'reels', 'reel', 'igdl'],
    category: 'descargas',
    desc: 'Descarga Reels y videos públicos de Instagram sin marca de agua',
    usage: '.ig [enlace de Reel / publicación de Instagram]',
    execute: async ({ sock, m, text }) => {
        if (!text) {
            return await m.reply('❌ Por favor, proporciona el enlace del Reel o video de Instagram.\nEjemplo: *.ig https://www.instagram.com/reel/...*');
        }

        const match = text.match(/https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|reels|tv)\/([a-zA-Z0-9_-]+)/i);
        if (!match) {
            return await m.reply('❌ Enlace no válido. Asegúrate de incluir un link público de Reel o post de Instagram.');
        }

        const igUrl = match[0];
        await m.react('⏳');

        try {
            let downloadUrl = null;

            // 1. Intentar con SaveFrom
            try {
                const sfRes = await savefrom(igUrl, 12000);
                if (sfRes && sfRes[0]?.url) {
                    const videoItem = sfRes[0].url.find(u => u.ext === 'mp4') || sfRes[0].url[0];
                    if (videoItem?.url) {
                        downloadUrl = videoItem.url;
                    }
                }
            } catch (sfErr) {
                // Continuar a fallback
            }

            // 2. Intentar con agregadores de medios
            if (!downloadUrl) {
                const aggregators = [
                    `https://api.siputzx.my.id/api/d/igdl?url=${encodeURIComponent(igUrl)}`,
                    `https://deliriussapi-oficial.vercel.app/download/instagram?url=${encodeURIComponent(igUrl)}`,
                    `https://api.vreden.my.id/api/igdownload?url=${encodeURIComponent(igUrl)}`
                ];

                for (const apiUrl of aggregators) {
                    try {
                        const res = await axios.get(apiUrl, { timeout: 10000 });
                        const dl = res.data?.data?.[0]?.url || res.data?.result?.[0]?.url || res.data?.url || res.data?.data?.video;
                        if (dl) {
                            downloadUrl = dl;
                            break;
                        }
                    } catch (e) {}
                }
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
                            url: igUrl,
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
                throw new Error('No se pudo extraer el video de Instagram.');
            }

            const caption = `📸 *Instagram Reel / Video:*\n🔗 ${igUrl}`;

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
