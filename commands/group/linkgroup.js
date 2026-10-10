module.exports = {
    name: 'linkgroup',
    alias: ['enlace', 'link'],
    category: 'grupo',
    desc: 'Obtiene el enlace de invitación del grupo actual',
    usage: '.linkgroup',
    groupOnly: true,
    botAdminRequired: true,
    execute: async ({ sock, m, groupMetadata }) => {
        try {
            const code = await sock.groupInviteCode(m.chat);
            const link = `https://chat.whatsapp.com/${code}`;

            await sock.sendMessage(m.chat, {
                text: `🔗 *Enlace de invitación para:* ${groupMetadata?.subject || 'este grupo'}\n\n👉 ${link}`
            }, { quoted: m });
        } catch (err) {
            throw new Error(`No se pudo generar el enlace del grupo: ${err.message}`);
        }
    }
};

