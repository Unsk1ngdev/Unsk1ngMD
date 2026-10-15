'use strict';

const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');
const nsfwManager = require('../../lib/nsfw');
const ffmpeg = require('../../lib/ffmpeg');
const config = require('../../config');
const { videoToSticker } = require('../../lib/media');

module.exports = {
    name: 'gifnsfw',
    alias: ['nsfwgif', 'hentaigif', 'gifhentai', 'anigensfw'],
    category: 'multimedia',
    desc: 'Envía un GIF animado explícito de anime y hentai +18 en grupos con NSFW activo',
    usage: '.gifnsfw',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;

        if (jid.endsWith('@g.us')) {
            if (!nsfwManager.isNsfwEnabled(jid)) {
                return await sock.sendMessage(jid, {
                    text: '🔞 Activa NSFW primero con *.nsfw on*\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }
        }

        await sock.sendMessage(jid, {
            text: '🎬 Buscando GIF anime +18...'
        }, { quoted: m });

        // Endpoints dedicados exclusivamente a GIFs de Anime / Hentai +18
        const animeEndpoints = [
            'blowjob', 'anal', 'cum', 'fuck',
            'pussylick', 'solo', 'threesome_fff', 'threesome_ffm'
        ].sort(() => Math.random() - 0.5);

        const gifProviders = [
            // Intento 1: Categoría anime hentai aleatoria de Purrbot
            async () => {
                const ep = animeEndpoints[0];
                const res = await axios.get(`https://purrbot.site/api/img/nsfw/${ep}/gif`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                    timeout: 4500
                });
                const url = res.data?.link;
                if (!url) throw new Error('Sin URL en purrbot 1');
                return url;
            },
            // Intento 2: Segunda categoría anime hentai alternativa
            async () => {
                const ep = animeEndpoints[1] || animeEndpoints[0];
                const res = await axios.get(`https://purrbot.site/api/img/nsfw/${ep}/gif`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                    timeout: 4500
                });
                const url = res.data?.link;
                if (!url) throw new Error('Sin URL en purrbot 2');
                return url;
            },
            // Intento 3: Tercera categoría anime hentai alternativa
            async () => {
                const ep = animeEndpoints[2] || 'fuck';
                const res = await axios.get(`https://purrbot.site/api/img/nsfw/${ep}/gif`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                    timeout: 4500
                });
                const url = res.data?.link;
                if (!url) throw new Error('Sin URL en purrbot 3');
                return url;
            }
        ];

        let enviado = false;

        for (const getUrl of gifProviders) {
            if (enviado) break;

            try {
                const url = await getUrl();
                if (!url) continue;

                // Descargar el GIF anime con timeout de 8s
                const resMedia = await axios.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 8000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                const rawBuffer = Buffer.from(resMedia.data);
                if (!rawBuffer || rawBuffer.length < 500) continue;

                // Si es excesivamente pesado (> 15MB), omitir
                if (rawBuffer.length > 15 * 1024 * 1024) continue;

                let finalVideoBuffer = null;
                const isAlreadyMp4 = rawBuffer.length > 8 && rawBuffer.slice(4, 8).toString() === 'ftyp';

                if (isAlreadyMp4) {
                    finalVideoBuffer = rawBuffer;
                } else if (ffmpeg.isFfmpegAvailable()) {
                    const tempDir = config.tempDir && fs.existsSync(config.tempDir) ? config.tempDir : process.cwd();
                    const tmpId = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
                    const tmpIn = path.join(tempDir, `tmp_gif_in_${tmpId}.gif`);
                    const tmpOut = path.join(tempDir, `tmp_gif_out_${tmpId}.mp4`);

                    try {
                        fs.writeFileSync(tmpIn, rawBuffer);
                        await ffmpeg.convertGifToMp4(tmpIn, tmpOut);
                        if (fs.existsSync(tmpOut) && fs.statSync(tmpOut).size > 100) {
                            const converted = fs.readFileSync(tmpOut);
                            if (converted.length > 8 && converted.slice(4, 8).toString() === 'ftyp') {
                                finalVideoBuffer = converted;
                            }
                        }
                    } catch (convErr) {
                        console.error('[GIFNSFW] Conversión a MP4 falló:', convErr.message);
                    } finally {
                        try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch (_) {}
                        try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (_) {}
                    }
                }

                // Enviar como MP4 nativo con reproducción continua (GIF WhatsApp)
                if (finalVideoBuffer) {
                    await sock.sendMessage(jid, {
                        video: finalVideoBuffer,
                        caption: '🎬 _Unknown Codexツ</> +18 Anime GIF_',
                        gifPlayback: true,
                        mimetype: 'video/mp4'
                    }, { quoted: m });
                    enviado = true;
                    break;
                }

                // Fallback a sticker animado
                try {
                    const stickerBuffer = await videoToSticker(rawBuffer, {
                        packname: config.packName || 'Unsk1ngMD',
                        author: 'Unknown Codexツ</>'
                    });
                    if (stickerBuffer && stickerBuffer.length > 0) {
                        await sock.sendMessage(jid, {
                            sticker: stickerBuffer
                        }, { quoted: m });
                        enviado = true;
                        break;
                    }
                } catch (stkErr) {
                    console.error('[GIFNSFW] Fallback a sticker falló:', stkErr.message);
                }

                // Fallback a imagen GIF
                await sock.sendMessage(jid, {
                    image: rawBuffer,
                    caption: '🎬 _Unknown Codexツ</> +18 Anime GIF_',
                    mimetype: 'image/gif'
                }, { quoted: m });
                enviado = true;
                break;

            } catch (e) {
                console.error('[GIFNSFW] Intento falló:', e.message);
                continue;
            }
        }

        if (!enviado) {
            await sock.sendMessage(jid, {
                text: '❌ Error al obtener GIF anime +18.\nIntenta de nuevo en unos segundos.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }
    }
};
