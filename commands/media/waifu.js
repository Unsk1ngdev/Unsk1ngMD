'use strict';

const axios = require('axios');
const nsfwManager = require('../../lib/nsfw');

module.exports = {
    name: 'waifu',
    alias: ['waifunsfw', 'hentai', 'nsfwpic'],
    category: 'multimedia',
    desc: 'Envía contenido anime explícito +18 real (Rule34, Gelbooru, Nekosia, Nekos.life)',
    usage: '.waifu',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;

        // 1. Verificar NSFW activado en el grupo
        if (jid.endsWith('@g.us')) {
            if (!nsfwManager.isNsfwEnabled(jid)) {
                return await sock.sendMessage(jid, {
                    text: '🔞 El modo NSFW no está activado en este grupo.\n\n' +
                          'Un admin debe usar *.nsfw on* primero.\n\n' +
                          '_Unknown Codexツ</>_'
                }, { quoted: m });
            }
        }

        // Reacción discreta sin enviar mensajes de texto intermedios
        await m.react('🔞').catch(() => {});

        const randPid = () => Math.floor(Math.random() * 800);

        const tagsExplicitos = [
            'explicit',
            'explicit+animated',
            'explicit+gif',
            'nsfw+explicit',
            'hentai+explicit'
        ];
        const tagRandom = tagsExplicitos[Math.floor(Math.random() * tagsExplicitos.length)];

        // APIs +18 reales en orden de prioridad
        const apis = [
            // 1. Rule34 — contenido explícito real
            async () => {
                const pid = randPid();
                const res = await axios.get(
                    `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=10&pid=${pid}&tags=${tagRandom}`,
                    {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                        timeout: 7000
                    }
                );
                const json = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
                if (!Array.isArray(json) || json.length === 0) throw new Error('Sin resultados Rule34');
                const post = json[Math.floor(Math.random() * json.length)];
                if (!post?.file_url) throw new Error('Post sin file_url');
                return {
                    url: post.file_url,
                    esGif: post.file_url?.includes('.gif') || post.file_url?.includes('.mp4') || post.tags?.includes('animated')
                };
            },

            // 2. Gelbooru — contenido explícito
            async () => {
                const pid = randPid();
                const res = await axios.get(
                    `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&tags=explicit&limit=10&pid=${pid}`,
                    {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                        timeout: 7000
                    }
                );
                const json = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
                const posts = json?.post;
                if (!Array.isArray(posts) || posts.length === 0) throw new Error('Sin resultados Gelbooru');
                const post = posts[Math.floor(Math.random() * posts.length)];
                if (!post?.file_url) throw new Error('Post sin file_url');
                return {
                    url: post.file_url,
                    esGif: post.file_url?.includes('.gif') || post.file_url?.includes('.mp4')
                };
            },

            // 3. Nekosia — contenido nsfw
            async () => {
                const res = await axios.get('https://nekosia.cat/api/v1/images/nsfw', { timeout: 6000 });
                const json = res.data;
                const url = json?.image?.original?.url || json?.url;
                if (!url) throw new Error('Sin URL Nekosia');
                return {
                    url,
                    esGif: url?.includes('.gif') || url?.includes('.mp4')
                };
            },

            // 4. Nekos.life lewd — fallback hiper rápido y seguro
            async () => {
                const res = await axios.get('https://nekos.life/api/v2/img/lewd', { timeout: 5000 });
                const url = res.data?.url;
                if (!url) throw new Error('Sin URL Nekos.life');
                return {
                    url,
                    esGif: url?.includes('.gif')
                };
            }
        ];

        let enviado = false;

        for (const api of apis) {
            if (enviado) break;

            try {
                const { url, esGif } = await api();
                if (!url) throw new Error('URL vacía');

                const isAnimated = esGif || url.endsWith('.gif') || url.endsWith('.mp4') || url.endsWith('.webm');

                if (isAnimated) {
                    await sock.sendMessage(jid, {
                        video: { url },
                        caption: '🔞 _Unknown Codexツ</> +18_',
                        gifPlayback: true
                    }, { quoted: m });
                } else {
                    await sock.sendMessage(jid, {
                        image: { url },
                        caption: '🔞 _Unknown Codexツ</> +18_'
                    }, { quoted: m });
                }

                enviado = true;
            } catch (_) {
                continue;
            }
        }

        if (!enviado) {
            await sock.sendMessage(jid, {
                text: '❌ No se pudo obtener contenido +18.\n' +
                      'Intenta de nuevo en unos segundos.\n\n' +
                      '_Unknown Codexツ</>_'
            }, { quoted: m });
        }
    }
};
