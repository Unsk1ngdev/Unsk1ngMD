'use strict';

const axios = require('axios');
const nsfwManager = require('../../lib/nsfw');

module.exports = {
    name: 'gifnsfw',
    alias: ['nsfwgif', 'hentaigif', 'gifporn'],
    category: 'multimedia',
    desc: 'Envía un GIF / video animado explícito +18 aleatorio en grupos con NSFW activo',
    usage: '.gifnsfw',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;

        // 1. Verificar NSFW activado en el grupo
        if (jid.endsWith('@g.us')) {
            if (!nsfwManager.isNsfwEnabled(jid)) {
                return await sock.sendMessage(jid, {
                    text: '🔞 Activa NSFW primero con *.nsfw on*\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }
        }

        // Reacción discreta
        await m.react('🔞').catch(() => {});

        let gifUrl = null;

        // 1. Intento principal con Rule34 filtrado a videos/GIFs explícitos
        try {
            const pid = Math.floor(Math.random() * 400);
            const res = await axios.get(
                `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=25&pid=${pid}&tags=explicit+animated`,
                {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                    timeout: 7000
                }
            );
            const json = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;

            if (Array.isArray(json) && json.length > 0) {
                const soloGifs = json.filter(p =>
                    p.file_url && (
                        p.file_url.includes('.gif') ||
                        p.file_url.includes('.mp4') ||
                        p.file_url.includes('.webm')
                    )
                );

                if (soloGifs.length > 0) {
                    const post = soloGifs[Math.floor(Math.random() * soloGifs.length)];
                    gifUrl = post.file_url;
                }
            }
        } catch (_) {}

        // 2. Fallback a Gelbooru filtrado por animated
        if (!gifUrl) {
            try {
                const pid = Math.floor(Math.random() * 200);
                const res = await axios.get(
                    `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&tags=explicit+animated&limit=20&pid=${pid}`,
                    {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                        timeout: 7000
                    }
                );
                const json = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
                const posts = json?.post;

                if (Array.isArray(posts) && posts.length > 0) {
                    const soloGifs = posts.filter(p =>
                        p.file_url && (
                            p.file_url.includes('.gif') ||
                            p.file_url.includes('.mp4') ||
                            p.file_url.includes('.webm')
                        )
                    );
                    if (soloGifs.length > 0) {
                        const post = soloGifs[Math.floor(Math.random() * soloGifs.length)];
                        gifUrl = post.file_url;
                    }
                }
            } catch (_) {}
        }

        // 3. Fallback alternativo rápido a endpoints de waifu.pics NSFW GIF
        if (!gifUrl) {
            const fallbackEndpoints = [
                'https://api.waifu.pics/nsfw/blowjob',
                'https://api.waifu.pics/nsfw/anal',
                'https://api.waifu.pics/nsfw/waifu'
            ];
            for (const ep of fallbackEndpoints) {
                try {
                    const res = await axios.get(ep, { timeout: 4000 });
                    if (res.data?.url) {
                        gifUrl = res.data.url;
                        break;
                    }
                } catch (_) {}
            }
        }

        if (!gifUrl) {
            return await sock.sendMessage(jid, {
                text: '❌ Error al obtener GIF +18.\nIntenta de nuevo en unos segundos.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        await sock.sendMessage(jid, {
            video: { url: gifUrl },
            caption: '🔞 _Unknown Codexツ</> +18 GIF_',
            gifPlayback: true
        }, { quoted: m });
    }
};
