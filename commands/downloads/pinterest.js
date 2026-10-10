const axios = require('axios');

module.exports = {
    name: 'pinterest',
    alias: ['pin', 'imagen'],
    category: 'descargas',
    desc: 'Busca y envía una imagen temática de Pinterest o galería web',
    usage: '.pinterest [búsqueda]',
    execute: async ({ sock, m, text }) => {
        if (!text) {
            return await m.reply('❌ Por favor, escribe lo que deseas buscar.\nEjemplo: *.pinterest anime aesthetic wallpaper*');
        }

        await m.react('🔍');

        try {
            // Intentar primero con API de búsqueda de imágenes de Unsplash / DuckDuckGo
            const searchUrl = `https://api-pin.vercel.app/api/pinterest?query=${encodeURIComponent(text)}`;
            let imageUrl = null;

            try {
                const response = await axios.get(searchUrl, { timeout: 10000 });
                if (Array.isArray(response.data?.result) && response.data.result.length > 0) {
                    const results = response.data.result;
                    imageUrl = results[Math.floor(Math.random() * Math.min(results.length, 10))];
                }
            } catch (e) {
                // Fallback secundario
            }

            // Fallback con galería abierta Unsplash Source si falla la primera
            if (!imageUrl) {
                const fallbackUrl = `https://api.unsplash.com/search/photos?page=1&query=${encodeURIComponent(text)}&client_id=Client-ID-Public`;
                try {
                    const res = await axios.get(`https://source.unsplash.com/featured/800x800/?${encodeURIComponent(text)}`, {
                        maxRedirects: 5,
                        timeout: 10000
                    });
                    imageUrl = res.request.res.responseUrl || `https://source.unsplash.com/featured/800x800/?${encodeURIComponent(text)}`;
                } catch (e) {
                    imageUrl = `https://picsum.photos/seed/${encodeURIComponent(text)}/800/800`;
                }
            }

            const imgBuffer = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 20000
            });

            await sock.sendMessage(m.chat, {
                image: Buffer.from(imgBuffer.data),
                caption: `📌 *Resultado de búsqueda:* "${text}"`
            }, { quoted: m });

            await m.react('✅');
        } catch (err) {
            await m.react('❌');
            throw new Error(`Error obteniendo imagen: ${err.message}`);
        }
    }
};

