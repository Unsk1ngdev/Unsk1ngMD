'use strict';

const axios = require('axios');

const animeMemoryCache = new Map();

module.exports = {
    name: 'anime',
    alias: ['animesearch', 'mal', 'jikan'],
    category: 'herramientas',
    desc: 'Busca información detallada y portada oficial de cualquier anime (MyAnimeList / AniList)',
    usage: '.anime [nombre del anime]',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        const nombre = text?.trim() || args.join(' ').trim();

        if (!nombre) {
            return await sock.sendMessage(jid, {
                text: '❌ Uso: *.anime [nombre]*\nEjemplo: *.anime Naruto*'
            }, { quoted: m });
        }

        const cacheKey = nombre.toLowerCase().trim();
        const cached = animeMemoryCache.get(cacheKey);
        if (cached && (Date.now() - cached.time < 60000)) {
            if (cached.image && cached.image.startsWith('http')) {
                return await sock.sendMessage(jid, {
                    image: { url: cached.image },
                    caption: cached.info
                }, { quoted: m });
            }
            return await sock.sendMessage(jid, { text: cached.info }, { quoted: m });
        }

        let animeInfo = null;

        // 1. Intento principal con Jikan API (MyAnimeList)
        try {
            const res = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(nombre)}&limit=1`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 4500,
                family: 4
            });
            const item = res.data?.data?.[0];
            if (item) {
                const estadoMap = {
                    'Finished Airing': '✅ Finalizado',
                    'Currently Airing': '📡 En emisión',
                    'Not yet aired': '⏳ Próximamente'
                };
                const estado = estadoMap[item.status] || item.status || 'N/A';
                const generos = item.genres?.map(g => g.name).join(', ') || 'N/A';
                const estudios = item.studios?.map(s => s.name).join(', ') || 'N/A';
                const sinopsis = item.synopsis
                    ? item.synopsis.slice(0, 320) + (item.synopsis.length > 320 ? '...' : '')
                    : 'Sin sinopsis disponible.';

                animeInfo = {
                    title: item.title,
                    title_japanese: item.title_japanese || 'N/A',
                    type: item.type || 'TV',
                    episodes: item.episodes || '?',
                    status: estado,
                    score: item.score || 'N/A',
                    scored_by: item.scored_by?.toLocaleString() || 'N/A',
                    rank: item.rank || 'N/A',
                    genres: generos,
                    studios: estudios,
                    aired: item.aired?.string || 'N/A',
                    synopsis: sinopsis,
                    image: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url
                };
            }
        } catch (_) {}

        // 2. Respaldo ultrarrápido con AniList si Jikan no respondió
        if (!animeInfo) {
            try {
                const query = `query ($search: String) {
                  Media (search: $search, type: ANIME) {
                    title { romaji english native }
                    format
                    episodes
                    status
                    averageScore
                    genres
                    description(asHtml: false)
                    coverImage { large }
                    studios(isMain: true) { nodes { name } }
                    startDate { year }
                  }
                }`;
                const res = await axios.post('https://graphql.anilist.co', {
                    query,
                    variables: { search: nombre }
                }, { timeout: 6000 });
                const mData = res.data?.data?.Media;
                if (mData) {
                    const estadoMap = {
                        'FINISHED': '✅ Finalizado',
                        'RELEASING': '📡 En emisión',
                        'NOT_YET_RELEASED': '⏳ Próximamente'
                    };
                    const sinopsis = mData.description
                        ? mData.description.replace(/<[^>]*>?/gm, '').slice(0, 320) + '...'
                        : 'Sin sinopsis disponible.';

                    animeInfo = {
                        title: mData.title?.romaji || mData.title?.english || nombre,
                        title_japanese: mData.title?.native || 'N/A',
                        type: mData.format || 'Anime',
                        episodes: mData.episodes || '?',
                        status: estadoMap[mData.status] || mData.status || 'N/A',
                        score: mData.averageScore ? (mData.averageScore / 10).toFixed(1) : 'N/A',
                        scored_by: 'Comunidad AniList',
                        rank: 'N/A',
                        genres: mData.genres?.join(', ') || 'N/A',
                        studios: mData.studios?.nodes?.map(s => s.name).join(', ') || 'N/A',
                        aired: mData.startDate?.year ? String(mData.startDate.year) : 'N/A',
                        synopsis: sinopsis,
                        image: mData.coverImage?.large
                    };
                }
            } catch (_) {}
        }

        if (!animeInfo) {
            return await sock.sendMessage(jid, {
                text: `❌ No se encontró el anime *${nombre}*.\nVerifica el nombre e inténtalo de nuevo.`
            }, { quoted: m });
        }

        const info =
            `📺 *${animeInfo.title}*\n` +
            `🇯🇵 _${animeInfo.title_japanese}_\n\n` +
            `📊 *Tipo:* ${animeInfo.type}\n` +
            `🎬 *Episodios:* ${animeInfo.episodes}\n` +
            `📡 *Estado:* ${animeInfo.status}\n` +
            `⭐ *Puntuación:* ${animeInfo.score}/10\n` +
            `👥 *Votos:* ${animeInfo.scored_by}\n` +
            `🏆 *Ranking:* #${animeInfo.rank}\n` +
            `🎭 *Géneros:* ${animeInfo.genres}\n` +
            `🎨 *Estudio:* ${animeInfo.studios}\n` +
            `📅 *Estreno:* ${animeInfo.aired}\n\n` +
            `📝 *Sinopsis:*\n_${animeInfo.synopsis}_\n\n` +
            `_Unknown Codexツ</>_`;

        animeMemoryCache.set(cacheKey, { image: animeInfo.image, info, time: Date.now() });

        if (animeInfo.image && animeInfo.image.startsWith('http')) {
            try {
                await sock.sendMessage(jid, {
                    image: { url: animeInfo.image },
                    caption: info
                }, { quoted: m });
                return;
            } catch (_) {}
        }

        await sock.sendMessage(jid, { text: info }, { quoted: m });
    }
};

