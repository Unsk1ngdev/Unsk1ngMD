module.exports = {
    name: 'tagall',
    alias: ['todos', 'invocar'],
    category: 'grupo',
    desc: 'Menciona a todos los miembros del grupo con un motivo opcional',
    usage: '.tagall [motivo]',
    groupOnly: true,
    adminOnly: true,
    execute: async ({ sock, m, text, participants, groupMetadata }) => {
        if (!participants || participants.length === 0) {
            return await m.reply('❌ No se pudo obtener la lista de participantes del grupo.');
        }

        const reason = text ? `\n📌 *Motivo:* ${text}\n` : '';
        let messageText = `📢 *ATENCIÓN GRUPO: ${groupMetadata?.subject || ''}*${reason}\n👥 *Total:* ${participants.length} miembros\n\n`;

        const mentions = [];
        for (const p of participants) {
            const user = p.id;
            mentions.push(user);
            messageText += `🔹 @${user.split('@')[0]}\n`;
        }

        await sock.sendMessage(m.chat, {
            text: messageText,
            mentions: mentions
        }, { quoted: m });
    }
};

