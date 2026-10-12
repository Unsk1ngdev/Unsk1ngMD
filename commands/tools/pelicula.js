'use strict';

const axios = require('axios');

module.exports = {
    name: 'pelicula',
    alias: ['movie', 'peli', 'film', 'cine'],
    category: 'herramientas',
    desc: 'Busca información técnica detallada y póster oficial de cualquier película (TheMovieDB API)',
    usage: '.pelicula [nombre de la película]',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        const titulo = text?.trim() || args.join(' ').trim();

        if (!titulo) {
            return await sock.sendMessage(jid, {
                text: '❌ Uso: *.pelicula [nombre]*\nEjemplo: *.pelicula Avengers*'
            }, { quoted: m });
        }

        await sock.sendMessage(jid, {
            text: `🎬 Buscando *${titulo}*...\n🔄 Procesando...`
        }, { quoted: m });

        try {
            const TMDB_KEY = process.env.TMDB_KEY?.trim() || '8265bd1679663a7ea12ac168da84d2e8';
            const BASE_IMG = 'https://image.tmdb.org/t/p/w500';

            // 1. Buscar en español primero
            const resSearch = await axios.get(
                `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(titulo)}&language=es-ES&page=1`,
                { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, timeout: 8000 }
            );

            const data = resSearch.data;
            const pelicula = data?.results?.[0];

            if (!pelicula) {
                return await sock.sendMessage(jid, {
                    text: `❌ No se encontró *${titulo}*.\nIntenta con otro nombre o título original.`
                }, { quoted: m });
            }

            // 2. Obtener detalles completos con créditos
            const resDetalle = await axios.get(
                `https://api.themoviedb.org/3/movie/${pelicula.id}?api_key=${TMDB_KEY}&language=es-ES&append_to_response=credits`,
                { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, timeout: 8000 }
            );
            const detalle = resDetalle.data || {};

            // Procesar datos
            const actores = detalle.credits?.cast
                ?.slice(0, 5)
                .map(a => a.name)
                .join(', ') || 'N/A';

            const director = detalle.credits?.crew
                ?.find(c => c.job === 'Director')?.name || 'N/A';

            const generos = detalle.genres
                ?.map(g => g.name)
                .join(', ') || 'N/A';

            const sinopsis = detalle.overview ||
                pelicula.overview ||
                'Sin sinopsis disponible';

            const duracion = detalle.runtime
                ? `${detalle.runtime} min`
                : 'N/A';

            const presupuesto = detalle.budget > 0
                ? `$${detalle.budget.toLocaleString()}`
                : 'N/A';

            const recaudacion = detalle.revenue > 0
                ? `$${detalle.revenue.toLocaleString()}`
                : 'N/A';

            const info =
                `🎬 *${detalle.title || pelicula.title}*\n` +
                (detalle.original_title && detalle.original_title !== detalle.title
                    ? `🌍 _${detalle.original_title}_\n`
                    : '') +
                `\n📅 *Estreno:* ${detalle.release_date || pelicula.release_date || 'N/A'}\n` +
                `⏱️ *Duración:* ${duracion}\n` +
                `🎭 *Géneros:* ${generos}\n` +
                `🌍 *País:* ${detalle.production_countries?.[0]?.name || 'N/A'}\n` +
                `🗣️ *Idioma original:* ${detalle.original_language?.toUpperCase() || 'N/A'}\n` +
                `⭐ *Puntuación:* ${detalle.vote_average ? detalle.vote_average.toFixed(1) : (pelicula.vote_average?.toFixed(1) || 'N/A')}/10\n` +
                `👥 *Votos:* ${detalle.vote_count?.toLocaleString() || pelicula.vote_count?.toLocaleString() || 'N/A'}\n` +
                `💰 *Presupuesto:* ${presupuesto}\n` +
                `💵 *Recaudación:* ${recaudacion}\n\n` +
                `🎬 *Director:* ${director}\n` +
                `🌟 *Actores:* ${actores}\n\n` +
                `📝 *Sinopsis:*\n_${sinopsis.slice(0, 400)}${sinopsis.length > 400 ? '...' : ''}_\n\n` +
                `_Unknown Codexツ</>_`;

            // Imagen siempre con TMDB
            const imagen = pelicula.poster_path
                ? `${BASE_IMG}${pelicula.poster_path}`
                : detalle.backdrop_path
                    ? `${BASE_IMG}${detalle.backdrop_path}`
                    : null;

            if (imagen) {
                try {
                    await sock.sendMessage(jid, {
                        image: { url: imagen },
                        caption: info
                    }, { quoted: m });
                    return;
                } catch (_) {}
            }

            await sock.sendMessage(jid, { text: info }, { quoted: m });

        } catch (e) {
            console.error('[PELICULA TMDB ERROR]:', e.message);
            await sock.sendMessage(jid, {
                text: `❌ Error al consultar la película: ${e.message}`
            }, { quoted: m });
        }
    }
};
