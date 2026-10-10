module.exports = {
    name: 'broadcast',
    alias: ['bc', 'difusion'],
    category: 'sistema',
    desc: 'Envía un comunicado oficial a todos los grupos donde se encuentra el bot',
    usage: '.broadcast [mensaje]',
    ownerOnly: true,
    execute: async ({ sock, m, text }) => {
        if (!text) {
            return await m.reply('❌ Por favor, escribe el mensaje que deseas difundir.');
        }

        await m.reply('⏳ Iniciando difusión...');

        try {
            // Obtener todos los grupos participando
            const chats = await sock.groupFetchAllParticipating();
            const groupIds = Object.keys(chats);

            let success = 0;
            let failed = 0;

            const broadcastMessage = `📢 *COMUNICADO OFICIAL*\n\n${text}\n\n_Mensaje enviado por el Administrador del Bot_`;

            for (const id of groupIds) {
                try {
                    await sock.sendMessage(id, { text: broadcastMessage });
                    success++;
                    // Pausa ligera para evitar flags de spam en WhatsApp
                    await new Promise(r => setTimeout(r, 800));
                } catch (e) {
                    failed++;
                }
            }

            await m.reply(`✅ *Difusión completada:*\n📤 Enviados: ${success} grupos\n❌ Fallidos: ${failed}`);
        } catch (err) {
            throw new Error(`Error durante la difusión: ${err.message}`);
        }
    }
};

