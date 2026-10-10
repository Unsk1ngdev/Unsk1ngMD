const { generateQR } = require('../../lib/media');

module.exports = {
    name: 'qr',
    alias: ['qrcode', 'crearqr'],
    category: 'multimedia',
    desc: 'Genera un código QR a partir del texto o enlace proporcionado',
    usage: '.qr [texto o url]',
    execute: async ({ sock, m, text }) => {
        if (!text) {
            return await m.reply('❌ Proporciona el texto o enlace para generar el QR.\nEjemplo: *.qr https://google.com*');
        }

        await m.react('⏳');

        try {
            const qrBuffer = await generateQR(text);

            await sock.sendMessage(m.chat, {
                image: qrBuffer,
                caption: `📱 Código QR generado para:\n"${text}"`
            }, { quoted: m });

            await m.react('✅');
        } catch (err) {
            await m.react('❌');
            throw new Error(`Error generando código QR: ${err.message}`);
        }
    }
};

