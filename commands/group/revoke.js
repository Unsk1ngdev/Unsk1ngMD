module.exports = {
    name: 'revoke',
    alias: ['resetlink', 'revocarenlace'],
    category: 'grupo',
    desc: 'Restablece y revoca el enlace de invitación del grupo actual',
    usage: '.revoke',
    groupOnly: true,
    adminOnly: true,
    botAdminRequired: true,
    execute: async ({ sock, m }) => {
        try {
            await sock.groupRevokeInvite(m.chat);
            const newCode = await sock.groupInviteCode(m.chat);
            await m.reply(`🔄 *Enlace restablecido con éxito.*\n\nNuevo enlace:\n👉 https://chat.whatsapp.com/${newCode}`);
        } catch (err) {
            throw new Error(`Error al restablecer el enlace: ${err.message}`);
        }
    }
};

