const axios = require('axios');

module.exports = {
    name: 'meme',
    alias: ['randommeme', 'momos', 'momo'],
    category: 'multimedia',
    desc: 'Obtiene y envía un meme aleatorio real de internet (Reddit / Repositorios abiertos)',
    usage: '.meme [opcional: es / en]',
    execute: async ({ sock, m, args }) => {
        await m.react('⏳');

        const lang = (args[0] || '').toLowerCase();
        // Subreddits seleccionados (en español por defecto o inglés si se solicita)
        const subreddits = lang === 'en' 
            ? ['memes', 'dankmemes', 'wholesomememes']
            : ['SpanishMeme', 'yo_elvr', 'memexico', 'dankgentina', 'memes'];

        const selectedSub = subreddits[Math.floor(Math.random() * subreddits.length)];

        try {
            let memeData = null;

            // 1. Intentar con meme-api.com
            try {
                const apiUrl = `https://meme-api.com/gimme/${selectedSub}`;
                const response = await axios.get(apiUrl, { timeout: 12000 });
                if (response.data && response.data.url && !response.data.nsfw) {
                    memeData = {
                        title: response.data.title,
                        url: response.data.url,
                        subreddit: response.data.subreddit,
                        ups: response.data.ups || 0
                    };
                }
            } catch (err) {
                // Probar fallback
            }

            // 2. Fallback general sin subreddit específico en meme-api
            if (!memeData) {
                try {
                    const fallbackApi = 'https://meme-api.com/gimme';
                    const res = await axios.get(fallbackApi, { timeout: 10000 });
                    if (res.data?.url && !res.data.nsfw) {
                        memeData = {
                            title: res.data.title,
                            url: res.data.url,
                            subreddit: res.data.subreddit,
                            ups: res.data.ups || 0
                        };
                    }
                } catch (e) {}
            }

            // 3. Fallback directo a Reddit JSON si la API intermediaria falla
            if (!memeData) {
                try {
                    const redditUrl = `https://www.reddit.com/r/${selectedSub}/hot.json?limit=30`;
                    const res = await axios.get(redditUrl, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                        timeout: 12000
                    });
                    const posts = res.data?.data?.children || [];
                    const imagePosts = posts.filter(p => {
                        const post = p.data;
                        return post && post.url && (post.url.endsWith('.jpg') || post.url.endsWith('.png') || post.url.endsWith('.jpeg')) && !post.over_18;
                    });

                    if (imagePosts.length > 0) {
                        const randomPost = imagePosts[Math.floor(Math.random() * imagePosts.length)].data;
                        memeData = {
                            title: randomPost.title,
                            url: randomPost.url,
                            subreddit: randomPost.subreddit,
                            ups: randomPost.ups || 0
                        };
                    }
                } catch (e) {}
            }

            if (!memeData || !memeData.url) {
                throw new Error('No se pudo obtener un meme en este momento. Intenta de nuevo.');
            }

            // Descargar el buffer de imagen para enviarlo sin depender de previsualizaciones
            const imgRes = await axios.get(memeData.url, {
                responseType: 'arraybuffer',
                timeout: 20000
            });

            const caption = `😂 *${memeData.title}*\n` +
                `🏷️ *r/${memeData.subreddit}* | 👍 *${memeData.ups} upvotes*`;

            await sock.sendMessage(m.chat, {
                image: Buffer.from(imgRes.data),
                caption: caption
            }, { quoted: m });

            await m.react('✅');
        } catch (err) {
            await m.react('❌');
            throw new Error(`Error al obtener meme: ${err.message}`);
        }
    }
};
