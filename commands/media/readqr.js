const { readQRCode } = require('../../lib/media');

module.exports = {
    name: 'readqr',
    alias: ['scanqr', 'leerqr'],
    category: 'multimedia',
    desc: 'Escanea y extrae el texto de una imagen con código QR citada',
    usage: '.readqr [citando imagen QR]',
    execute: async ({ sock, m }) => {
        let mediaBuffer = null;

        if (m.quoted && m.quoted.type === 'imageMessage') {
            mediaBuffer = await m.quoted.download();
        } else if (m.type === 'imageMessage') {
            mediaBuffer = await m.download();
        } else {
            return await m.reply('❌ Cita o envía una imagen que contenga un código QR.');
        }

        await m.react('⏳');

        try {
            const result = await readQRCode(mediaBuffer);

            if (!result) {
                await m.react('❌');
                return await m.reply('⚠️ No se pudo detectar ni decodificar ningún código QR válido en la imagen proporcionada.');
            }

            await sock.sendMessage(m.chat, {
                text: `🔍 *Contenido del Código QR:*\n\n${result}`
            }, { quoted: m });

            await m.react('✅');
        } catch (err) {
            await m.react('❌');
            throw new Error(`Error escaneando el QR: ${err.message}`);
        }
    }
};

