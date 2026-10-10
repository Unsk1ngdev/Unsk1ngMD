const { createMeme } = require('../../lib/media');

module.exports = {
    name: 'cmeme',
    alias: ['custommeme', 'crearmeme'],
    category: 'multimedia',
    desc: 'Renderiza un meme personalizado con texto superior e inferior sobre una imagen citada',
    usage: '.cmeme [texto superior | texto inferior]',
    execute: async ({ sock, m, text }) => {
        let mediaBuffer = null;

        if (m.quoted && m.quoted.type === 'imageMessage') {
            mediaBuffer = await m.quoted.download();
        } else if (m.type === 'imageMessage') {
            mediaBuffer = await m.download();
        } else {
            return await m.reply('❌ Debes enviar o citar una imagen con el texto del meme.\nEjemplo: *.cmeme Cuando compila | A la primera*');
        }

        if (!text) {
            return await m.reply('❌ Proporciona el texto para el meme separado por "|" .\nEjemplo: *.cmeme Arriba | Abajo*');
        }

        const parts = text.split('|').map(s => s.trim());
        const topText = parts[0] || '';
        const bottomText = parts[1] || '';

        await m.react('⏳');

        try {
            const memeBuffer = await createMeme(mediaBuffer, topText, bottomText);

            await sock.sendMessage(m.chat, {
                image: memeBuffer,
                caption: '😂 Aquí está tu meme personalizado generado.'
            }, { quoted: m });

            await m.react('✅');
        } catch (err) {
            await m.react('❌');
            throw new Error(`Fallo al generar meme: ${err.message}`);
        }
    }
};

