const { blurImage } = require('../../lib/media');

module.exports = {
    name: 'blur',
    alias: ['difuminar', 'desenfocar'],
    category: 'multimedia',
    desc: 'Aplica filtro de desenfoque a una imagen citada',
    usage: '.blur [intensidad opcional, ej: .blur 20]',
    execute: async ({ sock, m, args }) => {
        let mediaBuffer = null;

        if (m.quoted && m.quoted.type === 'imageMessage') {
            mediaBuffer = await m.quoted.download();
        } else if (m.type === 'imageMessage') {
            mediaBuffer = await m.download();
        } else {
            return await m.reply('❌ Debes enviar o citar una imagen para aplicar el efecto de desenfoque.');
        }

        let sigma = 15;
        if (args[0] && !isNaN(args[0])) {
            const parsed = parseInt(args[0], 10);
            if (parsed >= 1 && parsed <= 50) {
                sigma = parsed;
            }
        }

        await m.react('⏳');

        try {
            const blurredBuffer = await blurImage(mediaBuffer, sigma);

            await sock.sendMessage(m.chat, {
                image: blurredBuffer,
                caption: `🌫️ Imagen desenfocada (Intensidad: ${sigma}).`
            }, { quoted: m });

            await m.react('✅');
        } catch (err) {
            await m.react('❌');
            throw new Error(`Error al desenfocar imagen: ${err.message}`);
        }
    }
};

