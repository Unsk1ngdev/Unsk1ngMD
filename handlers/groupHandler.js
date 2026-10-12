const fs = require('fs');
const path = require('path');
const logger = require('../lib/logger');
const groupSettings = require('../lib/groupSettings');
const database = require('../lib/database');
const despedidaManager = require('../lib/despedida');

/**
 * Manejador de eventos de participantes de grupo (entradas, salidas, ascensos)
 */
const handleGroupUpdate = async (sock, update) => {
    try {
        const { id, participants, action } = update;

        // Manejo de Despedida cuando alguien sale o es expulsado
        if (action === 'remove' || action === 'leave') {
            const configDespedida = despedidaManager.getConfig(id);
            if (configDespedida && configDespedida.activo) {
                let groupMeta = null;
                try {
                    groupMeta = await sock.groupMetadata(id);
                } catch (_) {}
                const nombreGrupo = groupMeta?.subject || 'el grupo';

                for (const participante of participants) {
                    const numero = participante.replace(/:\d+@/, '@').split('@')[0];
                    const mensaje = configDespedida.mensaje
                        .replace(/{usuario}/g, `+${numero}`)
                        .replace(/{grupo}/g, nombreGrupo);

                    await sock.sendMessage(id, {
                        text: mensaje,
                        mentions: [participante]
                    }).catch(() => {});
                }
            }
            return;
        }

        const isWelcomeActive = groupSettings.isBienvenidaEnabled(id) || database.getGroup(id)?.welcome;

        if (!isWelcomeActive || action !== 'add') {
            return;
        }

        // Obtener metadatos del grupo de forma segura
        let groupMeta = null;
        try {
            groupMeta = await sock.groupMetadata(id);
        } catch (_) {}

        const groupName = groupMeta?.subject || 'nuestro grupo';
        const groupDesc = groupMeta?.desc || 'Sin descripción asignada.';

        for (const participant of participants) {
            const userTag = participant.replace(/:.*@/, '@').split('@')[0];

            // Intentar obtener foto de perfil del nuevo integrante
            let pfpUrl = null;
            try {
                pfpUrl = await sock.profilePictureUrl(participant, 'image');
            } catch (_) {
                // Si no tiene foto pública, se usa fallback
            }

            const welcomeText =
                `╭━━━〔 *¡NUEVO MIEMBRO!* 〕━━━⬣\n` +
                `┃ 👋 ¡Bienvenido/a @${userTag} a *${groupName}*!\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
                `📜 *Descripción del grupo:*\n${groupDesc}\n\n` +
                `_Te invitamos a leer las reglas y disfrutar de la comunidad._ ✨`;

            if (pfpUrl) {
                await sock.sendMessage(id, {
                    image: { url: pfpUrl },
                    caption: welcomeText,
                    mentions: [participant]
                });
            } else {
                await sock.sendMessage(id, {
                    text: welcomeText,
                    mentions: [participant]
                });
            }

            // Enviar audio de bienvenida inmediatamente después del mensaje de bienvenida
            try {
                const opusAudio = path.join(__dirname, '../assets/bienvenida.opus');
                const mp3Audio = path.join(__dirname, '../assets/bienvenida.mp3');

                if (fs.existsSync(opusAudio)) {
                    await sock.sendMessage(id, {
                        audio: fs.readFileSync(opusAudio),
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt: true
                    });
                } else if (fs.existsSync(mp3Audio)) {
                    await sock.sendMessage(id, {
                        audio: fs.readFileSync(mp3Audio),
                        mimetype: 'audio/mp4',
                        ptt: true
                    });
                }
            } catch (audioErr) {
                logger.error('Error enviando audio de bienvenida:', audioErr.message);
            }
        }
    } catch (err) {
        logger.error('Error en handleGroupUpdate:', err.message);
    }
};

module.exports = {
    handleGroupUpdate
};
