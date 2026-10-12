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

        m.react('🔍').catch(() => {});

        try {
            // Intentar primero con API de búsqueda de imágenes
            const searchUrl = `https://api-pin.vercel.app/api/pinterest?query=${encodeURIComponent(text)}`;
            let imageUrl = null;

            try {
                const response = await axios.get(searchUrl, { timeout: 4500 });
                if (Array.isArray(response.data?.result) && response.data.result.length > 0) {
                    const results = response.data.result;
                    imageUrl = results[Math.floor(Math.random() * Math.min(results.length, 10))];
                }
            } catch (_) {
                // Fallback secundario
            }

            // Fallback con galería Unsplash si falla la primera
            if (!imageUrl) {
                try {
                    const res = await axios.get(`https://source.unsplash.com/featured/800x800/?${encodeURIComponent(text)}`, {
                        maxRedirects: 5,
                        timeout: 4500
                    });
                    imageUrl = res.request?.res?.responseUrl || `https://source.unsplash.com/featured/800x800/?${encodeURIComponent(text)}`;
                } catch (_) {
                    imageUrl = `https://picsum.photos/seed/${encodeURIComponent(text)}/800/800`;
                }
            }

            // Envío directo por URL sin descargar a RAM
            try {
                await sock.sendMessage(m.chat, {
                    image: { url: imageUrl },
                    caption: `📌 *Resultado de búsqueda:* "${text}"`
                }, { quoted: m });
            } catch (_) {
                // Si la URL directa falla por certificados de WhatsApp, descargar buffer rápido
                const imgBuffer = await axios.get(imageUrl, {
                    responseType: 'arraybuffer',
                    timeout: 8000
                });
                await sock.sendMessage(m.chat, {
                    image: Buffer.from(imgBuffer.data),
                    caption: `📌 *Resultado de búsqueda:* "${text}"`
                }, { quoted: m });
            }

            m.react('✅').catch(() => {});
        } catch (err) {
            m.react('❌').catch(() => {});
            throw new Error(`Error obteniendo imagen: ${err.message}`);
        }
    }
};

