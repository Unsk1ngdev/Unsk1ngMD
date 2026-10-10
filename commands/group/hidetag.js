module.exports = {
    name: 'hidetag',
    alias: ['notificar', 'aviso', 'h'],
    category: 'grupo',
    desc: 'Envía un mensaje notificando a todos los miembros de forma invisible sin mostrar lista de números',
    usage: '.hidetag [texto opcional]',
    groupOnly: true,
    adminOnly: true,
    execute: async ({ sock, m, text, participants, groupMetadata }) => {
        let metadata = groupMetadata;
        if (!metadata || !metadata.participants || metadata.participants.length === 0) {
            try {
                metadata = await sock.groupMetadata(m.chat);
            } catch (e) {
                metadata = null;
            }
        }
        const groupParticipants = metadata?.participants || participants || [];
        if (!groupParticipants || groupParticipants.length === 0) {
            return await m.reply('❌ No se pudo obtener la lista de participantes.');
        }

        const mentions = groupParticipants.map(p => p.id);

        // Si el usuario pone .hidetag [texto], envía el texto limpio pero con menciones en segundo plano.
        // Si el usuario solo escribe .hidetag sin texto, envía el caracter invisible (espacio de ancho cero \u200B).
        const rawContent = text?.trim() || m.quoted?.body?.trim();
        const messageContent = rawContent && rawContent.length > 0 ? rawContent : '\u200B';

        await sock.sendMessage(m.chat, {
            text: messageContent,
            mentions: mentions
        });
    }
};
