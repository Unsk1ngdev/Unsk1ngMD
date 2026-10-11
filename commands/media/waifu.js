'use strict';

const axios = require('axios');
const nsfwManager = require('../../lib/nsfw');

module.exports = {
    name: 'waifu',
    alias: ['waifunsfw', 'hentai', 'nsfwpic'],
    category: 'multimedia',
    desc: 'Envía una imagen anime +18 en grupos con NSFW activo',
    usage: '.waifu',

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
            text: '🔞 Buscando imagen +18...'
        }, { quoted: m });

        const apisImagenes = [
            // Fuente 1: yande.re (API abierta de imágenes anime)
            async () => {
                const page = Math.floor(Math.random() * 40) + 1;
                const res = await axios.get(`https://yande.re/post.json?tags=rating:explicit&limit=25&page=${page}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    timeout: 7000
                });
                const items = Array.isArray(res.data) ? res.data.filter(p => (p.sample_url || p.jpeg_url || p.file_url) && !p.file_url?.endsWith('.zip')) : [];
                if (items.length === 0) throw new Error('Sin posts en yande.re');
                const picked = items[Math.floor(Math.random() * items.length)];
                const url = picked.sample_url || picked.jpeg_url || picked.file_url;
                if (!url) throw new Error('Sin URL');
                return url;
            },

            // Fuente 2: nekos.life
            async () => {
                const res = await axios.get('https://nekos.life/api/v2/img/lewd', { timeout: 6000 });
                const url = res.data?.url;
                if (!url) throw new Error('Sin URL nekos.life');
                return url;
            },

            // Fuente 3: waifu.im
            async () => {
                const res = await axios.get('https://api.waifu.im/search/?is_nsfw=true&many=true&gif=false', {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    timeout: 6000
                });
                const images = res.data?.images?.filter(i => !i.url?.toLowerCase().endsWith('.gif'));
                if (!images || images.length === 0) throw new Error('Sin imágenes waifu.im');
                const img = images[Math.floor(Math.random() * images.length)];
                if (!img?.url) throw new Error('URL vacía waifu.im');
                return img.url;
            },

            // Fuente 4: hmtai
            async () => {
                const cats = ['ero', 'oppai', 'uniform', 'ass', 'hentai'];
                const cat = cats[Math.floor(Math.random() * cats.length)];
                const res = await axios.get(`https://hmtai.hatsunia.cfd/v2/nsfw/${cat}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 6000
                });
                const url = res.data?.url;
                if (!url || url.toLowerCase().endsWith('.gif')) throw new Error('Sin URL válida hmtai');
                return url;
            }
        ];

        let enviado = false;

        for (const api of apisImagenes) {
            if (enviado) break;
            try {
                const url = await api();
                if (url.toLowerCase().match(/\.(gif|mp4|webm)$/)) {
                    throw new Error('No es imagen estática');
                }

                await sock.sendMessage(jid, {
                    image: { url },
                    caption: '🔞 _Unknown Codexツ</> +18_'
                }, { quoted: m });

                enviado = true;
            } catch (e) {
                continue;
            }
        }

        if (!enviado) {
            await sock.sendMessage(jid, {
                text: '❌ Error al obtener imagen.\nIntenta de nuevo.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }
    }
};
