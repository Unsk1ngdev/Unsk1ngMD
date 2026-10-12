'use strict';

const axios = require('axios');

module.exports = {
    name: 'videojuego',
    alias: ['juego', 'game', 'videogame', 'gamesearch'],
    category: 'herramientas',
    desc: 'Busca información técnica verificada y portada oficial de cualquier videojuego (RAWG API)',
    usage: '.videojuego [nombre del juego]',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        const nombre = text?.trim() || args.join(' ').trim();

        if (!nombre) {
            return await sock.sendMessage(jid, {
                text: '❌ Uso: *.videojuego [nombre]*\nEjemplo: *.videojuego GTA V*'
            }, { quoted: m });
        }

        await sock.sendMessage(jid, {
            text: `🎮 Buscando *${nombre}*...\n🔄 Procesando...`
        }, { quoted: m });

        try {
            const RAWG_KEY = process.env.RAWG_KEY?.trim() || 'c542e67aec3a4340908f9de9e86038af';

            // 1. Buscar el juego
            const resSearch = await axios.get(
                `https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${encodeURIComponent(nombre)}&page_size=1`,
                { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, timeout: 8000 }
            );

            const data = resSearch.data;
            const juego = data?.results?.[0];

            if (!juego) {
                return await sock.sendMessage(jid, {
                    text: `❌ No se encontró *${nombre}*.\nIntenta con otro nombre o título en inglés.`
                }, { quoted: m });
            }

            // 2. Obtener detalles completos
            let detalle = {};
            try {
                const targetSlug = juego.slug || juego.id;
                const resDetalle = await axios.get(
                    `https://api.rawg.io/api/games/${targetSlug}?key=${RAWG_KEY}`,
                    { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, timeout: 8000 }
                );
                detalle = resDetalle.data || {};
            } catch (_) {
                detalle = juego;
            }

            // 3. Procesar VERIFICANDO estrictamente cada campo
            const plataformas = Array.isArray(detalle.platforms) && detalle.platforms.length > 0
                ? detalle.platforms.slice(0, 5).map(p => p?.platform?.name || '').filter(Boolean).join(', ')
                : 'N/A';

            const generos = Array.isArray(detalle.genres) && detalle.genres.length > 0
                ? detalle.genres.map(g => g?.name || '').filter(Boolean).join(', ')
                : 'N/A';

            const desarrollador = Array.isArray(detalle.developers) && detalle.developers.length > 0
                ? detalle.developers.map(d => d?.name || '').filter(Boolean).join(', ')
                : 'N/A';

            const publicador = Array.isArray(detalle.publishers) && detalle.publishers.length > 0
                ? detalle.publishers.map(p => p?.name || '').filter(Boolean).join(', ')
                : 'N/A';

            const rating = detalle.rating && detalle.rating > 0
                ? `${detalle.rating.toFixed(1)}/5 ⭐`
                : (juego.rating && juego.rating > 0 ? `${juego.rating.toFixed(1)}/5 ⭐` : 'N/A');

            const metacritic = detalle.metacritic && detalle.metacritic > 0
                ? `${detalle.metacritic}/100`
                : (juego.metacritic && juego.metacritic > 0 ? `${juego.metacritic}/100` : 'N/A');

            const tiempoJuego = detalle.playtime && detalle.playtime > 0
                ? `~${detalle.playtime} horas`
                : (juego.playtime && juego.playtime > 0 ? `~${juego.playtime} horas` : 'N/A');

            const fechaLanzamiento = detalle.released || juego.released || 'N/A';

            const descripcion = detalle.description_raw
                ? detalle.description_raw.replace(/\r\n/g, '\n').slice(0, 350) + '...'
                : (detalle.description
                    ? detalle.description.replace(/<[^>]*>?/gm, '').slice(0, 350) + '...'
                    : 'Sin descripción disponible');

            // Imagen verificada
            const imagen = detalle.background_image || juego.background_image || null;

            const info =
                `🎮 *${detalle.name || juego.name || nombre}*\n\n` +
                `📅 *Lanzamiento:* ${fechaLanzamiento}\n` +
                `⭐ *Rating:* ${rating}\n` +
                `🏆 *Metacritic:* ${metacritic}\n` +
                `🕹️ *Plataformas:*\n${plataformas}\n` +
                `🎭 *Géneros:* ${generos}\n` +
                `👨‍💻 *Desarrollador:* ${desarrollador}\n` +
                `🏢 *Publicador:* ${publicador}\n` +
                `⏱️ *Tiempo de juego:* ${tiempoJuego}\n\n` +
                `📝 *Descripción:*\n_${descripcion}_\n\n` +
                `_Unknown Codexツ</>_`;

            if (imagen && typeof imagen === 'string' && imagen.startsWith('http')) {
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
            console.error('[VIDEOJUEGO ERROR]:', e.message);
            await sock.sendMessage(jid, {
                text: `❌ Error al consultar videojuego: ${e.message}`
            }, { quoted: m });
        }
    }
};
