module.exports = {
    name: 'enviarlink',
    alias: ['sendlink', 'invitarto'],
    category: 'grupo',
    desc: 'Envía el enlace de invitación del grupo actual por mensaje privado al número especificado',
    usage: '.enviarlink [número con código de país, ej: +18494509905 o 18494509905]',
    groupOnly: true,
    botAdminRequired: true,
    execute: async ({ sock, m, text, groupMetadata }) => {
        if (!text) {
            return await m.reply('❌ Debes ingresar el número de teléfono al que deseas enviar el enlace.\nEjemplo: *.enviarlink +18494509905*');
        }

        // Limpiar el número de teléfono de espacios, guiones o signos +
        const cleanNumber = text.replace(/[^0-9]/g, '');

        if (!cleanNumber || cleanNumber.length < 8 || cleanNumber.length > 16) {
            return await m.reply('❌ El número ingresado es inválido. Asegúrate de incluir el código de país sin caracteres especiales.\nEjemplo: *.enviarlink 18494509905*');
        }

        const targetJid = `${cleanNumber}@s.whatsapp.net`;
        await m.react('⏳');

        try {
            // Obtener el código de invitación del grupo actual
            const code = await sock.groupInviteCode(m.chat);
            const groupName = groupMetadata?.subject || 'este grupo';
            const inviteUrl = `https://chat.whatsapp.com/${code}`;

            const privateMessage = `👋 ¡Hola! Has recibido una invitación para unirte al grupo:\n\n` +
                `🏷️ *Grupo:* ${groupName}\n` +
                `🔗 *Enlace de invitación:* ${inviteUrl}\n\n` +
                `_Invitación solicitada por @${m.sender.split('@')[0]}._`;

            // Enviar mensaje privado al usuario destino
            await sock.sendMessage(targetJid, {
                text: privateMessage,
                mentions: [m.sender]
            });

            // Confirmar en el grupo
            await m.reply(`✅ *Enlace enviado:* Se ha enviado la invitación exitosamente por privado al número *+${cleanNumber}*.`);
            await m.react('✅');
        } catch (err) {
            await m.react('❌');
            throw new Error(`No se pudo enviar el enlace al privado: ${err.message}`);
        }
    }
};

