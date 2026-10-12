'use strict';

const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');
const nsfwManager = require('../../lib/nsfw');
const ffmpeg = require('../../lib/ffmpeg');

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

        // Categorías intensas
        const darkGifCategories = ['anal', 'cum', 'blowjob', 'fuck'];
        const darkImageTags = ['bondage', 'bdsm', 'anal', 'cum', 'ahegao'];

        const apis = [
            // Fuente 1: GIF animado explícito vía purrbot
            async () => {
                const cat = darkGifCategories[Math.floor(Math.random() * darkGifCategories.length)];
                const resMeta = await axios.get(`https://purrbot.site/api/img/nsfw/${cat}/gif`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 6000
                });
                const url = resMeta.data?.link;
                if (!url) throw new Error('Sin URL purrbot');

                const resMedia = await axios.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 15000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                const rawBuffer = Buffer.from(resMedia.data);
                let finalBuffer = rawBuffer;

                if (ffmpeg.isFfmpegAvailable()) {
                    const tmpId = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
                    const tmpIn = path.join(process.cwd(), `tmp_dark_in_${tmpId}.gif`);
                    const tmpOut = path.join(process.cwd(), `tmp_dark_out_${tmpId}.mp4`);
                    try {
                        fs.writeFileSync(tmpIn, rawBuffer);
                        await ffmpeg.convertGifToMp4(tmpIn, tmpOut);
                        if (fs.existsSync(tmpOut) && fs.statSync(tmpOut).size > 0) {
                            finalBuffer = fs.readFileSync(tmpOut);
                        }
                    } catch (_) {
                    } finally {
                        try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch (_) {}
                        try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (_) {}
                    }
                }

                return { type: 'gif', buffer: finalBuffer };
            },

            // Fuente 2: Imágenes intensas y oscuras vía yande.re
            async () => {
                const tag = darkImageTags[Math.floor(Math.random() * darkImageTags.length)];
                const page = Math.floor(Math.random() * 20) + 1;
                const res = await axios.get(`https://yande.re/post.json?tags=rating:explicit+${tag}&limit=20&page=${page}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                    timeout: 7000
                });
                const items = Array.isArray(res.data)
                    ? res.data.filter(p => (p.sample_url || p.jpeg_url || p.file_url) && !p.file_url?.endsWith('.zip'))
                    : [];
                if (items.length === 0) throw new Error('Sin posts en yande.re');
                const picked = items[Math.floor(Math.random() * items.length)];
                const url = picked.sample_url || picked.jpeg_url || picked.file_url;
                if (!url) throw new Error('Sin URL yande.re');

                return { type: 'image', url };
            },

            // Fuente 3: Nekosia / waifu.im
            async () => {
                const res = await axios.get('https://nekosia.cat/api/v1/images/nsfw', {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 6000
                });
                const url = res.data?.image?.original?.url || res.data?.url;
                if (!url) throw new Error('Sin URL nekosia');
                const isGif = url.toLowerCase().endsWith('.gif');
                return { type: isGif ? 'gif_url' : 'image', url };
            }
        ];

        // Ordenar según isGifTurn
        const prioritizedApis = isGifTurn ? apis : [apis[1], apis[0], apis[2]];

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
                } else if (item.type === 'gif_url' && item.url) {
                    await sock.sendMessage(jid, {
                        video: { url: item.url },
                        caption: '😈 _Unknown Codexツ</> Dark +18_',
                        gifPlayback: true
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

