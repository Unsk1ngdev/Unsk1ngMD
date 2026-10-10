const axios = require('axios');

module.exports = {
    name: 'lyrics',
    alias: ['letra', 'letramusica'],
    category: 'herramientas',
    desc: 'Busca y devuelve la letra de una canción musical',
    usage: '.lyrics [nombre de la canción y/o artista]',
    execute: async ({ sock, m, text }) => {
        if (!text) {
            return await m.reply('❌ Por favor, escribe el nombre de la canción.\nEjemplo: *.lyrics Bohemian Rhapsody Queen*');
        }

        await m.react('🎵');

        try {
            // Consulta a LRCLIB (Base de datos libre y abierta de letras musicales)
            const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(text)}`;
            const response = await axios.get(searchUrl, {
                timeout: 15000,
                headers: { 'User-Agent': 'WhatsAppBot (https://github.com)' }
            });

            const tracks = response.data;
            if (!Array.isArray(tracks) || tracks.length === 0) {
                return await m.reply(`❌ No se encontró ninguna letra para "${text}".`);
            }

            // Encontrar la primera pista con letra disponible
            const track = tracks.find(t => t.plainLyrics) || tracks[0];
            const lyrics = track.plainLyrics || track.syncedLyrics;

            if (!lyrics) {
                return await m.reply(`❌ Se encontró la pista "${track.trackName}" de "${track.artistName}", pero no contiene letra registrada.`);
            }

            const header = `🎶 *${track.trackName}* - ${track.artistName}\n` +
                (track.albumName ? `💿 *Álbum:* ${track.albumName}\n` : '') +
                `━━━━━━━━━━━━━━━━━━━━\n\n`;

            // Cortar si excede el límite de mensaje de WhatsApp
            const finalMessage = (header + lyrics).slice(0, 4000);

            await m.reply(finalMessage);
            await m.react('✅');
        } catch (err) {
            await m.react('❌');
            throw new Error(`Error buscando la letra de la canción: ${err.message}`);
        }
    }
};

