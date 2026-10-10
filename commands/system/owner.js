const config = require('../../config');

module.exports = {
    name: 'owner',
    alias: ['creador', 'dueño', 'dev', 'castrodev'],
    category: 'sistema',
    desc: 'Muestra la tarjeta de contacto y datos del creador oficial (Castrodev)',
    usage: '.owner',
    execute: async ({ sock, m }) => {
        const cleanNumber = config.ownerNumber.replace(/[^0-9]/g, '');
        const displayName = config.ownerName || 'Castrodev';

        // Estructura vCard oficial para WhatsApp
        const vcard = 'BEGIN:VCARD\n'
            + 'VERSION:3.0\n'
            + `FN:${displayName}\n`
            + `ORG:${config.botName} Official Dev;\n`
            + `TEL;type=CELL;type=VOICE;waid=${cleanNumber}:+${cleanNumber}\n`
            + 'END:VCARD';

        // 1. Enviar la tarjeta de contacto interactiva
        await sock.sendMessage(m.chat, {
            contacts: {
                displayName: displayName,
                contacts: [{ vcard }]
            }
        }, { quoted: m });

        // 2. Mensaje informativo complementario con enlace directo
        const infoMessage = `👑 *DESARROLLADOR OFICIAL:*\n\n` +
            `👤 *Creador:* ${displayName}\n` +
            `📱 *Número:* +${cleanNumber}\n` +
            `💬 *Contacto directo:* https://wa.me/${cleanNumber}\n` +
            `🤖 *Bot:* ${config.botName}\n\n` +
            `_Para soporte, dudas o sugerencias puedes comunicarte directamente con él._`;

        await m.reply(infoMessage);
    }
};

