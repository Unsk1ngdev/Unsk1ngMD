'use strict';

const axios = require('axios');
const logger = require('../../lib/logger');

/**
 * Busca canciones por fragmento de letra en Genius
 */
async function searchGenius(query) {
    try {
        const url = `https://genius.com/api/search/multi?q=${encodeURIComponent(query)}`;
        const res = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            }
        });

        const sections = res.data?.response?.sections || [];
        const songSection = sections.find(s => s.type === 'song' || s.type === 'top_hit');
        if (!songSection || !Array.isArray(songSection.hits) || songSection.hits.length === 0) {
            return [];
        }

        return songSection.hits
            .filter(h => h.type === 'song' && h.result)
            .slice(0, 5)
            .map(h => ({
                title: h.result.title || h.result.title_with_featured,
                artist: h.result.artist_names || h.result.primary_artist?.name,
                image: h.result.song_art_image_thumbnail_url || h.result.header_image_thumbnail_url,
                url: h.result.url,
                releaseDate: h.result.release_date_for_display || null,
                source: 'Genius'
            }));
    } catch (err) {
        logger.warn(`[SEARCHTHATSONG] Error en Genius: ${err.message}`);
        return [];
    }
}

/**
 * Busca canciones por texto en LRCLIB
 */
async function searchLrclib(query) {
    try {
        const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
        const res = await axios.get(url, {
            timeout: 8000,
            headers: { 'User-Agent': 'WhatsAppBot (https://github.com)' }
        });

        const tracks = res.data;
        if (!Array.isArray(tracks) || tracks.length === 0) return [];

        return tracks.slice(0, 5).map(t => ({
            title: t.trackName,
            artist: t.artistName,
            album: t.albumName,
            duration: t.duration ? `${Math.floor(t.duration / 60)}:${Math.floor(t.duration % 60).toString().padStart(2, '0')}` : null,
            snippet: t.plainLyrics ? t.plainLyrics.split('\n').filter(Boolean).slice(0, 3).join(' / ') : null,
            source: 'LRCLIB'
        }));
    } catch (err) {
        logger.warn(`[SEARCHTHATSONG] Error en LRCLIB: ${err.message}`);
        return [];
    }
}

/**
 * Busca canciones en iTunes Search API
 */
async function searchITunes(query) {
    try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`;
        const res = await axios.get(url, {
            timeout: 8000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const results = res.data?.results;
        if (!Array.isArray(results) || results.length === 0) return [];

        return results.map(r => ({
            title: r.trackName,
            artist: r.artistName,
            album: r.collectionName,
            releaseDate: r.releaseDate ? r.releaseDate.substring(0, 4) : null,
            previewUrl: r.previewUrl,
            image: r.artworkUrl100,
            source: 'iTunes'
        }));
    } catch (err) {
        logger.warn(`[SEARCHTHATSONG] Error en iTunes: ${err.message}`);
        return [];
    }
}

module.exports = {
    name: 'searchthatsong',
    alias: ['findsong', 'buscarcancion', 'whatsong', 'cualescancion', 'cancionporletra'],
    category: 'herramientas',
    desc: 'Encuentra canciones buscando por cualquier fragmento o estrofa de su letra',
    usage: '.searchthatsong <fragmento de la letra de la canción>',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        const lyricsQuery = (args && args.length > 0 ? args.join(' ') : (text || '')).trim();

        if (!lyricsQuery || lyricsQuery.length < 5) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🔍 BUSCADOR DE CANCIONES POR LETRA 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* `.searchthatsong <letra>`',
                    '┃├◆ 📌 *Ejemplo 1:* `.searchthatsong is this the real life is this just fantasy`',
                    '┃├◆ 📌 *Ejemplo 2:* `.searchthatsong quiero respirar tu cuello despacito`',
                    '┃',
                    '┃├◆ 🎶 ¿Recuerdas una parte de la canción pero no el título?',
                    '┃  Escribe la frase que recuerdas y el bot la encontrará.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        await m.react?.('🎵');
        await sock.sendMessage(jid, {
            text: `🔎 Buscando canciones que contengan la letra:\n_"${lyricsQuery}"_...`
        }, { quoted: m });

        try {
            // Intentar en paralelo Genius, LRCLIB y iTunes
            const [geniusResults, lrclibResults, itunesResults] = await Promise.allSettled([
                searchGenius(lyricsQuery),
                searchLrclib(lyricsQuery),
                searchITunes(lyricsQuery)
            ]);

            const geniusList = geniusResults.status === 'fulfilled' ? geniusResults.value : [];
            const lrclibList = lrclibResults.status === 'fulfilled' ? lrclibResults.value : [];
            const itunesList = itunesResults.status === 'fulfilled' ? itunesResults.value : [];

            // Consolidar y deduplicar por título + artista
            const combined = [];
            const seen = new Set();

            const addSongs = (list) => {
                for (const item of list) {
                    if (!item.title || !item.artist) continue;
                    const key = `${item.title.toLowerCase().trim()}|${item.artist.toLowerCase().trim()}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        combined.push(item);
                    }
                }
            };

            addSongs(geniusList);
            addSongs(lrclibList);
            addSongs(itunesList);

            if (combined.length === 0) {
                await m.react?.('❌');
                return await sock.sendMessage(jid, {
                    text: [
                        '┏❐ 《 ❌ CANCIÓN NO ENCONTRADA 》 ❐',
                        '┃',
                        `┃├◆ 🔍 *Búsqueda:* "${lyricsQuery}"`,
                        '┃├◆ 💡 *Consejo:*',
                        '┃   - Intenta escribir 4 o 5 palabras consecutivas.',
                        '┃   - Revisa si hay errores ortográficos en la frase.',
                        '┃   - Si la canción es en otro idioma, prueba con su letra original.',
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                }, { quoted: m });
            }

            const topMatches = combined.slice(0, 4);
            const mainHit = topMatches[0];

            let message = [
                '┏❐ 《 🎶 ¡CANCIÓN ENCONTRADA! 》 ❐',
                '┃',
                `┃├◆ 🎵 *Título:* ${mainHit.title}`,
                `┃├◆ 🎤 *Artista:* ${mainHit.artist}`,
                mainHit.album ? `┃├◆ 💿 *Álbum:* ${mainHit.album}` : null,
                mainHit.releaseDate ? `┃├◆ 📅 *Año / Lanzamiento:* ${mainHit.releaseDate}` : null,
                mainHit.duration ? `┃├◆ ⏱️ *Duración:* ${mainHit.duration}` : null,
                mainHit.snippet ? `┃├◆ 📜 *Fragmento:* "${mainHit.snippet}..."` : null,
                mainHit.url ? `┃├◆ 🔗 *Enlace:* ${mainHit.url}` : null,
                '┃'
            ].filter(Boolean);

            if (topMatches.length > 1) {
                message.push('┃├◆ 📌 *Otras posibles coincidencias:*');
                topMatches.slice(1).forEach((m, idx) => {
                    message.push(`┃  ${idx + 2}. *${m.title}* — _${m.artist}_`);
                });
                message.push('┃');
            }

            message.push('┃├◆ 💡 *Tip:* Para descargarla escribe `.ytmp3 ' + mainHit.title + ' ' + mainHit.artist + '`');
            message.push('┗❐\n');
            message.push('_Unknown Codexツ</>_');

            await m.react?.('✅');

            // Si hay portada disponible, enviarla con caption
            const coverImage = mainHit.image;
            if (coverImage && /^https?:\/\//i.test(coverImage)) {
                try {
                    await sock.sendMessage(jid, {
                        image: { url: coverImage },
                        caption: message.join('\n')
                    }, { quoted: m });
                    return;
                } catch (_) {
                    // Si falla el envío de imagen, enviar como texto plano
                }
            }

            await sock.sendMessage(jid, { text: message.join('\n') }, { quoted: m });

        } catch (err) {
            logger.error('[SEARCHTHATSONG ERROR]:', err.message);
            await m.react?.('❌');
            await sock.sendMessage(jid, {
                text: `❌ Ocurrió un error al buscar la canción: ${err.message}`
            }, { quoted: m });
        }
    }
};

