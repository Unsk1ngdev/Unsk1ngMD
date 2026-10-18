'use strict';

module.exports = {
    name: 'perfil',
    alias: ['pfp', 'fotoperfil', 'avatar'],
    category: 'herramientas',
    desc: 'Obtiene la foto de perfil en alta resolución de un usuario',
    usage: '.perfil [@usuario | número]',

    execute: async ({ sock, m, args }) => {
        const sender = m.sender;
        const jid = m.chat || m.key.remoteJid;

        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        let target = mentioned[0];

        if (!target && args[0]) {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw.length >= 7) target = `${raw}@s.whatsapp.net`;
        }

        if (!target && m.quoted?.sender) {
            target = m.quoted.sender;
        }

        if (!target) {
            target = sender;
        }

        const cleanNumber = target.replace('@s.whatsapp.net', '').split(':')[0];

        await sock.sendMessage(jid, {
            text: '📸 Obteniendo foto de perfil...'
        }, { quoted: m });

        try {
            let foto = null;
            // Intentar primero en alta calidad ('image')
            try {
                foto = await sock.profilePictureUrl(target, 'image');
            } catch (_) {
                // Fallback a preview
                try {
                    foto = await sock.profilePictureUrl(target, 'preview');
                } catch (__) {
                    foto = null;
                }
            }

            if (!foto) {
                return await sock.sendMessage(jid, {
                    text: `🔒 *Foto de perfil privada o no disponible*\n\n` +
                          `👤 Número: *+${cleanNumber}*\n\n` +
                          `_Unknown Codexツ</>_`
                }, { quoted: m });
            }

            await sock.sendMessage(jid, {
                image: { url: foto },
                caption: `📸 *Foto de perfil*\n\n` +
                         `👤 Número: *+${cleanNumber}*\n\n` +
                         `_Unknown Codexツ</>_`
            }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(jid, {
                text: `❌ Error: ${e.message}`
            }, { quoted: m });
        }
    }
};

