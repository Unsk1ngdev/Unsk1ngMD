'use strict';

const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');
const nsfwManager = require('../../lib/nsfw');
const ffmpeg = require('../../lib/ffmpeg');
const config = require('../../config');

module.exports = {
    name: 'dark',
    alias: ['nsfwdark', 'darkhentai', 'hardcore'],
    category: 'multimedia',
    desc: 'Envía contenido anime +18 explícito y oscuro (BDSM, anal, cum, blowjob) en modo imagen o GIF',
    usage: '.dark',

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
            text: '😈 Buscando contenido dark +18...'
        }, { quoted: m });

        const isGifTurn = Math.random() < 0.5;

        // Tags verificados con abundante contenido en boorus
        const darkImageTags = ['bondage', 'anal', 'cum', 'creampie', 'tentacles', 'shibari'];
        const nekoCategories = ['hanal', 'tentacle', 'paizuri', 'anal', 'blowjob', 'hentai', 'hass'];

        const apis = [
            // Fuente 1: GIF animado explícito vía Nekobot / Purrbot
            async () => {
                let url = null;
                try {
                    const res = await axios.get('https://nekobot.xyz/api/image?type=pgif', {
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                        timeout: 4500
                    });
                    url = res.data?.message;
                    if (url) url = url.replace('i0.nekobot.xyz', 'cdn.nekobot.xyz');
                } catch (_) {}

                if (!url) {
                    const darkGifCategories = ['anal', 'cum', 'blowjob', 'fuck'];
                    const cat = darkGifCategories[Math.floor(Math.random() * darkGifCategories.length)];
                    const resMeta = await axios.get(`https://purrbot.site/api/img/nsfw/${cat}/gif`, {
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                        timeout: 4000
                    });
                    url = resMeta.data?.link;
                }

                if (!url) throw new Error('Sin URL gif');

                const resMedia = await axios.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 10000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                const rawBuffer = Buffer.from(resMedia.data);
                if (!rawBuffer || rawBuffer.length < 500) throw new Error('Buffer vacío');

                let finalBuffer = null;
                const isAlreadyMp4 = rawBuffer.length > 8 && rawBuffer.slice(4, 8).toString() === 'ftyp';

                if (isAlreadyMp4) {
                    finalBuffer = rawBuffer;
                } else if (ffmpeg.isFfmpegAvailable()) {
                    const tempDir = config.tempDir && fs.existsSync(config.tempDir) ? config.tempDir : process.cwd();
                    const tmpId = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
                    const tmpIn = path.join(tempDir, `tmp_dark_in_${tmpId}.gif`);
                    const tmpOut = path.join(tempDir, `tmp_dark_out_${tmpId}.mp4`);
                    try {
                        fs.writeFileSync(tmpIn, rawBuffer);
                        await ffmpeg.convertGifToMp4(tmpIn, tmpOut);
                        if (fs.existsSync(tmpOut) && fs.statSync(tmpOut).size > 100) {
                            const converted = fs.readFileSync(tmpOut);
                            if (converted.length > 8 && converted.slice(4, 8).toString() === 'ftyp') {
                                finalBuffer = converted;
                            }
                        }
                    } catch (_) {
                    } finally {
                        try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch (_) {}
                        try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (_) {}
                    }
                }

                if (finalBuffer) {
                    return { type: 'gif', buffer: finalBuffer };
                }
                // Si la conversión a video no fue posible, devolver como imagen estática para no fallar
                return { type: 'image_buffer', buffer: rawBuffer };
            },

            // Fuente 2: Imágenes intensas y oscuras vía Yande.re (tags garantizados)
            async () => {
                const tag = darkImageTags[Math.floor(Math.random() * darkImageTags.length)];
                const page = Math.floor(Math.random() * 3) + 1;
                let res = await axios.get(`https://yande.re/post.json?tags=rating:explicit+${tag}&limit=20&page=${page}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                    timeout: 5000
                });
                let items = Array.isArray(res.data)
                    ? res.data.filter(p => (p.sample_url || p.jpeg_url || p.file_url) && !p.file_url?.endsWith('.zip'))
                    : [];

                if (items.length === 0) {
                    // Fallback a posts explícitos generales
                    res = await axios.get(`https://yande.re/post.json?tags=rating:explicit&limit=20&page=${page}`, {
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                        timeout: 5000
                    });
                    items = Array.isArray(res.data)
                        ? res.data.filter(p => (p.sample_url || p.jpeg_url || p.file_url) && !p.file_url?.endsWith('.zip'))
                        : [];
                }

                if (items.length === 0) throw new Error('Sin posts en yande.re');
                const picked = items[Math.floor(Math.random() * items.length)];
                const url = picked.sample_url || picked.jpeg_url || picked.file_url;
                if (!url) throw new Error('Sin URL yande.re');

                return { type: 'image', url };
            },

            // Fuente 3: Nekobot categorías explícitas (Alta velocidad)
            async () => {
                const cat = nekoCategories[Math.floor(Math.random() * nekoCategories.length)];
                const res = await axios.get(`https://nekobot.xyz/api/image?type=${cat}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 4500
                });
                let url = res.data?.message;
                if (!url) throw new Error('Sin URL nekobot dark');
                url = url.replace('i0.nekobot.xyz', 'cdn.nekobot.xyz');
                return { type: 'image', url };
            }
        ];

        // Ordenar según isGifTurn para dar variedad
        const prioritizedApis = isGifTurn ? apis : [apis[1], apis[2], apis[0]];

        let enviado = false;

        for (const api of prioritizedApis) {
            if (enviado) break;
            try {
                const item = await api();
                if (item.type === 'gif' && item.buffer) {
                    await sock.sendMessage(jid, {
                        video: item.buffer,
                        caption: '😈 _Unknown Codexツ</> Dark +18_',
                        gifPlayback: true,
                        mimetype: 'video/mp4'
                    }, { quoted: m });
                    enviado = true;
                    break;
                } else if (item.type === 'image' && item.url) {
                    await sock.sendMessage(jid, {
                        image: { url: item.url },
                        caption: '😈 _Unknown Codexツ</> Dark +18_'
                    }, { quoted: m });
                    enviado = true;
                    break;
                } else if (item.type === 'image_buffer' && item.buffer) {
                    await sock.sendMessage(jid, {
                        image: item.buffer,
                        caption: '😈 _Unknown Codexツ</> Dark +18_',
                        mimetype: 'image/gif'
                    }, { quoted: m });
                    enviado = true;
                    break;
                }
            } catch (err) {
                console.error('[DARK] Falló intento:', err.message);
                continue;
            }
        }

        if (!enviado) {
            await sock.sendMessage(jid, {
                text: '❌ Error al obtener contenido dark +18.\nInténtalo de nuevo en unos segundos.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }
    }
};

