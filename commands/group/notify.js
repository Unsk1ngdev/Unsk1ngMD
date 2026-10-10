module.exports = {
    name: 'notify',
    alias: ['notif', 'anuncio', 'alerta'],
    category: 'grupo',
    desc: 'Notifica a todos los participantes del grupo con el texto indicado mencionándolos',
    usage: '.notify [texto del anuncio o citando un mensaje]',
    groupOnly: true,
    adminOnly: true,
    execute: async ({ sock, m, text, participants, groupMetadata }) => {
        const messageBody = text || m.quoted?.body;

        if (!messageBody) {
            return await m.reply('❌ Debes proporcionar el texto para la notificación o citar un mensaje.\nEjemplo: *.notify Reunión obligatoria a las 5:00 PM*');
        }

        if (!participants || participants.length === 0) {
            return await m.reply('❌ No se pudo obtener la lista de miembros del grupo.');
        }

        const mentions = participants.map(p => p.id);
        const adminName = m.pushName || `@${m.sender.split('@')[0]}`;
        const groupTitle = groupMetadata?.subject || 'este grupo';

        const finalMessage = `📢 *AVISO DE ADMINISTRACIÓN*\n` +
            `📍 *Grupo:* ${groupTitle}\n` +
            `👤 *Emitido por:* ${adminName}\n\n` +
            `📝 *Mensaje:*\n${messageBody}\n\n` +
            `👥 _Total de miembros notificados: ${participants.length}_`;

        await sock.sendMessage(m.chat, {
            text: finalMessage,
            mentions: [...mentions, m.sender]
        });
    }
};

