const axios = require('axios');

module.exports = {
    name: 'genimg',
    alias: ['dalle', 'imagine', 'crearimagen', 'flux'],
    category: 'herramientas',
    desc: 'Genera una imagen con Inteligencia Artificial a partir de una descripción',
    usage: '.genimg [descripción de la imagen]',
    execute: async ({ sock, m, text }) => {
        if (!text) {
            return await m.reply('❌ Debes proporcionar una descripción para la imagen.\nEjemplo: *.genimg un astronauta tocando guitarra en la luna, arte digital*');
        }

        await m.react('🎨');

        try {
            const seed = Math.floor(Math.random() * 1000000);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?seed=${seed}&width=800&height=800&nologo=true`;

            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 45000,
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            await sock.sendMessage(m.chat, {
                image: Buffer.from(response.data),
                caption: `✨ *Imagen Generada:*\n🎨 *Prompt:* "${text}"`
            }, { quoted: m });

            await m.react('✅');
        } catch (err) {
            await m.react('❌');
            throw new Error(`Error al generar imagen con IA: ${err.message}`);
        }
    }
};

