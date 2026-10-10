const axios = require('axios');
const { savefrom } = require('../../lib/savefrom');

module.exports = {
    name: 'facebook',
    alias: ['fb', 'fbdl', 'fbvideo', 'facebookdl'],
    category: 'descargas',
    desc: 'Descarga videos de Facebook en calidad HD/SD con bajo consumo de RAM',
    usage: '.fb [enlace de video de Facebook o fb.watch]',
    execute: async ({ sock, m, text }) => {
        if (!text) {
            return await m.reply('❌ Por favor, proporciona el enlace del video de Facebook.\nEjemplo: *.fb https://www.facebook.com/watch/?v=...*');
        }

        const match = text.match(/https?:\/\/(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.watch)\/[^\s]+/i);
        if (!match) {
            return await m.reply('❌ Enlace no válido. Asegúrate de incluir un link público de Facebook o fb.watch.');
        }

        const fbUrl = match[0];
        await m.react('⏳');

        try {
            let downloadUrl = null;
            let title = 'Facebook Video';
            let isHd = false;

            // 1. Endpoint Primario: API de Dorratz (v2/fb-dl)
            try {
                const dorratzRes = await axios.get(`https://api.dorratz.com/v2/fb-dl?url=${encodeURIComponent(fbUrl)}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 8000
                });

                const dData = dorratzRes.data?.data || dorratzRes.data?.result || dorratzRes.data;
                if (dData) {
                    if (dData.hd || dData.video_hd || dData.HD) {
                        downloadUrl = dData.hd || dData.video_hd || dData.HD;
                        isHd = true;
                    } else if (dData.sd || dData.video_sd || dData.SD) {
                        downloadUrl = dData.sd || dData.video_sd || dData.SD;
                    } else if (Array.isArray(dData.urls)) {
                        const hdObj = dData.urls.find(item => /hd|720|1080/i.test(item.quality || item.resolution || ''));
                        const sdObj = dData.urls.find(item => /sd|360|480/i.test(item.quality || item.resolution || ''));
                        if (hdObj?.url) {
                            downloadUrl = hdObj.url;
                            isHd = true;
                        } else if (sdObj?.url) {
                            downloadUrl = sdObj.url;
                        }
                    }
                    if (dData.title) title = dData.title;
                }
            } catch (dorratzErr) {
                // Fallback a endpoints de medios públicos
            }

            // 2. Endpoint Secundario: Agregador de alto rendimiento Siputzx (DL SnapCDN)
            if (!downloadUrl) {
                try {
                    const sipuRes = await axios.get(`https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(fbUrl)}`, {
                        timeout: 10000
                    });

                    const dls = sipuRes.data?.data?.downloads;
                    if (Array.isArray(dls) && dls.length > 0) {
                        // Priorizar HD sobre SD
                        const hd = dls.find(item => /hd|720/i.test(item.quality || ''));
                        const sd = dls.find(item => /sd|360/i.test(item.quality || ''));
                        const selected = hd || sd || dls[0];

                        if (selected?.url) {
                            downloadUrl = selected.url;
                            isHd = !!hd;
                            if (sipuRes.data.data.title) title = sipuRes.data.data.title;
                        }
                    }
                } catch (sipuErr) {
                    // Continuar a fallback
                }
            }

            // 3. Fallback Terciario: SaveFrom Engine
            if (!downloadUrl) {
                try {
                    const sfRes = await savefrom(fbUrl, 10000);
                    if (sfRes && sfRes[0]?.url) {
                        const formats = sfRes[0].url;
                        const hdItem = formats.find(u => u.ext === 'mp4' && /hd|720|1080/i.test(u.quality || u.subname || ''));
                        const sdItem = formats.find(u => u.ext === 'mp4' && /sd|360|480/i.test(u.quality || u.subname || ''));
                        const anyMp4 = formats.find(u => u.ext === 'mp4' && u.url);

                        if (hdItem?.url) {
                            downloadUrl = hdItem.url;
                            isHd = true;
                        } else if (sdItem?.url) {
                            downloadUrl = sdItem.url;
                        } else if (anyMp4?.url) {
                            downloadUrl = anyMp4.url;
                        }
                        if (sfRes[0].meta?.title) title = sfRes[0].meta.title;
                    }
                } catch (sfErr) {}
            }

            // 4. Fallback Cuaternario: Cobalt API
            if (!downloadUrl) {
                const cobaltInstances = [
                    'https://co.wuk.sh',
                    'https://api.cobalt.tools',
                    'https://cobalt-api.kwiatekm.tokyo'
                ];

                for (const inst of cobaltInstances) {
                    try {
                        const cRes = await axios.post(inst, {
                            url: fbUrl,
                            videoQuality: '720',
                            downloadMode: 'auto'
                        }, {
                            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                            timeout: 8000
                        });
                        if (cRes.data?.url) {
                            downloadUrl = cRes.data.url;
                            isHd = true;
                            break;
                        }
                    } catch (e) {}
                }
            }

            if (!downloadUrl) {
                throw new Error('No se pudo obtener el video de Facebook');
            }

            const caption = `🎬 *Unsk1ngMD - Facebook Video*\n\n` +
                `📌 *Título:* ${title}\n` +
                `✨ *Calidad:* ${isHd ? 'Alta Definición (HD) 🟢' : 'Estándar (SD) 🟡'}\n` +
                `🔗 ${fbUrl}`;

            // Optimización de Memoria RAM: Enviar URL directa
            try {
                await sock.sendMessage(m.chat, {
                    video: { url: downloadUrl },
                    caption: caption,
                    mimetype: 'video/mp4'
                }, { quoted: m });
            } catch (sendErr) {
                // Fallback con buffer controlado
                const videoRes = await axios.get(downloadUrl, {
                    responseType: 'arraybuffer',
                    timeout: 45000,
                    maxContentLength: 50 * 1024 * 1024
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
            await m.reply('❌ No se pudo descargar el video de Facebook en este momento. Verifica que el enlace sea público y accesible.');
        }
    }
};
